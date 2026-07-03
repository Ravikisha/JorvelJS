/**
 * `jorvel migrate` — codemods for breaking changes in user workspaces.
 *
 * Currently shipped:
 *   - `mfjs-to-jorvel` — rewrite legacy `mfjs.*.json` filenames + every
 *     `mfjs`/`MFJS`/`Mfjs` token inside source files to `jorvel`.
 *   - `builtins-define` — rewrite Rspack `builtins.define` blocks to
 *     `new rspack.DefinePlugin({...})` (removed in Rspack 1.x).
 *   - `routes-host-rename` — move legacy `jorvel.routes.json` (used as host
 *     mapping in early scaffolds) to `jorvel.routes.host.json`.
 *
 * Always emits a dry-run report unless `--apply` is passed.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';

interface FileEdit {
  file: string;
  reason: string;
}

interface Rename {
  from: string;
  to: string;
  reason: string;
}

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
]);

const TEXT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.cjs',
  '.mjs',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.css',
  '.html',
]);

async function walk(root: string, onFile: (abs: string) => Promise<void>): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(path.join(root, e.name), onFile);
    } else if (e.isFile()) {
      await onFile(path.join(root, e.name));
    }
  }
}

interface MigrateResult {
  edits: FileEdit[];
  renames: Rename[];
}

/** Replace mfjs → jorvel (case-aware) and rename `mfjs.*` config files. */
async function migrateMfjsToJorvel(
  root: string,
  apply: boolean,
): Promise<MigrateResult> {
  const edits: FileEdit[] = [];
  const renames: Rename[] = [];

  await walk(root, async (abs) => {
    const base = path.basename(abs);
    const ext = path.extname(abs).toLowerCase();
    // Rename config files first — content edits happen after.
    if (/^mfjs\./.test(base)) {
      const newBase = base.replace(/^mfjs\./, 'jorvel.');
      const dest = path.join(path.dirname(abs), newBase);
      renames.push({ from: abs, to: dest, reason: 'config filename rename' });
      if (apply) await fs.move(abs, dest, { overwrite: false });
      return;
    }
    if (!TEXT_EXTS.has(ext)) return;
    let content: string;
    try {
      content = await fs.readFile(abs, 'utf8');
    } catch {
      return;
    }
    if (!/mfjs|MFJS|Mfjs/.test(content)) return;
    const next = content
      .replace(/MFJS/g, 'JORVEL')
      .replace(/Mfjs/g, 'Jorvel')
      .replace(/mfjs/g, 'jorvel');
    if (next === content) return;
    edits.push({ file: abs, reason: 'mfjs→jorvel rename' });
    if (apply) await fs.writeFile(abs, next, 'utf8');
  });

  return { edits, renames };
}

/** Rewrite `builtins.define = {...}` blocks to `new rspack.DefinePlugin({...})`. */
async function migrateBuiltinsDefine(
  root: string,
  apply: boolean,
): Promise<MigrateResult> {
  const edits: FileEdit[] = [];

  await walk(root, async (abs) => {
    const ext = path.extname(abs).toLowerCase();
    if (!['.js', '.mjs', '.cjs', '.ts'].includes(ext)) return;
    if (path.basename(abs) !== 'rspack.config.mjs' && path.basename(abs) !== 'rspack.config.js')
      return;
    let content: string;
    try {
      content = await fs.readFile(abs, 'utf8');
    } catch {
      return;
    }
    // Tolerate either object literal or single key assignment.
    const re = /builtins\s*:\s*\{\s*define\s*:\s*(\{[\s\S]*?\})\s*\}/m;
    const m = content.match(re);
    if (!m) return;
    const defineBody = m[1];
    const replaced = content.replace(re, '/* builtins.define migrated → DefinePlugin */');
    // Insert the plugin into the plugins array if one exists; otherwise append.
    let next: string;
    if (/plugins\s*:\s*\[/.test(replaced)) {
      next = replaced.replace(
        /plugins\s*:\s*\[/,
        `plugins: [\n    new rspack.DefinePlugin(${defineBody}),`,
      );
    } else {
      next = replaced.replace(
        /\}\s*;?\s*$/,
        `  plugins: [new rspack.DefinePlugin(${defineBody})],\n};\n`,
      );
    }
    if (!/import\s+\{[^}]*rspack[^}]*\}\s+from\s+['"]@rspack\/core['"]/.test(next)) {
      next = `import { rspack } from '@rspack/core';\n${next}`;
    }
    edits.push({ file: abs, reason: 'builtins.define → DefinePlugin' });
    if (apply) await fs.writeFile(abs, next, 'utf8');
  });

  return { edits, renames: [] };
}

/** Move `jorvel.routes.json` (early host mapping) to `jorvel.routes.host.json`. */
async function migrateRoutesHostRename(
  root: string,
  apply: boolean,
): Promise<MigrateResult> {
  const renames: Rename[] = [];
  await walk(root, async (abs) => {
    if (path.basename(abs) !== 'jorvel.routes.json') return;
    // Heuristic: it's the host mapping if it contains a "host" or "routes" array
    // referring to remotes. We accept any file named jorvel.routes.json that
    // sits at the app root (sibling of jorvel.app.json with type=host).
    const sibling = path.join(path.dirname(abs), 'jorvel.app.json');
    if (!(await fs.pathExists(sibling))) return;
    let meta: { type?: string } = {};
    try {
      meta = JSON.parse(await fs.readFile(sibling, 'utf8'));
    } catch {
      return;
    }
    if (meta.type !== 'host') return;
    const dest = path.join(path.dirname(abs), 'jorvel.routes.host.json');
    renames.push({ from: abs, to: dest, reason: 'routes manifest rename' });
    if (apply) await fs.move(abs, dest, { overwrite: false });
  });
  return { edits: [], renames };
}

const MIGRATIONS: Record<
  string,
  { description: string; run: (root: string, apply: boolean) => Promise<MigrateResult> }
> = {
  'mfjs-to-jorvel': {
    description: 'Rename mfjs.* config filenames + rewrite mfjs/MFJS tokens in source files.',
    run: migrateMfjsToJorvel,
  },
  'builtins-define': {
    description: 'Rewrite Rspack builtins.define blocks to new rspack.DefinePlugin (Rspack 1.x).',
    run: migrateBuiltinsDefine,
  },
  'routes-host-rename': {
    description: 'Move host jorvel.routes.json → jorvel.routes.host.json.',
    run: migrateRoutesHostRename,
  },
};

export const migrateCommand = new Command('migrate')
  .description('Apply codemods for breaking JORVEL changes in your workspace.')
  .argument('[name]', `Migration to run (one of: ${Object.keys(MIGRATIONS).join(', ')}, or "all").`)
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--apply', 'Actually rewrite files (default is a dry-run report)', false)
  .action(async (name: string | undefined, opts: { dir: string; apply: boolean }) => {
    const root = path.resolve(opts.dir);

    if (!name) {
      console.log(kleur.bold('Available migrations:'));
      for (const [k, v] of Object.entries(MIGRATIONS)) {
        console.log(`  ${kleur.cyan(k)} — ${v.description}`);
      }
      console.log('');
      console.log('Run: jorvel migrate <name> [--apply]   (or "all")');
      return;
    }

    const names = name === 'all' ? Object.keys(MIGRATIONS) : [name];
    let totalEdits = 0;
    let totalRenames = 0;

    for (const n of names) {
      const m = MIGRATIONS[n];
      if (!m) {
        console.error(kleur.red(`Unknown migration "${n}". Run \`jorvel migrate\` to list options.`));
        process.exitCode = 1;
        return;
      }
      console.log(kleur.bold(`\n→ ${n}`));
      const r = await m.run(root, opts.apply);
      for (const e of r.edits) {
        console.log(`  ${kleur.yellow('edit')}   ${path.relative(root, e.file)}  (${e.reason})`);
      }
      for (const r2 of r.renames) {
        console.log(
          `  ${kleur.magenta('rename')} ${path.relative(root, r2.from)} → ${path.relative(root, r2.to)}  (${r2.reason})`,
        );
      }
      if (r.edits.length === 0 && r.renames.length === 0) {
        console.log(kleur.gray('  nothing to do'));
      }
      totalEdits += r.edits.length;
      totalRenames += r.renames.length;
    }

    console.log('');
    if (opts.apply) {
      console.log(
        kleur.green(`Applied ${totalEdits} edit(s) and ${totalRenames} rename(s).`),
      );
    } else {
      console.log(
        kleur.yellow(
          `Dry-run: ${totalEdits} edit(s) and ${totalRenames} rename(s) would happen. Re-run with --apply to commit.`,
        ),
      );
    }
  });
