/**
 * `jorvel ssr` — Server-Side Rendering & Static Export CLI command.
 *
 * Subcommands:
 *   jorvel ssr export    — Pre-render a list of routes to static HTML files.
 *   jorvel ssr serve     — Start a Node.js SSR server for the host app.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { printCliError } from '../errors.js';


// ── Helpers ───────────────────────────────────────────────────────────────────

const STATIC_MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

/**
 * Serve a static file under `root` for a request pathname. Returns true when it
 * served a response, false to fall through to SSR. Only handles requests that
 * look like a file (have an extension) and stay inside `root` (traversal-guarded).
 */
async function tryServeStatic(
  root: string,
  pathname: string,
  method: string,
  res: http.ServerResponse,
): Promise<boolean> {
  const ext = path.extname(pathname).toLowerCase();
  if (!ext) return false; // route request, not an asset → let SSR handle it
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const abs = path.resolve(root, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  // Path-traversal guard: resolved path must be the root or inside it.
  if (abs !== root && !abs.startsWith(root + path.sep)) return false;
  let stat: { isFile(): boolean; size: number };
  try {
    stat = await fs.stat(abs);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  res.statusCode = 200;
  res.setHeader('content-type', STATIC_MIME[ext] ?? 'application/octet-stream');
  res.setHeader('content-length', String(stat.size));
  if (method === 'HEAD') {
    res.end();
    return true;
  }
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(abs);
    stream.on('error', reject);
    stream.on('end', () => resolve());
    stream.pipe(res);
  });
  return true;
}

async function loadSsrConfig(workspaceDir: string): Promise<SsrConfig | null> {
  const configPath = path.join(workspaceDir, 'jorvel.ssr.json');
  if (!(await fs.pathExists(configPath))) return null;
  return fs.readJson(configPath) as Promise<SsrConfig>;
}

type SsrConfig = {
  /** Module specifier (relative to workspace) for the App component. */
  app: string;
  /** Path to the HTML template file (relative to workspace). */
  template: string;
  /** Routes to pre-render. */
  routes: Array<{
    path: string;
    params?: Record<string, string>;
  }>;
  /** Output directory for static export (relative to workspace). */
  outDir?: string;
  /** Dev server port for `jorvel ssr serve`. */
  port?: number;
};

async function loadUserAppModule(appModulePath: string) {
  // Prefer ESM-friendly dynamic import. This supports:
  // - ESM modules
  // - CJS modules (Node will provide a synthetic default export)
  //
  // It does NOT transpile TypeScript. For TS sources, users should build first
  // or point jorvel.ssr.json at a built JS entry.
  const url = pathToFileURL(appModulePath).href;
  return import(url);
}

function withWorkspaceNodePath<T>(workspaceDir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env['NODE_PATH'];
  // Ensure Node can resolve dependencies for dynamically-imported app modules.
  // This matters when a user runs `jorvel ssr` from outside the workspace root.
  process.env['NODE_PATH'] = [path.join(workspaceDir, 'node_modules'), prev]
    .filter(Boolean)
    .join(path.delimiter);
  const cjs = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  cjs('module').Module._initPaths();
  return fn().finally(() => {
    // Restore precisely: if NODE_PATH was unset, delete it — assigning `prev`
    // (undefined) would coerce to the literal string "undefined".
    if (prev === undefined) delete process.env['NODE_PATH'];
    else process.env['NODE_PATH'] = prev;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    cjs('module').Module._initPaths();
  });
}

// ── `jorvel ssr export` ─────────────────────────────────────────────────────────

const exportCommand = new Command('export')
  .description('Pre-render routes to static HTML files')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('-o, --out <path>', 'Output directory (overrides jorvel.ssr.json)')
  .option('-c, --config <path>', 'Path to jorvel.ssr.json (defaults to <dir>/jorvel.ssr.json)')
  .action(async (opts: { dir: string; out?: string; config?: string }) => {
    const workspaceDir = path.resolve(opts.dir);

    const configPath = opts.config
      ? path.resolve(opts.config)
      : path.join(workspaceDir, 'jorvel.ssr.json');

    if (!(await fs.pathExists(configPath))) {
      printCliError(new Error(`No SSR config found at ${configPath}`), {
        command: 'ssr export',
        hint: 'Create a jorvel.ssr.json with { app, template, routes, outDir }.',
      });
      return;
    }

    const config = (await fs.readJson(configPath)) as SsrConfig;
    const outDir = opts.out
      ? path.resolve(opts.out)
      : config.outDir
      ? path.join(workspaceDir, config.outDir)
      : path.join(workspaceDir, 'dist-static');

    const templatePath = path.resolve(workspaceDir, config.template);
    if (!(await fs.pathExists(templatePath))) {
  printCliError(new Error(`Template not found: ${templatePath}`), { command: 'ssr export' });
      return;
    }

    const template = await fs.readFile(templatePath, 'utf8');

    // Dynamically import the App module and @jorvel/ssr.
    const appModulePath = path.resolve(workspaceDir, config.app);

    console.log(kleur.cyan(`Pre-rendering ${config.routes.length} route(s) → ${outDir}`));

    let App: any;
    try {
      await withWorkspaceNodePath(workspaceDir, async () => {
        const appMod = await loadUserAppModule(appModulePath);
        App = appMod.default ?? appMod.App;
      });
      if (!App) throw new Error(`App module at ${appModulePath} has no default export.`);
    } catch (e) {
      printCliError(e, {
        command: 'ssr export',
        hint: 'SSR app module must be a built JavaScript file (ESM or CJS). TypeScript is not transpiled at runtime.',
      });
      return;
    }

    let staticExport: (opts: any) => Promise<any>;
    let injectIntoTemplate: ((template: string, html: string) => string) | null = null;
    try {
      const ssrMod = await import('@jorvel/ssr');
      staticExport = ssrMod.staticExport;
      injectIntoTemplate = typeof ssrMod.injectIntoTemplate === 'function' ? ssrMod.injectIntoTemplate : null;
    } catch (e) {
      printCliError(new Error('@jorvel/ssr not found.'), {
        command: 'ssr export',
        hint: 'Install it: pnpm add -D @jorvel/ssr',
      });
      return;
    }

    const isStringApp = typeof App === 'function' && typeof App({ path: '/', params: {} }) === 'string';

    const pages = isStringApp
      ? (
          await Promise.all(
            config.routes.map(async (route: { path: string; params?: Record<string, string> }) => {
              // Pattern routes (`:id`, `*`) cannot become static files —
              // skip silently, keeping behavior consistent with @jorvel/ssr.
              if (/[:*]/.test(route.path)) return null;
              const html = await Promise.resolve(App({ path: route.path, params: route.params ?? {} }));
              const content = (injectIntoTemplate ?? ((t: string, h: string) => t.replace('<!--ssr-outlet-->', h)))(
                template,
                html,
              );
              const file = route.path === '/'
                ? 'index.html'
                : `${route.path.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
              const outPath = path.join(outDir, file);
              await fs.ensureDir(path.dirname(outPath));
              await fs.writeFile(outPath, content, 'utf8');
              return { file, content };
            }),
          )
        ).filter((p): p is { file: string; content: string } => p !== null)
      : await staticExport({ routes: config.routes, App, template, outDir });

    for (const page of pages) {
      console.log(kleur.green(`  ✓ ${page.file}`));
    }

    console.log(kleur.green(`\nStatic export complete → ${outDir}`));
  });

// ── `jorvel ssr serve` ─────────────────────────────────────────────────────────

const serveCommand = new Command('serve')
  .description('Start a Node.js SSR server for the host app')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('-p, --port <port>', 'Port to listen on (overrides jorvel.ssr.json)', '3000')
  .option('--stream', 'Use React 18 streaming SSR when available (recommended)', true)
  .option('--no-stream', 'Disable streaming SSR and render to string')
  .option('-c, --config <path>', 'Path to jorvel.ssr.json')
  .option('--static <dir>', 'Serve built client assets from this dir (e.g. apps/shell/dist) so hydration bundles resolve')
  .action(async (opts: { dir: string; port: string; config?: string; stream?: boolean; static?: string }) => {
    const workspaceDir = path.resolve(opts.dir);
    const port = Number(opts.port);

    const configPath = opts.config
      ? path.resolve(opts.config)
      : path.join(workspaceDir, 'jorvel.ssr.json');

    if (!(await fs.pathExists(configPath))) {
      printCliError(new Error(`No SSR config found at ${configPath}`), {
        command: 'ssr serve',
        hint: 'Create a jorvel.ssr.json with { app, template, routes, outDir }.',
      });
      return;
    }

    const config = (await fs.readJson(configPath)) as SsrConfig;
    const listenPort = port || config.port || 3000;

    const templatePath = path.resolve(workspaceDir, config.template);
    if (!(await fs.pathExists(templatePath))) {
  printCliError(new Error(`Template not found: ${templatePath}`), { command: 'ssr serve' });
      return;
    }
    const template = await fs.readFile(templatePath, 'utf8');

    const appModulePath = path.resolve(workspaceDir, config.app);
    let App: any;
    try {
      await withWorkspaceNodePath(workspaceDir, async () => {
        const appMod = await loadUserAppModule(appModulePath);
        App = appMod.default ?? appMod.App;
      });
      if (!App) throw new Error(`App module has no default export.`);
    } catch (e) {
      printCliError(e, {
        command: 'ssr serve',
        hint: 'SSR app module must be a built JavaScript file (ESM or CJS). TypeScript is not transpiled at runtime.',
      });
      return;
    }

    let createEdgeAdapter: (opts: any) => (req: any) => Promise<any>;
    let renderRouteToStream: ((App: any, route: any) => any) | null = null;
    try {
      const ssrMod = await import('@jorvel/ssr');
      createEdgeAdapter = ssrMod.createEdgeAdapter;
      renderRouteToStream = typeof ssrMod.renderRouteToStream === 'function' ? ssrMod.renderRouteToStream : null;
    } catch {
      printCliError(new Error('@jorvel/ssr not found.'), {
        command: 'ssr serve',
        hint: 'Install it: pnpm add -D @jorvel/ssr',
      });
      return;
    }

    const handler = createEdgeAdapter({ App, template, routes: config.routes });

    const useStreaming = opts.stream !== false && !!renderRouteToStream;

    // Detect a raw-HTML-string App ONCE — not per request. Calling App() on every
    // request re-invokes the component (throws "invalid hook call" for hook-using
    // components, turning every request into a 500) and double-runs side effects.
    let isStringApp = false;
    try {
      isStringApp = typeof App === 'function' && typeof App({ path: '/', params: {} }) === 'string';
    } catch {
      isStringApp = false; // a throwing App is a React component, not a string app
    }

    // Optional static asset root (built client bundles) so hydration JS resolves.
    const staticRoot = opts.static ? path.resolve(workspaceDir, opts.static) : null;

    const server = http.createServer(async (req, res) => {
      const url = `http://localhost:${listenPort}${req.url ?? '/'}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers[k] = v;
      }

      try {
        // Serve a static asset when the path looks like a file and exists under
        // the static root (path-traversal-guarded). Falls through to SSR otherwise.
        if (staticRoot && (req.method === 'GET' || req.method === 'HEAD')) {
          const served = await tryServeStatic(staticRoot, new URL(url).pathname, req.method, res);
          if (served) return;
        }

        // If the App returns a raw HTML string, use the edge-adapter path.
        if (isStringApp) {
          const response = await handler({ url, method: req.method ?? 'GET', headers });
          for (const [k, v] of Object.entries(response.headers)) res.setHeader(k, String(v));
          res.statusCode = response.status;
          res.end(response.body);
          return;
        }

        if (useStreaming && req.method !== 'HEAD') {
          const pathname = new URL(url).pathname;
          const result = renderRouteToStream!(App, { path: pathname });

          await result.shellReady;
          res.statusCode = result.statusCode;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.setHeader('x-jorvel-ssr', '1');
          result.pipe(res);
          await result.allReady;
          return;
        }

        // Fallback: edge-adapter string render.
        const response = await handler({ url, method: req.method ?? 'GET', headers });
        for (const [k, v] of Object.entries(response.headers)) res.setHeader(k, String(v));
        res.statusCode = response.status;
        res.end(response.body);
      } catch (e) {
        res.statusCode = 500;
        res.end(`<pre>SSR error: ${e instanceof Error ? e.message : e}</pre>`);
      }
    });

    server.listen(listenPort, () => {
      console.log(
        kleur.green(
          `\n🚀 JORVEL SSR server running at http://localhost:${listenPort} (${useStreaming ? 'streaming' : 'string'} mode)`
        )
      );
    });

    const shutdown = () => {
      console.log(kleur.yellow('\nShutting down SSR server...'));
      server.close((err) => {
        if (err) {
          console.error(kleur.red(`Failed to close server cleanly: ${err.message}`));
          process.exitCode = 1;
          return;
        }
        // Let Node exit naturally so stdout/stderr flush and pending promises settle.
        process.exitCode = process.exitCode ?? 0;
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });

// ── Export ────────────────────────────────────────────────────────────────────

export const ssrCommand = new Command('ssr')
  .description('Server-side rendering and static export utilities')
  .addCommand(exportCommand)
  .addCommand(serveCommand);
