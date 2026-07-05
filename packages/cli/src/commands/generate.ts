import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import kleur from 'kleur';
import { input, confirm, checkbox, number, select } from '@inquirer/prompts';
import { JorvelCliError } from '../errors.js';
import { findHostApp } from '../discovery.js';
import { writeRemotesDts } from '../remotes-dts.js';
import { attachStorybook } from './generate-storybook.js';
import {
  FRAMEWORK_CHOICES,
  getFrameworkSpec,
  isFrameworkId,
  type FrameworkId,
} from '../frameworks/registry.js';
import { scaffoldFrameworkRemote } from '../frameworks/scaffold.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(HERE, '../../templates');

type TailwindMode = 'off' | 'on';
export type AppLang = 'ts' | 'js';

/**
 * Version range for `@jorvel/*` deps in GENERATED apps. Uses a published semver
 * (not `workspace:*`) so scaffolded apps install from npm for external users;
 * in this monorepo, `link-workspace-packages` (see .npmrc) links the local copy.
 */
export const JORVEL_DEP_VERSION = '^0.3.0';

function langExts(lang: AppLang) {
  return {
    /** Component file extension (JSX-bearing). */
    component: lang === 'ts' ? 'tsx' : 'jsx',
    /** Plain module extension (no JSX). */
    module: lang === 'ts' ? 'ts' : 'js',
    /** Test file extension. */
    test: lang === 'ts' ? 'ts' : 'js',
  };
}

const APP_NAME_RE = /^[a-z][a-z0-9-]*$/;

function validateAppName(name: string): void {
  if (!APP_NAME_RE.test(name)) {
    throw new JorvelCliError(
      `Invalid app name: "${name}".`,
      {
        code: 'GEN-001',
        hint: 'Names must be lowercase ASCII, start with a letter, and contain only letters, digits, and hyphens (e.g. "shell", "user-portal").',
      },
    );
  }
}

function parsePort(raw: string | number, _def: number): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new JorvelCliError(`Invalid port: ${raw}`, {
      code: 'GEN-002',
      hint: 'Port must be an integer between 1 and 65535.',
    });
  }
  return n;
}

async function writeJson(filePath: string, obj: unknown) {
  await fs.outputFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function toKebab(name: string) {
  return name
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .toLowerCase();
}

async function ensureDirIsCreatable(dir: string) {
  const exists = await fs.pathExists(dir);
  if (!exists) return;

  const entries = await fs.readdir(dir);
  if (entries.length === 0) return;

  throw new JorvelCliError(`Target directory is not empty: ${dir}`, {
    code: 'GEN-003',
    hint: 'Choose a different name or remove the existing directory.',
  });
}

async function scaffoldReactRspackApp(
  appDir: string,
  name: string,
  port: number,
  tailwind: TailwindMode,
  lang: AppLang = 'ts',
) {
  validateAppName(name);
  await fs.ensureDir(path.join(appDir, 'src'));

  // After validateAppName, `name` is regex-safe — but we still pass values
  // through JSON.stringify for any spot where they land in JS source so the
  // template stays defensive against future name-relaxation.
  const nameJs = JSON.stringify(name);
  const exts = langExts(lang);
  const isTs = lang === 'ts';

  const baseScripts: Record<string, string> = {
    // Dev
    dev: 'rspack serve',
    start: 'rspack serve --mode production',

    // Build
    build: 'rspack build',
    // cross-env keeps NODE_ENV assignment working on Windows shells.
    'build:prod': 'cross-env NODE_ENV=production rspack build',
    preview: 'rspack serve --mode production',
    // Cross-platform clean (no `rm -rf` — fails on Windows shells).
    clean: 'node -e "require(\'fs\').rmSync(\'dist\', { recursive: true, force: true })"',

    // Quality
    lint: 'eslint . --max-warnings=0',
    'lint:fix': 'eslint . --fix',
    format: 'prettier --write "src/**/*.{ts,tsx,js,jsx,css,json,md}"',
    'format:check': 'prettier --check "src/**/*.{ts,tsx,js,jsx,css,json,md}"',

    // Tests (--passWithNoTests so a host with no page tests never fails CI)
    test: 'vitest run --passWithNoTests',
    'test:watch': 'vitest',
    'test:coverage': 'vitest run --coverage',
    'test:ui': 'vitest --ui',
  };
  // Typecheck only meaningful for TS apps.
  if (isTs) {
    baseScripts['typecheck'] = 'tsc --noEmit';
  }

  const baseDevDeps: Record<string, string> = {
    '@rspack/cli': '^1.5.0',
    '@rspack/core': '^1.5.0',
    '@rspack/dev-server': '^1.1.0',
    '@rspack/plugin-react-refresh': '^1.0.0',
    'react-refresh': '^0.14.2',
    '@jorvel/eslint-config': '^0.1.0',
    '@jorvel/prettier-config': '^0.1.0',
    '@vitest/coverage-v8': '^2.1.9',
    '@testing-library/react': '^16.1.0',
    '@testing-library/dom': '^10.4.0',
    '@testing-library/jest-dom': '^6.6.3',
    '@testing-library/user-event': '^14.5.2',
    msw: '^2.7.0',
    jsdom: '^25.0.1',
    'cross-env': '^7.0.3',
    eslint: '^9.20.0',
    prettier: '^3.4.2',
    vitest: '^2.1.9',
  };
  if (isTs) {
    baseDevDeps['@types/react'] = '^18.3.12';
    baseDevDeps['@types/react-dom'] = '^18.3.1';
    baseDevDeps['typescript'] = '^5.7.3';
  }

  const pkg: Record<string, unknown> = {
    name: `@app/${name}`,
    private: true,
    type: 'module',
    scripts: baseScripts,
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      '@jorvel/event-bus': JORVEL_DEP_VERSION,
      '@jorvel/runtime': JORVEL_DEP_VERSION,
    },
    devDependencies: baseDevDeps,
    prettier: '@jorvel/prettier-config',
  };

  if (tailwind === 'on') {
    pkg['devDependencies'] = {
      ...(pkg['devDependencies'] as Record<string, string>),
      tailwindcss: '^4.0.0',
      '@tailwindcss/postcss': '^4.0.0',
      postcss: '^8.5.1',
      'postcss-loader': '^8.1.1',
    };
  }

  await writeJson(path.join(appDir, 'package.json'), pkg);

  if (isTs) {
    await writeJson(path.join(appDir, 'tsconfig.json'), {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        jsx: 'react-jsx',
        allowImportingTsExtensions: true,
        // The host imports `../jorvel.routes.host.json` — needs JSON resolution
        // for `pnpm typecheck` to pass out of the box.
        resolveJsonModule: true,
        noEmit: true,
        types: [],
      },
      include: ['src'],
    });
  } else {
    // jsconfig gives IDEs the same module/jsx resolution hints without a TS toolchain.
    await writeJson(path.join(appDir, 'jsconfig.json'), {
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        checkJs: false,
        allowJs: true,
        baseUrl: '.',
      },
      include: ['src'],
    });
  }

  // ESLint flat config — extends shared @jorvel/eslint-config
  await fs.outputFile(
    path.join(appDir, 'eslint.config.mjs'),
    [
      "import jorvel from '@jorvel/eslint-config';",
      '',
      'export default [',
      '  ...jorvel,',
      '  {',
      "    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],",
      '  },',
      '];',
      '',
    ].join('\n'),
    'utf8',
  );

  // Prettier ignore
  await fs.outputFile(
    path.join(appDir, '.prettierignore'),
    ['dist', 'coverage', 'node_modules', '*.tsbuildinfo', ''].join('\n'),
    'utf8',
  );

  // Vitest config — jsdom env for React tests + coverage defaults
  const vitestExt = isTs ? 'ts' : 'js';
  const includeGlob = isTs ? '{ts,tsx}' : '{js,jsx}';
  const excludeDts = isTs ? "'src/**/*.d.ts'" : "'src/**/*.config.js'";
  await fs.outputFile(
    path.join(appDir, `vitest.config.${vitestExt}`),
    [
      "import { defineConfig } from 'vitest/config';",
      '',
      'export default defineConfig({',
      '  test: {',
      "    environment: 'jsdom',",
      '    globals: true,',
      `    setupFiles: ['./vitest.setup.${vitestExt}'],`,
      `    include: ['src/**/*.{test,spec}.${includeGlob}'],`,
      '    coverage: {',
      "      provider: 'v8',",
      "      reporter: ['text', 'html', 'lcov'],",
      `      include: ['src/**/*.${includeGlob}'],`,
      `      exclude: ['src/**/*.{test,spec}.${includeGlob}', ${excludeDts}],`,
      '    },',
      '  },',
      '});',
      '',
    ].join('\n'),
    'utf8',
  );

  // Vitest setup — registers jest-dom matchers (toBeInTheDocument, etc.) and
  // auto-cleans the DOM between React Testing Library renders.
  await fs.outputFile(
    path.join(appDir, `vitest.setup.${vitestExt}`),
    [
      "import '@testing-library/jest-dom/vitest';",
      "import { afterEach, afterAll, beforeAll } from 'vitest';",
      "import { cleanup } from '@testing-library/react';",
      "import { server } from './src/mocks/server.js';",
      '',
      '// MSW: intercept network in tests. Handlers live in src/mocks/handlers.',
      "beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));",
      'afterEach(() => {',
      '  cleanup();',
      '  server.resetHandlers();',
      '});',
      'afterAll(() => server.close());',
      '',
    ].join('\n'),
    'utf8',
  );

  // MSW mocks — handlers + a node server (tests) + a browser worker (dev).
  await fs.outputFile(
    path.join(appDir, `src/mocks/handlers.${exts.test}`),
    [
      "import { http, HttpResponse } from 'msw';",
      '',
      'export const handlers = [',
      "  http.get('/api/health', () => HttpResponse.json({ ok: true })),",
      '];',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.outputFile(
    path.join(appDir, `src/mocks/server.${exts.test}`),
    [
      "import { setupServer } from 'msw/node';",
      "import { handlers } from './handlers.js';",
      '',
      'export const server = setupServer(...handlers);',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.outputFile(
    path.join(appDir, `src/mocks/browser.${exts.test}`),
    [
      "import { setupWorker } from 'msw/browser';",
      "import { handlers } from './handlers.js';",
      '',
      '// In dev: await worker.start() before rendering to mock APIs in the browser.',
      'export const worker = setupWorker(...handlers);',
      '',
    ].join('\n'),
    'utf8',
  );

  // CSS Modules example — Rspack handles *.module.css out of the box.
  await fs.outputFile(
    path.join(appDir, 'src/components/Card.module.css'),
    [
      '.card {',
      '  padding: 16px;',
      '  border: 1px solid var(--color-border, #e5e7eb);',
      '  border-radius: 8px;',
      '}',
      '.title { margin: 0 0 8px; font-weight: 600; }',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.outputFile(
    path.join(appDir, `src/components/Card.${exts.component}`),
    [
      "import React from 'react';",
      "import styles from './Card.module.css';",
      '',
      isTs
        ? 'export function Card({ title, children }: { title: string; children?: React.ReactNode }) {'
        : 'export function Card({ title, children }) {',
      '  return (',
      '    <div className={styles.card}>',
      '      <h3 className={styles.title}>{title}</h3>',
      '      {children}',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  // A REAL React Testing Library test (not `expect(1+1)`) — renders the home
  // page and asserts on the DOM, so a fresh scaffold ships a working example to
  // copy from. Component lives at src/pages/index.<ext> (written below).
  await fs.outputFile(
    path.join(appDir, `src/pages/index.test.${exts.component}`),
    [
      "import { render, screen } from '@testing-library/react';",
      "import { describe, expect, it } from 'vitest';",
      "import HomePage from './index.js';",
      '',
      `describe('${name} — HomePage', () => {`,
      "  it('renders the starter heading', () => {",
      '    render(<HomePage />);',
      "    expect(screen.getByRole('heading', { name: /it works/i })).toBeInTheDocument();",
      '  });',
      '',
      "  it('the counter button is interactive', async () => {",
      '    render(<HomePage />);',
      "    const btn = screen.getByRole('button');",
      "    expect(btn).toHaveTextContent(/clicked 0 times/i);",
      '  });',
      '});',
      '',
    ].join('\n'),
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'index.html'),
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <link rel="icon" type="image/png" href="/logojorvel.png" />\n    <link rel="icon" type="image/x-icon" href="/favicon.ico" />\n    <link rel="apple-touch-icon" href="/logojorvel.png" />\n    <meta name="description" content="${name} — built with JORVEL" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n`,
    'utf8',
  );

  // Per-app public assets: favicon (mandatory) + workspace logo (best-effort copy from
  // ../../assets/ when running inside an init'ed workspace).
  await fs.ensureDir(path.join(appDir, 'public'));
  const sharedFavicon = path.join(TEMPLATES_DIR, 'assets', 'favicon.ico');
  if (await fs.pathExists(sharedFavicon)) {
    await fs.copyFile(sharedFavicon, path.join(appDir, 'public', 'favicon.ico'));
  }
  // The current JORVEL logo (logojorvel.png) — used by index.html favicon + the
  // welcome screen. (The old logo.svg / logo-light.svg are intentionally not
  // shipped; logojorvel.png is the single source of brand truth.)
  const sharedLogoPng = path.join(TEMPLATES_DIR, 'assets', 'logojorvel.png');
  if (await fs.pathExists(sharedLogoPng)) {
    await fs.copyFile(sharedLogoPng, path.join(appDir, 'public', 'logojorvel.png'));
  }

  // Per-app README — scripts table + dev/build/test usage. Links back to the
  // workspace logo so the page looks branded on GitHub.
  await fs.outputFile(
    path.join(appDir, 'README.md'),
    [
      '<p align="center">',
      '  <img src="../../assets/logojorvel.png" alt="' + name + '" width="120" height="120">',
      '</p>',
      '',
      '<h1 align="center">@app/' + name + '</h1>',
      '',
      '<p align="center">Generated by <a href="https://jorveljs.vercel.app">JORVEL</a> on port <code>' + port + '</code>.</p>',
      '',
      '---',
      '',
      '## Scripts',
      '',
      '| Command | Purpose |',
      '| --- | --- |',
      '| `pnpm dev` | Rspack dev server with HMR |',
      '| `pnpm start` | Production-mode preview server |',
      '| `pnpm build` | Production build into `dist/` |',
      '| `pnpm build:prod` | Build with `NODE_ENV=production` |',
      '| `pnpm preview` | Serve the production bundle locally |',
      '| `pnpm clean` | Remove `dist/` |',
      '| `pnpm typecheck` | `tsc --noEmit` |',
      '| `pnpm lint` | ESLint, fail on any warning |',
      '| `pnpm lint:fix` | ESLint with `--fix` |',
      '| `pnpm format` | Prettier write `src/` |',
      '| `pnpm format:check` | Prettier check `src/` |',
      '| `pnpm test` | Vitest, single run |',
      '| `pnpm test:watch` | Vitest in watch mode |',
      '| `pnpm test:coverage` | Vitest with v8 coverage (html + lcov) |',
      '| `pnpm test:ui` | Vitest UI |',
      '',
      '## Layout',
      '',
      '```',
      'apps/' + name + '/',
      '├── public/                  # static assets (favicon, logo)',
      '├── src/',
      '│   ├── error-boundary.' + exts.component + '   # top-level React error boundary',
      '│   ├── pages/',
      '│   │   ├── _error.' + exts.component + '       # dev stack / prod-safe crash screen',
      '│   │   ├── _404.' + exts.component + '         # default not-found page',
      '│   │   └── ...               # file-based routes (remote)',
      '│   ├── bootstrap.' + exts.component + '       # wires ErrorBoundary + 404 fallthrough',
      '│   └── main.' + exts.component + '',
      '├── jorvel.app.json',
      '└── rspack.config.mjs',
      '```',
      '',
      '## Error + 404 pages',
      '',
      'Both pages live under `src/pages/`:',
      '',
      '- `src/pages/_error.' + exts.component + '` — shown when the top-level `<ErrorBoundary>` (see `src/error-boundary.' + exts.component + '`) catches a render error. In `NODE_ENV !== "production"` the full stack is inlined; production renders a brand-safe message.',
      '- `src/pages/_404.' + exts.component + '` — shown when the current URL is not matched by any entry in `jorvel.routes.host.json`.',
      '',
      'Both files are part of your app — edit them directly. See [the docs](https://jorveljs.vercel.app/docs/error-pages) for override patterns.',
      '',
      '## Getting started',
      '',
      '```sh',
      'pnpm install        # from the workspace root, once',
      'pnpm dev            # this app on http://localhost:' + port + ' (Rspack dev server + HMR)',
      '```',
      '',
      'Run the whole workspace (host + all remotes) from the root instead:',
      '',
      '```sh',
      'jorvel dev --proxy-remotes --hmr-remotes',
      '```',
      '',
      '## Development',
      '',
      '- `pnpm dev` — start the dev server with hot reload.',
      '- Add pages under `src/pages/` (file-based: `index`, `[id]`, `(group)/`), then run `jorvel routes` (or `jorvel routes --watch`) to regenerate the route table.',
      '- Wire a database with `jorvel add db`, or Storybook with `jorvel generate storybook`.',
      '',
      '## Production build',
      '',
      '```sh',
      'pnpm build          # bundle into dist/ (content-hashed assets)',
      'pnpm start          # preview the production build locally',
      '```',
      '',
      '## Testing & quality',
      '',
      '```sh',
      'pnpm test           # Vitest (jsdom + React Testing Library)',
      'pnpm test:watch     # watch mode',
      'pnpm test:coverage  # v8 coverage → text + html + lcov',
      'pnpm typecheck      # tsc --noEmit',
      'pnpm lint           # ESLint (fail on warnings)   ·   pnpm format',
      '```',
      '',
      '## Deploy',
      '',
      '```sh',
      'jorvel build',
      'jorvel deploy --target vercel   # vercel | cloudflare | node | docker | bun | deno | netlify | github-pages',
      '```',
      '',
      'Full guide → https://jorveljs.vercel.app/docs',
      '',
    ].join('\n'),
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'rspack.config.mjs'),
    `import { rspack } from '@rspack/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';

// Resolve relative to this config file so federation config is found regardless
// of where the dev server was invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const federationFile = process.env.JORVEL_FEDERATION_FILE || 'jorvel.federation.json';
const federationPath = path.join(__dirname, federationFile);
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

const onDemandStarterUrl = process.env.JORVEL_ON_DEMAND_STARTER_URL || '';
const onDemandMiddleware = process.env.JORVEL_ON_DEMAND_MIDDLEWARE === '1';

const proxy = federation?.remotes
  ? Object.entries(federation.remotes).map(([remoteName, spec]) => {
      const at = String(spec).indexOf('@');
      const entryUrl = at >= 0 ? String(spec).slice(at + 1) : String(spec);
      // Compute the origin (origin + path-without-trailing-filename).
      let target;
      try {
        const u = new URL(entryUrl);
        target = u.origin;
      } catch {
        target = entryUrl.replace(/\\/[^/]+$/, '');
      }
      const ctxBase = '/jorvel/remotes/' + remoteName;
      return {
        context: [ctxBase],
        target,
        onProxyReq: () => {
          if (!onDemandMiddleware) return;
          if (!onDemandStarterUrl) return;
          try {
            http
              .get(
                onDemandStarterUrl + '/__jorvel/start-remote?name=' + encodeURIComponent(remoteName)
              )
              .on('error', () => {});
          } catch { /* ignore */ }
        },
        changeOrigin: true,
        pathRewrite: { ['^' + ctxBase]: '' }
      };
    })
  : [];

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  entry: {
    main: ['./src/mf-shim.js', './src/main.${exts.component}'],
  },
  // Rspack >=1.7: lazyCompilation is a top-level option; experiments.lazyCompilation
  // is deprecated. Lazy compilation proxies break eager shared modules (the react
  // factory comes back undefined), so it's disabled.
  lazyCompilation: false,
  experiments: {
    css: true,
  },
  devServer: {
    port: ${port},
    hot: true,
    liveReload: false,
    static: [
      { directory: path.join(__dirname, 'public') },
      { directory: __dirname },
    ],
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        {
          from: /^\\/(src|@fs)\\//,
          to: (context) => context.parsedUrl.pathname,
        },
        {
          from: /\\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,
          to: (context) => context.parsedUrl.pathname,
        },
        { from: /./, to: '/index.html' },
      ],
    },
    proxy,
  },
  output: {
    uniqueName: ${nameJs},
    publicPath: 'auto',
    filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: process.env.NODE_ENV === 'production' ? '[id].[contenthash:8].js' : '[id].js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'],
    extensionAlias: {
      '.js': ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'],
    },
  },
  module: {
    rules: [${tailwind === 'on' ? "\n      { test: /\\.css$/, use: ['postcss-loader'], type: 'css/auto' }," : ''}
      {
        test: /\\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', development: process.env.NODE_ENV !== 'production', refresh: process.env.NODE_ENV !== 'production' } }
          }
        }
      },
      {
        test: /\\.(js|jsx|mjs|cjs)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'ecmascript', jsx: true },
            transform: { react: { runtime: 'automatic', development: process.env.NODE_ENV !== 'production', refresh: process.env.NODE_ENV !== 'production' } }
          }
        }
      }
    ]
  },
  plugins: [
    // Rspack 1.x removed builtins.define — use the DefinePlugin. These keys are
    // matched as exact member expressions, so client code must read them as
    // \`import.meta.env.JORVEL_*\` (no optional chaining, which produces an AST
    // the plugin won't match).
    new rspack.DefinePlugin({
      'import.meta.env.JORVEL_FEDERATION_FILE': JSON.stringify(process.env.JORVEL_FEDERATION_FILE || ''),
      'import.meta.env.JORVEL_DEV_RELOAD_URL': JSON.stringify(process.env.JORVEL_DEV_RELOAD_URL || ''),
      'import.meta.env.JORVEL_ON_DEMAND_STARTER_URL': JSON.stringify(process.env.JORVEL_ON_DEMAND_STARTER_URL || ''),
    }),
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
    ...(process.env.NODE_ENV !== 'production' ? [new ReactRefreshPlugin()] : []),
    ...(federation
      ? [
          new rspack.container.ModuleFederationPlugin({
            name: federation.name,
            filename: federation.filename,
            exposes: federation.exposes,
            remotes: federation.remotes,
            shared: federation.shared
          })
        ]
      : [])
  ]
};\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, `src/main.${exts.component}`),
    `// Async boundary — keeps all imports deferred until Module Federation has\n// initialized the shared scope. Without this, shared deps (react, etc.) are\n// required synchronously before MF registers the singleton, causing\n// RUNTIME-006 (loadShareSync failure).\n${tailwind === 'on' ? "import './styles.css';\n" : ''}import('./bootstrap');\n`,
    'utf8',
  );

  if (tailwind === 'on') {
    // Tailwind CSS v4 — CSS-first. `@import "tailwindcss"` + the @tailwindcss/postcss
    // plugin; content is auto-detected (no tailwind.config needed).
    await fs.outputFile(
      path.join(appDir, 'src/styles.css'),
      '@import "tailwindcss";\n',
      'utf8',
    );

    await fs.outputFile(
      path.join(appDir, 'postcss.config.cjs'),
      ['module.exports = {', '  plugins: {', "    '@tailwindcss/postcss': {},", '  },', '};', ''].join('\n'),
      'utf8',
    );
  }

  const rootSelector = isTs
    ? "document.getElementById('root')!"
    : "document.getElementById('root')";
  await fs.outputFile(
    path.join(appDir, `src/bootstrap.${exts.component}`),
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\n\nfunction App() {\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>${name}</h1>\n      <p>Generated by jorvel</p>\n    </div>\n  );\n}\n\nReactDOM.createRoot(${rootSelector}).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'src/mf-shim.js'),
    `// MF share-scope shim — AUTO-GENERATED by \`jorvel generate\`. Do not edit.\n// Bridges Rspack federation globals to webpack-style globals so React singletons\n// are resolved from the shared scope before any component code executes.\n(function jorvelFederationShim() {\n  const g =\n    typeof globalThis !== 'undefined' ? globalThis\n    : typeof window !== 'undefined' ? window\n    : typeof self !== 'undefined' ? self : {};\n  try {\n    if (typeof g.__federation_init_sharing__ === 'function') {\n      g.__webpack_init_sharing__ = async (scope) => g.__federation_init_sharing__(scope);\n    }\n    if (g.__federation_shared__) {\n      const expected = g.__federation_shared__;\n      if (g.__webpack_share_scopes__?.default !== expected) {\n        g.__webpack_share_scopes__ = { default: expected };\n      }\n    }\n  } catch { /* best-effort */ }\n})();\n`,
    'utf8',
  );
}

async function addRemoteEntrypoint(appDir: string, name: string, lang: AppLang = 'ts') {
  validateAppName(name);
  await fs.ensureDir(path.join(appDir, 'src/pages'));
  const exts = langExts(lang);
  const isTs = lang === 'ts';

  // Remote gets its own error + 404 components — useful when running the
  // remote stand-alone via `rspack serve`. Host bootstrap also pulls them in.
  await writeErrorAndNotFoundPages(appDir, lang);

  await fs.outputFile(
    path.join(appDir, `src/pages/index.${exts.component}`),
    `import React from 'react';

const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.25rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' };
const badge: React.CSSProperties = { display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '4px 11px', borderRadius: 999 };
const card: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', background: '#fff' };
const btn: React.CSSProperties = { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#6366f1,#22d3ee)', fontSize: 15 };

const FEATURES: Array<[string, string]> = [
  ['File-based routing', 'Drop a file in src/pages/ — it becomes a route.'],
  ['Federated at runtime', 'The host loads this remote over Module Federation.'],
  ['Crash-isolated', 'A render error shows a boundary, never white-screens the app.'],
];

/** ${name} — home route ("/"). Edit this file; it hot-reloads. */
export default function HomePage() {
  const [count, setCount] = React.useState(0);
  return (
    <div style={wrap}>
      <span style={badge}>${name} · remote</span>
      <h1 style={{ fontSize: '2.1rem', lineHeight: 1.15, margin: '16px 0 8px' }}>It works! 🎉</h1>
      <p style={{ color: '#475569', fontSize: '1.06rem', margin: 0 }}>
        This page is served by the <strong>${name}</strong> remote and mounted into the host via
        Module Federation. Edit <code>src/pages/index.${exts.component}</code> and save — it hot-reloads.
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', margin: '28px 0' }}>
        {FEATURES.map(([title, desc]) => (
          <div key={title} style={card}>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => setCount((c) => c + 1)}>Clicked {count} time{count === 1 ? '' : 's'}</button>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>← live React state, proving it&apos;s a real running app</span>
      </div>
    </div>
  );
}
`,
    'utf8',
  );

  const routesBody = isTs
    ? `// THIS FILE IS AUTO-GENERATED by \`jorvel routes\`.\n// Starter routes — regenerate after adding files under src/pages/.\nimport type { RemotePageRoute } from '@jorvel/runtime';\n\nexport const pages: RemotePageRoute[] = [\n  { path: '/', load: () => import('./pages/index.tsx') },\n];\n\nexport default pages;\n`
    : `// THIS FILE IS AUTO-GENERATED by \`jorvel routes\`.\n// Starter routes — regenerate after adding files under src/pages/.\n\nexport const pages = [\n  { path: '/', load: () => import('./pages/index.jsx') },\n];\n\nexport default pages;\n`;
  await fs.outputFile(
    path.join(appDir, `src/jorvel.routes.${exts.module}`),
    routesBody,
    'utf8',
  );

  const propsSig = isTs ? '({ subpath = \'/\' }: { subpath?: string })' : '({ subpath = \'/\' })';
  await fs.outputFile(
    path.join(appDir, `src/remote.${exts.component}`),
    `import React from 'react';\nimport { RemoteApp, getFederatedRouter } from '@jorvel/runtime';\nimport { pages } from './jorvel.routes.js';\n\nexport default function RemoteRoot${propsSig} {\n  const router = getFederatedRouter();\n\n  return (\n    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>\n      <header style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>\n        <h2 style={{ margin: 0 }}>${name} (remote)</h2>\n        <span style={{ fontSize: 12, opacity: 0.75 }}>shared router via <code>getFederatedRouter()</code></span>\n      </header>\n\n      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>\n        <button type="button" onClick={() => router.navigate('/')}>Go host home</button>\n        <button\n          type="button"\n          onClick={() => router.navigate('/${name}/settings')}\n          title="Example of host navigation from inside a remote"\n        >\n          Go to /${name}/settings\n        </button>\n      </div>\n\n      <RemoteApp subpath={subpath} pages={pages} />\n    </div>\n  );\n}\n`,
    'utf8',
  );
}

async function writeErrorAndNotFoundPages(appDir: string, lang: AppLang) {
  const exts = langExts(lang);
  const isTs = lang === 'ts';
  await fs.ensureDir(path.join(appDir, 'src', 'pages'));

  // ── ErrorBoundary class component ─────────────────────────────────────────
  const errorBoundary = isTs
    ? `import React from 'react';
import { ErrorPage } from './pages/_error';

interface Props {
  children: React.ReactNode;
  /** Optional override. Defaults to the local pages/_error component. */
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches synchronous render errors anywhere below
 * and renders the local <ErrorPage>. Replace pages/_error.tsx to customize the
 * crash screen without touching this file.
 *
 * Async errors (promise rejections, event handlers) are not caught here —
 * use \`window.addEventListener('unhandledrejection', ...)\` for those.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Stack stays in the console for the React DevTools overlay.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      const Fallback = this.props.fallback ?? ErrorPage;
      return <Fallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
`
    : `import React from 'react';
import { ErrorPage } from './pages/_error';

/**
 * Top-level error boundary. Catches synchronous render errors anywhere below
 * and renders the local <ErrorPage>. Replace pages/_error.jsx to customize the
 * crash screen without touching this file.
 *
 * Async errors (promise rejections, event handlers) are not caught here —
 * use \`window.addEventListener('unhandledrejection', ...)\` for those.
 */
export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const Fallback = this.props.fallback ?? ErrorPage;
      return <Fallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
`;
  await fs.outputFile(
    path.join(appDir, `src/error-boundary.${exts.component}`),
    errorBoundary,
    'utf8',
  );

  // ── _error.tsx / _error.jsx ────────────────────────────────────────────────
  const errorPagePropsSig = isTs
    ? `({ error, reset }: { error: Error; reset?: () => void })`
    : `({ error, reset })`;
  const errorPage = `import React from 'react';

// Rspack replaces \`process.env.NODE_ENV\` at build time (optimization.nodeEnv
// defaults to \`mode\`), so this is a static boolean in the bundle. The old
// \`typeof process !== 'undefined' ? … : true\` form was NOT replaced in the
// browser (where \`typeof process\` is 'undefined') and so leaked the dev crash
// screen + full stack traces into production builds.
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Default crash screen. In development this shows the full message + stack so
 * you can fix the bug without leaving the browser. In production it falls back
 * to a generic, brand-safe message.
 *
 * Override by editing this file — it is yours, not a framework dependency.
 */
export function ErrorPage${errorPagePropsSig} {
  return (
    <main
      role="alert"
      style={{
        minHeight: '100vh',
        padding: '48px 32px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: IS_DEV ? '#1f1023' : '#fafafa',
        color: IS_DEV ? '#fbe2ec' : '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 999,
            background: IS_DEV ? '#7f1d1d' : '#e5e7eb',
            color: IS_DEV ? '#fee2e2' : '#374151',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {IS_DEV ? 'Runtime error · development' : 'Something went wrong'}
        </div>

        <h1
          style={{
            marginTop: 16,
            fontSize: 32,
            lineHeight: 1.15,
            fontWeight: 700,
          }}
        >
          {IS_DEV ? error.message : "We hit an unexpected error."}
        </h1>

        {IS_DEV ? (
          <>
            <p style={{ opacity: 0.85, fontSize: 14, marginTop: 8 }}>
              The application threw during render. Fix the cause, save, and the dev
              server will reload automatically.
            </p>
            <pre
              style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 8,
                background: '#0f0a13',
                color: '#fcd9e6',
                overflowX: 'auto',
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.stack ?? String(error)}
            </pre>
          </>
        ) : (
          <p style={{ opacity: 0.75, marginTop: 12 }}>
            The error has been logged. Please refresh the page or return home.
          </p>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => (reset ? reset() : window.location.reload())}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: '#a3e635',
              color: '#0a0a0a',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid currentColor',
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 600,
            }}
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}

export default ErrorPage;
`;
  await fs.outputFile(
    path.join(appDir, `src/pages/_error.${exts.component}`),
    errorPage,
    'utf8',
  );

  // ── _404.tsx / _404.jsx ────────────────────────────────────────────────────
  const notFoundPropsSig = isTs
    ? `({ path }: { path?: string })`
    : `({ path })`;
  const notFound = `import React from 'react';

/**
 * Default 404 page. Rendered when no host route matches the current path.
 * Override by editing this file — it is yours.
 */
export function NotFoundPage${notFoundPropsSig} {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '64px 32px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'grid',
        placeItems: 'center',
        background: '#fafafa',
        color: '#0a0a0a',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 540 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: '#a3e635',
            marginBottom: 12,
            textTransform: 'uppercase',
          }}
        >
          404 · Not found
        </p>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: 0, fontWeight: 800 }}>
          This page does not exist.
        </h1>
        {path ? (
          <p style={{ marginTop: 16, opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>
            <code>{path}</code>
          </p>
        ) : null}
        <p style={{ marginTop: 16, opacity: 0.8 }}>
          The URL was not matched by any host route. If you expect a remote to
          handle it, make sure it is registered in <code>jorvel.routes.host.json</code>.
        </p>
        <div style={{ marginTop: 28, display: 'inline-flex', gap: 12 }}>
          <a
            href="/"
            style={{
              padding: '10px 18px',
              background: '#0a0a0a',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Go home
          </a>
          <a
            href="https://jorveljs.vercel.app/docs"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '10px 18px',
              border: '1px solid #0a0a0a',
              color: '#0a0a0a',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            JORVEL docs
          </a>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
`;
  await fs.outputFile(
    path.join(appDir, `src/pages/_404.${exts.component}`),
    notFound,
    'utf8',
  );

  // ── Override doc ───────────────────────────────────────────────────────────
  await fs.outputFile(
    path.join(appDir, 'src/pages/README.md'),
    [
      '# Error & 404 pages',
      '',
      'These two files are part of your app, not the framework. Edit them freely.',
      '',
      '| File | Renders when |',
      '| --- | --- |',
      '| `_error.' + exts.component + '` | An uncaught render error bubbles to the top-level `<ErrorBoundary>` (see `src/error-boundary.' + exts.component + '`). In `NODE_ENV !== "production"` the stack trace is shown inline. |',
      '| `_404.' + exts.component + '` | The current URL is not matched by any entry in `jorvel.routes.host.json`. |',
      '',
      '## Override',
      '',
      '- **Replace inline** — edit `_error.' + exts.component + '` or `_404.' + exts.component + '` directly. Both files use no framework imports beyond React.',
      '- **Swap component** — pass a custom `fallback` to the boundary:',
      '',
      '  ```' + (isTs ? 'tsx' : 'jsx') + '',
      "  <ErrorBoundary fallback={MyCustomErrorPage}>",
      '    <App />',
      '  </ErrorBoundary>',
      '  ```',
      '',
      '- **Disable the boundary** — remove `<ErrorBoundary>` from `bootstrap.' + exts.component + '` to fall back to React\'s default red-screen behavior in production builds.',
      '',
      '## Async errors',
      '',
      'React error boundaries only catch errors thrown during render. To capture',
      'promise rejections (data fetching, dynamic imports), add a global listener:',
      '',
      '```' + (isTs ? 'ts' : 'js') + '',
      "window.addEventListener('unhandledrejection', (event) => {",
      '  console.error(event.reason);',
      '});',
      '```',
      '',
    ].join('\n'),
    'utf8',
  );
}

async function addHostRemoteDemo(appDir: string, remoteName: string, lang: AppLang = 'ts') {
  validateAppName(remoteName);
  const exts = langExts(lang);
  const isTs = lang === 'ts';

  // Error + 404 pages — always scaffolded for the host shell.
  await writeErrorAndNotFoundPages(appDir, lang);

  // Ship the interactive Welcome screen as a sibling source file so the user
  // can customize or delete it without touching bootstrap.tsx.
  if (isTs) {
    const welcomeTemplate = await fs.readFile(
      path.join(TEMPLATES_DIR, 'welcome-screen.tsx'),
      'utf8',
    );
    await fs.outputFile(path.join(appDir, 'src/welcome.tsx'), welcomeTemplate, 'utf8');
  } else {
    // JS variant: simple welcome stub. The full TS Welcome template uses
    // interfaces + typed props and is not worth shipping a parallel JS copy.
    await fs.outputFile(
      path.join(appDir, 'src/welcome.jsx'),
      [
        "import React from 'react';",
        '',
        'export function Welcome({ defaultProjectName }) {',
        '  return (',
        '    <main style={{ padding: 48, fontFamily: \'system-ui, sans-serif\', maxWidth: 720 }}>',
        '      <h1>Welcome to {defaultProjectName}</h1>',
        '      <p>',
        '        This is the host shell. Edit <code>src/welcome.jsx</code> to replace this screen,',
        '        or remove the branch in <code>src/bootstrap.jsx</code> to route directly to a remote.',
        '      </p>',
        '      <p>',
        '        Docs: <a href="https://jorveljs.vercel.app">jorveljs.vercel.app</a>',
        '      </p>',
        '    </main>',
        '  );',
        '}',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  const hostName = path.basename(appDir);
  const importsHeader = isTs
    ? `import {\n  NavLink,\n  RemoteOutlet,\n  usePathname,\n  getRouter,\n  provideHostRouter,\n  connectJorvelDevReload,\n  type RouteTarget,\n} from '@jorvel/runtime';`
    : `import {\n  NavLink,\n  RemoteOutlet,\n  usePathname,\n  getRouter,\n  provideHostRouter,\n  connectJorvelDevReload,\n} from '@jorvel/runtime';`;
  const routesDecl = isTs
    ? 'const HOST_ROUTES: RouteTarget[] = (hostManifest as any).routes ?? [];'
    : 'const HOST_ROUTES = hostManifest.routes ?? [];';
  // No optional chaining: DefinePlugin replaces the exact member expression
  // `import.meta.env.JORVEL_DEV_RELOAD_URL` with a string literal, and the `?.`
  // form produces an AST the plugin won't match (leaving a runtime ReferenceError).
  const reloadUrlLine = isTs
    ? "const reloadUrl = (import.meta as any).env.JORVEL_DEV_RELOAD_URL;"
    : "const reloadUrl = import.meta.env.JORVEL_DEV_RELOAD_URL;";
  const rootSelector = isTs
    ? "document.getElementById('root')!"
    : "document.getElementById('root')";

  const matchHelperSig = isTs
    ? 'function matchesAnyHostRoute(pathname: string, routes: RouteTarget[]): boolean {'
    : 'function matchesAnyHostRoute(pathname, routes) {';

  const bootstrap = `import React from 'react';
import ReactDOM from 'react-dom/client';
${importsHeader}
import { Welcome } from './welcome';
import { ErrorBoundary } from './error-boundary';
import { NotFoundPage } from './pages/_404';

import hostManifest from '../jorvel.routes.host.json';

${routesDecl}

const REMOTES = {
  ${remoteName}: () => import('${remoteName}/App'),
};

provideHostRouter(getRouter());

${reloadUrlLine}
if (reloadUrl) connectJorvelDevReload({ url: reloadUrl });

/**
 * Returns true if any registered host route would handle the given pathname.
 * Patterns: "/x", "/x/*". Used to render the local 404 when nothing matches.
 */
${matchHelperSig}
  const norm = pathname.replace(/^\\/+/, '').replace(/\\/+$/, '');
  for (const r of routes) {
    const pattern = r.path.replace(/\\/\\*$/, '').replace(/^\\/+/, '');
    if (pattern === '') return true;
    if (norm === pattern) return true;
    if (norm.startsWith(pattern + '/')) return true;
  }
  return false;
}

function App() {
  const pathname = usePathname();

  // First-run welcome screen at the workspace root. Delete this branch (and
  // src/welcome.${exts.component}) once you're ready to ship your real shell home page.
  if (pathname === '/' || pathname === '') {
    return <Welcome defaultProjectName=${JSON.stringify(hostName)} />;
  }

  // No host route matches → render the local 404. Override in
  // src/pages/_404.${exts.component}.
  if (!matchesAnyHostRoute(pathname, HOST_ROUTES)) {
    return <NotFoundPage path={pathname} />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <header
        style={{
          background: '#111827',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>JORVEL Shell</span>
        <nav style={{ marginLeft: 16, display: 'flex', gap: 4 }}>
          <NavLink to="/" label="Home" />
          <NavLink to="/${remoteName}" label="${remoteName}" />
          <NavLink to="/${remoteName}/settings" label="Settings" />
        </nav>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>{pathname}</span>
      </header>
      <main style={{ padding: 24 }}>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(${rootSelector}).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
`;

  await fs.outputFile(path.join(appDir, `src/bootstrap.${exts.component}`), bootstrap, 'utf8');

  // Ambient declaration for the federated remote module so `import('<remote>/App')`
  // type-checks (MF resolves it at runtime; TS otherwise errors TS2307). Only
  // meaningful for TS hosts.
  if (isTs) {
    await fs.outputFile(
      path.join(appDir, 'src', 'remotes.d.ts'),
      [
        '// Type declarations for Module Federation remote modules.',
        "// Resolved at runtime by Rspack's federation plugin.",
        `declare module '${remoteName}/App' {`,
        "  import type React from 'react';",
        '  const RemoteApp: React.ComponentType<{ subpath?: string }>;',
        '  export default RemoteApp;',
        '}',
        '',
      ].join('\n'),
      'utf8',
    );
  }
}

interface CreateAppOptions {
  kind: 'host' | 'remote';
  defaultPort: number;
  postScaffold: (
    appDir: string,
    name: string,
    opts: { remoteName?: string; lang: AppLang },
  ) => Promise<void>;
  alsoWrite?: (appDir: string, name: string, port: number) => Promise<void>;
}

function parseLang(raw: string | undefined): AppLang {
  const v = (raw ?? 'ts').toLowerCase();
  if (v === 'ts' || v === 'typescript') return 'ts';
  if (v === 'js' || v === 'javascript') return 'js';
  throw new JorvelCliError(`Invalid --lang: "${raw}".`, {
    code: 'GEN-004',
    hint: "Use --lang ts (alias: typescript) or --lang js (alias: javascript). Default: ts.",
  });
}

/**
 * Resolve the remote framework. Hosts are always React. For remotes: honor an
 * explicit `--framework`, else prompt in an interactive terminal, else default
 * to React (non-interactive).
 */
async function resolveFramework(
  raw: string | undefined,
  kind: 'host' | 'remote',
): Promise<FrameworkId> {
  if (kind === 'host') return 'react';
  if (raw !== undefined) {
    const v = raw.toLowerCase();
    if (!isFrameworkId(v)) {
      throw new JorvelCliError(`Invalid --framework: "${raw}".`, {
        code: 'GEN-006',
        hint: 'Use one of: react, vue, solid, svelte, angular.',
      });
    }
    return v;
  }
  if (process.stdout.isTTY && process.stdin.isTTY) {
    return (await select({
      message: 'Which framework for this remote?',
      choices: FRAMEWORK_CHOICES,
      default: 'react',
    })) as FrameworkId;
  }
  return 'react';
}

/**
 * Resolve Tailwind: honor an explicit `--tailwind` / `--no-tailwind`, else
 * prompt in an interactive terminal, else default off (non-interactive).
 * Commander sets `tailwind` to `true`/`false` when a flag is passed, `undefined` otherwise.
 */
/**
 * Auto-configure a freshly-generated remote into the workspace's host:
 *   1. inject `'<name>': () => import('<name>/App')` into the host's REMOTES map
 *   2. regenerate `jorvel.federation.json` (host gets the remote) via `jorvel federation`
 *   3. regenerate the host route table (`/<name>/*` mount) via `jorvel routes`
 * No-op (returns false) when there is no host yet. Idempotent.
 */
async function wireRemoteIntoHost(workspaceDir: string, remoteName: string): Promise<boolean> {
  const host = await findHostApp(workspaceDir);
  if (!host) return false;

  // 1. Inject the static federated import into the host bootstrap's REMOTES map.
  for (const ext of ['tsx', 'jsx'] as const) {
    const bootstrap = path.join(host.dir, 'src', `bootstrap.${ext}`);
    if (!(await fs.pathExists(bootstrap))) continue;
    let src = await fs.readFile(bootstrap, 'utf8');
    // Already wired? (match the raw name inside an import specifier)
    if (!new RegExp(`import\\(['\\"]${remoteName}/`).test(src)) {
      const entry = `  ${JSON.stringify(remoteName)}: () => import(${JSON.stringify(`${remoteName}/App`)}),`;
      src = src.replace(/const REMOTES = \{/, `const REMOTES = {\n${entry}`);
      await fs.writeFile(bootstrap, src, 'utf8');
    }
    break;
  }

  // 2 + 3. Regenerate federation + host route table so the remote is mounted.
  const { federationCommand } = await import('./federation.js');
  const { routesCommand } = await import('./routes.js');
  federationCommand.exitOverride();
  await federationCommand.parseAsync(['federation', '--dir', workspaceDir], { from: 'user' });
  routesCommand.exitOverride();
  await routesCommand.parseAsync(['routes', '--dir', workspaceDir], { from: 'user' });
  return true;
}

/**
 * Resolve the source language. Angular (and any tsOnly framework) is always TS.
 * Otherwise: honor `--lang`, else prompt in a TTY, else default TS.
 */
async function resolveLang(raw: string | undefined, framework: FrameworkId): Promise<AppLang> {
  const spec = getFrameworkSpec(framework);
  if (spec?.tsOnly) return 'ts';
  if (raw !== undefined) return parseLang(raw);
  if (process.stdout.isTTY && process.stdin.isTTY) {
    return (await select({
      message: 'Source language?',
      choices: [
        { name: 'TypeScript (recommended)', value: 'ts' },
        { name: 'JavaScript', value: 'js' },
      ],
      default: 'ts',
    })) as AppLang;
  }
  return 'ts';
}

async function resolveTailwind(flag: boolean | undefined): Promise<boolean> {
  if (typeof flag === 'boolean') return flag;
  if (process.stdout.isTTY && process.stdin.isTTY) {
    return confirm({ message: 'Add Tailwind CSS?', default: false });
  }
  return false;
}

function createAppCommand(name: string, opts: CreateAppOptions): Command {
  return new Command(name)
    .description(`Generate a ${opts.kind} app`)
    .argument('<name>', `${opts.kind} app name (folder name under apps/)`)
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .option('--port <port>', 'Dev server port', String(opts.defaultPort))
    .option('--tailwind', 'Enable Tailwind CSS (PostCSS + tailwind.config)')
    .option('--no-tailwind', 'Skip Tailwind CSS (skip the prompt)')
    .option('--no-wire', 'For remote: do NOT auto-wire the new remote into the host')
    .option('--remote <name>', 'For host: which demo remote to wire up', 'dashboard')
    .option('--lang <ts|js>', 'Source language for the scaffolded app (prompted if omitted)')
    .option(
      '--framework <fw>',
      'Remote framework: react | vue | solid | svelte | angular (host is always react)',
    )
    .action(
      async (
        rawName: string,
        cmdOpts: {
          dir: string;
          port: string;
          tailwind?: boolean;
          wire?: boolean;
          remote?: string;
          lang?: string;
          framework?: string;
        },
      ) => {
        const workspaceDir = path.resolve(cmdOpts.dir);
        const appName = toKebab(rawName);
        validateAppName(appName);
        const appDir = path.join(workspaceDir, 'apps', appName);
        const port = parsePort(cmdOpts.port, opts.defaultPort);

        // ── Framework selection (remotes only; host is always React) ─────────
        const framework = await resolveFramework(cmdOpts.framework, opts.kind);
        // ── Language: explicit flag, else prompt in a TTY, else ts ───────────
        const lang = await resolveLang(cmdOpts.lang, framework);
        // ── Tailwind: explicit flag, else prompt in a TTY, else off ──────────
        const tailwind: TailwindMode = (await resolveTailwind(cmdOpts.tailwind)) ? 'on' : 'off';

        if (opts.kind === 'remote' && framework !== 'react') {
          const spec = getFrameworkSpec(framework);
          if (!spec) throw new JorvelCliError(`Unknown framework "${framework}".`, { code: 'GEN-006' });
          // eslint-disable-next-line no-console
          console.log(kleur.cyan(`Generating ${spec.label} remote ${appName} (${lang}) in ${appDir}${tailwind === 'on' ? ' + Tailwind' : ''}`));
          await ensureDirIsCreatable(appDir);
          await scaffoldFrameworkRemote(appDir, appName, port, spec, tailwind, lang);
          await writeJson(path.join(appDir, 'jorvel.app.json'), {
            $schema: '../../node_modules/@jorvel/types/schemas/jorvel.app.json',
            name: appName,
            type: 'remote',
            port,
            framework: spec.id,
            exposes: { './App': `./src/remote.${lang}` },
          });
          const wiredFw = cmdOpts.wire !== false ? await wireRemoteIntoHost(workspaceDir, appName) : false;
          // eslint-disable-next-line no-console
          console.log(
            kleur.green(
              wiredFw
                ? `Done — ${spec.label} remote, auto-wired into the host (federation + routes + REMOTES).`
                : `Done — ${spec.label} remote. Run \`jorvel federation\` to wire it into a host.`,
            ),
          );
          return;
        }

        // eslint-disable-next-line no-console
        console.log(
          kleur.cyan(`Generating ${opts.kind} ${appName} (${lang}) in ${appDir}`),
        );

        await ensureDirIsCreatable(appDir);
        await scaffoldReactRspackApp(appDir, appName, port, tailwind, lang);

        const postOpts: { remoteName?: string; lang: AppLang } = { lang };
        if (cmdOpts.remote) {
          const remoteName = toKebab(cmdOpts.remote);
          validateAppName(remoteName);
          postOpts.remoteName = remoteName;
        }
        await opts.postScaffold(appDir, appName, postOpts);

        if (opts.alsoWrite) await opts.alsoWrite(appDir, appName, port);

        // Auto-wire a React remote into the host (federation + routes + REMOTES map).
        let wired = false;
        if (opts.kind === 'remote' && cmdOpts.wire !== false) {
          wired = await wireRemoteIntoHost(workspaceDir, appName);
        }

        // eslint-disable-next-line no-console
        console.log(kleur.green(wired ? 'Done — remote auto-wired into the host.' : 'Done.'));
      },
    );
}

function createHostCommand() {
  return createAppCommand('host', {
    kind: 'host',
    defaultPort: 3000,
    async postScaffold(appDir, _name, { remoteName, lang }) {
      const r = remoteName ?? 'dashboard';
      await addHostRemoteDemo(appDir, r, lang);
      await fs.outputFile(
        path.join(appDir, 'jorvel.routes.host.json'),
        JSON.stringify(
          {
            host: path.basename(appDir),
            routes: [
              // `/` is reserved for the first-run Welcome screen (src/welcome.*).
              // Remove that branch in src/bootstrap.* if you want the root to
              // resolve to a remote instead.
              { path: `/${r}/*`, remote: r, module: './App' },
            ],
          },
          null,
          2,
        ) + '\n',
        'utf8',
      );
    },
    async alsoWrite(appDir, name, port) {
      await writeJson(path.join(appDir, 'jorvel.app.json'), {
        $schema: '../../node_modules/@jorvel/types/schemas/jorvel.app.json',
        name,
        type: 'host',
        port,
      });
    },
  });
}

function createRemoteCommand() {
  return createAppCommand('remote', {
    kind: 'remote',
    defaultPort: 3001,
    async postScaffold(appDir, name, { lang }) {
      await addRemoteEntrypoint(appDir, name, lang);
    },
    async alsoWrite(appDir, name, port) {
      // Note: exposes path uses .tsx because the published runtime resolves
      // entries by extension at build time. Both TS+JS apps resolve correctly
      // because the rspack rule handles both syntaxes.
      const remoteEntry = (await fs.pathExists(path.join(appDir, 'src/remote.jsx')))
        ? './src/remote.jsx'
        : './src/remote.tsx';
      await writeJson(path.join(appDir, 'jorvel.app.json'), {
        $schema: '../../node_modules/@jorvel/types/schemas/jorvel.app.json',
        name,
        type: 'remote',
        port,
        exposes: { './App': remoteEntry },
      });
    },
  });
}

function createGenerateCommand() {
  const hostCommand = createHostCommand();
  const remoteCommand = createRemoteCommand();

  const typesCommand = new Command('types')
    .description("Generate the host's src/remotes.d.ts from its federation/routes wiring")
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .action(async (opts: { dir: string }) => {
      const workspaceDir = path.resolve(opts.dir);
      const host = await findHostApp(workspaceDir);
      if (!host) {
        throw new JorvelCliError('No host app found.', {
          code: 'GEN-005',
          hint: 'Generate one first: `jorvel generate host shell`.',
        });
      }
      const { file, remotes } = await writeRemotesDts(host.dir);
      console.log(
        kleur.green(
          `Wrote ${path.relative(workspaceDir, file)} (${remotes.length} remote(s): ${remotes.join(', ') || 'none'})`,
        ),
      );
    });

  const generateCommand = new Command('generate')
    .description('Scaffold new JORVEL apps')
    .addCommand(hostCommand)
    .addCommand(remoteCommand)
    .addCommand(typesCommand);

  attachStorybook(generateCommand);

  const wizardCommand = new Command('wizard')
    .description('Interactive generator: create a host + remotes with common options')
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .action(async (opts: { dir: string }) => {
      const workspaceDir = path.resolve(opts.dir);

      if (!process.stdout.isTTY) {
        // eslint-disable-next-line no-console
        console.error(
          kleur.yellow('Wizard requires an interactive terminal. Use `jorvel generate host|remote` instead.'),
        );
        process.exitCode = 2;
        return;
      }

      const mode = await select({
        message: 'What do you want to generate?',
        choices: [
          { name: 'Host + one remote (recommended)', value: 'pair' },
          { name: 'Host only', value: 'host' },
          { name: 'Remote only', value: 'remote' },
        ],
      });

      const lang = (await select({
        message: 'Source language',
        choices: [
          { name: 'TypeScript (recommended)', value: 'ts' },
          { name: 'JavaScript', value: 'js' },
        ],
        default: 'ts',
      })) as AppLang;

      const tailwind = await confirm({ message: 'Enable Tailwind CSS?', default: false });
      const hostName = mode === 'remote' ? 'shell' : await input({ message: 'Host name', default: 'shell' });
      const hostPort = ((mode === 'remote'
        ? 3000
        : await number({ message: 'Host port', default: 3000, min: 1, max: 65535 })) ?? 3000) as number;

      const remoteCount = (mode === 'host'
        ? 0
        : mode === 'remote'
          ? 1
          : ((await number({ message: 'How many remotes?', default: 1, min: 1, max: 8 })) ?? 1)) as number;

      const remoteSpecs: { name: string; framework: FrameworkId }[] = [];
      for (let i = 0; i < remoteCount; i++) {
        const r = await input({
          message: `Remote #${i + 1} name`,
          default: i === 0 ? 'dashboard' : `remote-${i + 1}`,
        });
        const framework = (await select({
          message: `Remote #${i + 1} (${r}) framework`,
          choices: FRAMEWORK_CHOICES,
          default: 'react',
        })) as FrameworkId;
        remoteSpecs.push({ name: r, framework });
      }
      const remoteNames = remoteSpecs.map((s) => s.name);

      // No process.chdir — we pass --dir to subcommands explicitly so the wizard
      // can be safely interleaved with other concurrent CLI work.
      const runSub = async (cmd: Command, args: string[]) => {
        cmd.exitOverride();
        await cmd.parseAsync(args, { from: 'user' });
      };

      // Pass the tailwind decision explicitly so the subcommand doesn't re-prompt.
      const twFlag = tailwind ? '--tailwind' : '--no-tailwind';

      if (mode !== 'remote') {
        const args = [hostName, '--dir', workspaceDir, '--port', String(hostPort), '--lang', lang, twFlag];
        if (remoteNames[0]) args.push('--remote', remoteNames[0]);
        await runSub(hostCommand, args);
      }

      const baseRemotePort = (hostPort ?? 3000) + 1;
      for (let i = 0; i < remoteSpecs.length; i++) {
        const rspec = remoteSpecs[i] ?? { name: `remote-${i + 1}`, framework: 'react' as FrameworkId };
        const p = baseRemotePort + i;
        // Tailwind now works for every framework (PostCSS via rspack).
        const args = [rspec.name, '--dir', workspaceDir, '--port', String(p), '--lang', lang, '--framework', rspec.framework, twFlag];
        await runSub(remoteCommand, args);
      }

      const extra = await checkbox({
        message: 'Post-generation tasks',
        choices: [
          { name: 'Generate federation config (jorvel federation)', value: 'federation', checked: true },
          { name: 'Generate routes manifests (jorvel routes)', value: 'routes', checked: false },
        ],
      });

      if (extra.includes('federation')) {
        const { federationCommand } = await import('./federation.js');
        await runSub(federationCommand, ['--dir', workspaceDir]);
      }
      if (extra.includes('routes')) {
        const { routesCommand } = await import('./routes.js');
        await runSub(routesCommand, ['--dir', workspaceDir]);
      }

      // eslint-disable-next-line no-console
      console.log(kleur.green('Wizard complete.'));
    });

  generateCommand.addCommand(wizardCommand);

  return generateCommand;
}

export const generateCommand = createGenerateCommand();

/** Factory for tests — every call returns a fresh, unparsed Command tree. */
export function buildGenerateCommand(): Command {
  return createGenerateCommand();
}
