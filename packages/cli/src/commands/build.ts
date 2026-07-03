import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { execa } from 'execa';
import { compressDist } from './compress.js';
import { loadWorkspaceConfig } from '../config.js';
import { writeBuildStats } from './build-stats.js';

type AppMeta = {
  name: string;
  type: 'host' | 'remote';
  port: number;
};

async function runBuild(cwd: string, signal: AbortSignal): Promise<void> {
  // execa handles Windows .cmd shims correctly without shell:true.
  await execa('pnpm', ['build'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    cancelSignal: signal,
  });
}

export const buildCommand = new Command('build')
  .description('Build all apps under apps/* (those that have jorvel.app.json)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option(
    '--compress',
    'After building each app, generate .gz and .br assets in dist/ (defaults: JS/CSS/HTML/SVG/JSON/XML/TXT/MAP). Defaults to build.compress in jorvel.config.',
  )
  .option(
    '--no-compress',
    'Disable compression (overrides workspace `build.compress`).',
  )
  .option(
    '--compress-include <exts>',
    'Comma-separated list of file extensions to compress (example: .js,.css,.html)',
    '.js,.mjs,.cjs,.css,.html,.svg,.json,.xml,.txt,.map',
  )
  .option(
    '--compress-delete-original',
    'Delete original assets when compression is generated (useful only for CDN pipelines that serve precompressed assets)',
    false,
  )
  .option('--allow-empty', 'Exit 0 even when no apps are present.', false)
  .option('--app <names>', 'Comma-separated app names to build (others skipped).')
  .option('--parallel', 'Build apps concurrently (they are independent — federation is resolved at runtime).', false)
  .option(
    '--stats [path]',
    'Write a JSON build-stats summary (default path: jorvel-build-stats.json under the workspace root).',
  )
  .action(
    async (opts: {
      dir: string;
      compress: boolean | undefined;
      compressInclude: string;
      compressDeleteOriginal: boolean;
      allowEmpty: boolean;
      app?: string;
      parallel?: boolean;
      stats?: boolean | string;
    }) => {
      const workspaceDir = path.resolve(opts.dir);
      const appsDir = path.join(workspaceDir, 'apps');

      if (!(await fs.pathExists(appsDir))) {
        throw new Error(`No apps/ directory found in ${workspaceDir}`);
      }

      const { cfg } = await loadWorkspaceConfig(workspaceDir);
      // Workspace config gives a default; CLI flag wins when set.
      const compressEnabled = opts.compress ?? cfg.build?.compress ?? false;

      const appFolders = (await fs.readdir(appsDir)).filter((f) => !f.startsWith('.'));
      let appMetas: Array<{ dir: string; meta: AppMeta }> = [];

      for (const folder of appFolders) {
        const metaPath = path.join(appsDir, folder, 'jorvel.app.json');
        if (!(await fs.pathExists(metaPath))) continue;
        const meta = (await fs.readJson(metaPath)) as AppMeta;
        appMetas.push({ dir: path.join(appsDir, folder), meta });
      }

      // --app filter.
      const onlyApps = opts.app
        ? opts.app.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      if (onlyApps.length) appMetas = appMetas.filter((a) => onlyApps.includes(a.meta.name));

      if (appMetas.length === 0) {
        if (opts.allowEmpty) {
          console.log(kleur.yellow('No apps found — exiting cleanly (--allow-empty).'));
          return;
        }
        console.error(kleur.yellow('No apps found (missing jorvel.app.json, or none matched --app).'));
        process.exitCode = 2;
        return;
      }

      const sorted = [...appMetas].sort((a, b) =>
        (a.meta.type === 'host' ? -1 : 1) - (b.meta.type === 'host' ? -1 : 1),
      );

      console.log(kleur.cyan(`Building ${sorted.length} app(s)${opts.parallel ? ' in parallel' : ''}...`));

      const ac = new AbortController();
      const onSig = (sig: NodeJS.Signals) => {
        console.log(kleur.yellow(`\nReceived ${sig}, cancelling build.`));
        ac.abort();
      };
      process.once('SIGINT', () => onSig('SIGINT'));
      process.once('SIGTERM', () => onSig('SIGTERM'));

      const includeExts = opts.compressInclude
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Build (and optionally compress) one app. Returns false on failure.
      const buildApp = async (app: { dir: string; meta: AppMeta }): Promise<boolean> => {
        console.log(kleur.gray(`- ${app.meta.type} ${app.meta.name}`));
        try {
          await runBuild(app.dir, ac.signal);
        } catch (err) {
          console.error(kleur.red(`Build failed in ${app.meta.name}: ${(err as Error).message}`));
          return false;
        }
        if (compressEnabled) {
          const distDir = path.join(app.dir, 'dist');
          if (!(await fs.pathExists(distDir))) {
            console.log(kleur.yellow(`  compress: skipping ${app.meta.name} (missing ${path.relative(workspaceDir, distDir)})`));
          } else {
            const result = await compressDist(distDir, {
              includeExts,
              deleteOriginal: opts.compressDeleteOriginal,
            });
            console.log(
              kleur.gray(
                `  compress: ${app.meta.name} wrote ${result.written} file(s) (${result.gzWritten} gz, ${result.brWritten} br), skipped ${result.skipped}`,
              ),
            );
          }
        }
        return true;
      };

      if (opts.parallel) {
        const results = await Promise.all(sorted.map((app) => buildApp(app)));
        if (results.some((ok) => !ok)) {
          process.exitCode = 1;
          return;
        }
      } else {
        for (const app of sorted) {
          if (!(await buildApp(app))) {
            process.exitCode = 1;
            return;
          }
        }
      }

      if (opts.stats) {
        const outPath = path.resolve(
          workspaceDir,
          typeof opts.stats === 'string' ? opts.stats : 'jorvel-build-stats.json',
        );
        const stats = await writeBuildStats(workspaceDir, outPath);
        console.log(
          kleur.gray(
            `  stats: wrote ${path.relative(workspaceDir, outPath)} (${stats.apps.length} app(s), ${stats.conflicts.length} conflict(s))`,
          ),
        );
        if (stats.conflicts.length > 0) {
          for (const c of stats.conflicts) {
            const detail = c.versions.map((v) => `${v.app}@${v.version}`).join(', ');
            console.log(kleur.yellow(`  conflict: ${c.dep} → ${detail}`));
          }
        }
      }

      console.log(kleur.green('Build complete.'));
    },
  );
