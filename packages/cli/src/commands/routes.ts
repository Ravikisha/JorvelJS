import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { discoverApps } from '../discovery.js';
// NOTE: we keep the implementation local to jorvel to avoid TS rootDir
// cross-package source imports during compilation.
// The *contract* lives in @jorvel/types (libs/types/src/routing-compiler.ts).
type JorvelPageRoute = { path: string; file: string };

const defaultRoutingCompiler = {
  routeFromPageFile(relFromPages: string) {
    // Mirror of @jorvel/types PAGE_EXTENSIONS (kept local to avoid a cross-package
    // source import during compilation). Keep in sync.
    let withoutExt = relFromPages.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/i, '');
    withoutExt = withoutExt.replace(/\\/g, '/');

    const segs = withoutExt.split('/').filter(Boolean);
    const out: string[] = [];

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s) continue;
      if (s === 'index' && i === segs.length - 1) continue;

      const mCatchAll = s.match(/^\[\.\.\.(.+)\]$/);
      if (mCatchAll) {
        out.push('*');
        continue;
      }

      const mParam = s.match(/^\[(.+)\]$/);
      if (mParam) {
        out.push(':' + mParam[1]);
        continue;
      }

      out.push(s);
    }

    return '/' + out.join('/');
  },

  sortRoutesForMatching(routes: JorvelPageRoute[]) {
    const score = (p: string) => {
      const segs = p.split('/').filter(Boolean);
      let s = 0;
      for (const seg of segs) {
        if (seg === '*') s += 0;
        else if (seg.startsWith(':')) s += 1;
        else s += 2;
      }
      return s * 100 + segs.length;
    };

    return [...routes].sort((a, b) => score(b.path) - score(a.path));
  },
};

export type PageRoute = {
  /** Route pathname relative to app base, e.g. "/" or "/reports/:id" */
  path: string;
  /** Source file path, relative to app root */
  file: string;
};

export type AppRoutesManifest = {
  app: string;
  basePath: string;
  routes: PageRoute[];
};

export type HostRoutesManifest = {
  host: string;
  routes: Array<{ path: string; remote: string; module: string }>;
};

/**
 * Write the host route table, PRESERVING any existing (hand-edited) routes —
 * templates explicitly invite users to edit `jorvel.routes.host.json`, so we
 * must not clobber it. Only a `/<name>/*` mount for remotes not already present
 * is appended; on a brand-new manifest the first remote also gets `/`.
 */
async function writeHostRouteTable(
  outPath: string,
  hostName: string,
  remotes: Array<{ meta: { name: string } }>,
): Promise<void> {
  const existing: HostRoutesManifest | undefined = (await fs.pathExists(outPath))
    ? ((await fs.readJson(outPath).catch(() => undefined)) as HostRoutesManifest | undefined)
    : undefined;
  const have = new Set((existing?.routes ?? []).map((r) => r.remote));
  const routes = [...(existing?.routes ?? [])];
  if (!existing && remotes[0]) {
    routes.push({ path: '/', remote: remotes[0].meta.name, module: './App' });
  }
  for (const r of remotes) {
    if (!have.has(r.meta.name)) {
      routes.push({ path: `/${r.meta.name}/*`, remote: r.meta.name, module: './App' });
      have.add(r.meta.name);
    }
  }
  await fs.outputFile(
    outPath,
    JSON.stringify({ host: hostName, routes } satisfies HostRoutesManifest, null, 2) + '\n',
    'utf8',
  );
}

function toPosixPath(p: string) {
  return p.replace(/\\/g, '/');
}

function routeFromPageFile(relFromPages: string) {
  return defaultRoutingCompiler.routeFromPageFile(relFromPages);
}

async function scanPages(appDir: string) {
  const pagesDir = path.join(appDir, 'src', 'pages');
  if (!(await fs.pathExists(pagesDir))) return [];

  const files: string[] = [];
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir);
    for (const e of entries) {
      const abs = path.join(dir, e);
      const st = await fs.stat(abs);
      if (st.isDirectory()) await walk(abs);
      else if (/\.(tsx|ts|jsx|js|mjs|cjs)$/i.test(e)) files.push(abs);
    }
  };

  await walk(pagesDir);

  return files
    .map((abs) => {
      const relFromPages = path.relative(pagesDir, abs);
      const relFromApp = toPosixPath(path.relative(appDir, abs));
      return { path: routeFromPageFile(relFromPages), file: relFromApp };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function sortRoutesForMatching(routes: PageRoute[]) {
  return defaultRoutingCompiler.sortRoutesForMatching(routes as JorvelPageRoute[]) as PageRoute[];
}

async function writeRemoteRoutesModule(appDir: string, routes: PageRoute[]) {
  // A `--lang js` app has a jsconfig.json (not tsconfig.json) and JS pages.
  // Writing a `.ts` module with `import type` into a JS app is invalid (and the
  // extensionAlias would let the stray .ts shadow the real .js). Treat the app as
  // JS only when clearly so; default to TS otherwise.
  const [hasJsconfig, hasTsconfig] = await Promise.all([
    fs.pathExists(path.join(appDir, 'jsconfig.json')),
    fs.pathExists(path.join(appDir, 'tsconfig.json')),
  ]);
  const hasTsPages = routes.some((r) => /\.(tsx|ts)$/i.test(r.file));
  const hasJsPages = routes.some((r) => /\.(jsx|js|mjs|cjs)$/i.test(r.file));
  const isJs = (hasJsconfig && !hasTsconfig) || (hasJsPages && !hasTsPages);
  const isTs = !isJs;
  const outFile = path.join(appDir, 'src', isTs ? 'jorvel.routes.ts' : 'jorvel.routes.js');
  const lines: string[] = [];

  lines.push('// THIS FILE IS AUTO-GENERATED by `jorvel routes`.');
  lines.push('// It exposes the remote\'s file-based route table for the host to consume.');
  if (isTs) {
    lines.push("import type { RemotePageRoute } from '@jorvel/runtime';");
    lines.push('');
    lines.push('export const pages: RemotePageRoute[] = [');
  } else {
    lines.push('');
    lines.push('/** @type {import(\'@jorvel/runtime\').RemotePageRoute[]} */');
    lines.push('export const pages = [');
  }

  const sorted = sortRoutesForMatching(routes);
  for (const r of sorted) {
    // Keep the import target relative to this file (src/jorvel.routes.ts).
    // Page files live under src/pages/** so we should import from './pages/**'.
    const rel = toPosixPath(r.file).replace(/^\.\//, '');
    const withPrefix = rel.startsWith('src/pages/')
      ? './' + rel.slice('src/'.length)
      : rel.startsWith('pages/')
        ? './' + rel
        : rel.startsWith('src/')
          ? './' + rel.slice('src/'.length)
          : './' + rel;
    // Strip the source extension — TS resolves `.tsx`/`.ts` from the bare specifier
    // and bundlers (rspack/vite) reject explicit `.tsx` in dynamic imports.
    const importTarget = withPrefix.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/i, '');
    lines.push(
      `  { path: ${JSON.stringify(r.path)}, load: () => import(${JSON.stringify(importTarget)}) },`
    );
  }

  lines.push('];');
  lines.push('');
  lines.push('export default pages;');
  lines.push('');

  await fs.outputFile(outFile, lines.join('\n'), 'utf8');
}

async function generateAllRoutes(workspaceDir: string): Promise<void> {
  const apps = await discoverApps(workspaceDir);
  if (apps.length === 0) {
    console.log(kleur.yellow('No apps found (missing apps/*/jorvel.app.json).'));
    return;
  }
  const host = apps.find((a) => a.meta.type === 'host');
  const remotes = apps.filter((a) => a.meta.type === 'remote');

  for (const app of apps) {
    const basePath = app.meta.type === 'host' ? '/' : `/${app.meta.name}`;
    const routes = await scanPages(app.dir);
    const manifest: AppRoutesManifest = { app: app.meta.name, basePath, routes };
    const outPath = path.join(app.dir, 'jorvel.routes.json');
    await fs.outputFile(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    if (app.meta.type === 'remote') {
      await writeRemoteRoutesModule(app.dir, routes);
    }
  }

  if (host) {
    await writeHostRouteTable(path.join(host.dir, 'jorvel.routes.host.json'), host.meta.name, remotes);
  }
}

export const routesCommand = new Command('routes')
  .description('Generate file-based routing manifests from apps/*/src/pages')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--watch', 'Re-run whenever a page file changes')
  .action(async (opts: { dir: string; watch?: boolean }) => {
    const workspaceDir = path.resolve(opts.dir);

    if (opts.watch) {
      console.log(kleur.cyan(`watching ${workspaceDir}/apps/*/src/pages ...`));
      await generateAllRoutes(workspaceDir);
      console.log(kleur.green('initial route manifests written'));

      const appsDir = path.join(workspaceDir, 'apps');
      const { watch } = await import('node:fs');
      let timer: NodeJS.Timeout | null = null;
      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            await generateAllRoutes(workspaceDir);
            console.log(kleur.green(`[${new Date().toLocaleTimeString()}] routes rebuilt`));
          } catch (e) {
            console.error(kleur.red('routes rebuild failed:'), e);
          }
        }, 100);
      };
      watch(appsDir, { recursive: true }, (_evt, file) => {
        if (!file) return;
        const s = String(file).replace(/\\/g, '/');
        if (!/src\/pages\//.test(s)) return;
        schedule();
      });
      return;
    }

    const apps = await discoverApps(workspaceDir);

    if (apps.length === 0) {
      console.log(kleur.yellow('No apps found (missing apps/*/jorvel.app.json).'));
      return;
    }

    const host = apps.find((a) => a.meta.type === 'host');
    const remotes = apps.filter((a) => a.meta.type === 'remote');

    // Per-app manifests
    for (const app of apps) {
      const basePath = app.meta.type === 'host' ? '/' : `/${app.meta.name}`;
      const routes = await scanPages(app.dir);
      const manifest: AppRoutesManifest = { app: app.meta.name, basePath, routes };
      const outPath = path.join(app.dir, 'jorvel.routes.json');
      await fs.outputFile(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      console.log(kleur.green(`wrote ${path.relative(workspaceDir, outPath)}`));

      // For remotes, also emit an importable route table module.
      if (app.meta.type === 'remote') {
        await writeRemoteRoutesModule(app.dir, routes);
        console.log(kleur.green(`wrote ${path.relative(workspaceDir, path.join(app.dir, 'src/jorvel.routes.ts'))}`));
      }
    }

    // Host route table for mounting remotes (preserves manual edits).
    if (host) {
      const outPath = path.join(host.dir, 'jorvel.routes.host.json');
      await writeHostRouteTable(outPath, host.meta.name, remotes);
      console.log(kleur.green(`wrote ${path.relative(workspaceDir, outPath)}`));
    }

    console.log(kleur.cyan('Done. Next: update your host to load jorvel.routes.host.json and mount remotes based on the URL.'));
  });
