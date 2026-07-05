import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import type { AppLang, FrameworkSpec } from './registry.js';

const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'assets');

const APP_NAME_RE = /^[a-z][a-z0-9-]*$/;

async function writeJson(filePath: string, obj: unknown): Promise<void> {
  await fs.outputFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/** Per-framework tsconfig compilerOptions additions. */
function tsconfigExtra(id: FrameworkSpec['id']): Record<string, unknown> {
  switch (id) {
    case 'solid':
      return { jsx: 'preserve', jsxImportSource: 'solid-js' };
    case 'angular':
      return { experimentalDecorators: true, emitDecoratorMetadata: true, useDefineForClassFields: false };
    default:
      return {};
  }
}

/**
 * Scaffold a non-React remote for `spec`. Produces a working Module-Federation
 * remote that exposes `./App` as a framework-neutral mount module — the React
 * host embeds it through `@jorvel/mount`.
 */
export type TailwindMode = 'on' | 'off';

export async function scaffoldFrameworkRemote(
  appDir: string,
  name: string,
  port: number,
  spec: FrameworkSpec,
  tailwind: TailwindMode = 'off',
  lang: AppLang = 'ts',
): Promise<void> {
  if (!APP_NAME_RE.test(name)) {
    throw new Error(`Invalid app name "${name}" — use kebab-case (a-z, 0-9, -).`);
  }
  // Angular is TypeScript-only regardless of the requested language.
  if (spec.tsOnly) lang = 'ts';
  await fs.ensureDir(path.join(appDir, 'src'));
  const nameJs = JSON.stringify(name);
  const tw = tailwind === 'on';
  const ext = lang; // entry-file extension: 'ts' | 'js'
  const isTs = lang === 'ts';

  // ── package.json ────────────────────────────────────────────────────────
  const pkg = {
    name: `@app/${name}`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'rspack serve',
      start: 'rspack serve --mode production',
      build: 'rspack build',
      'build:prod': 'cross-env NODE_ENV=production rspack build',
      preview: 'rspack serve --mode production',
      clean: 'node -e "require(\'fs\').rmSync(\'dist\', { recursive: true, force: true })"',
      typecheck: 'tsc --noEmit',
      test: 'vitest run --passWithNoTests',
      lint: 'eslint . --max-warnings=0',
      format: 'prettier --write "src/**/*.{ts,tsx,js,jsx,css,json,md}"',
    },
    dependencies: {
      // Framework-neutral cross-app channel — NOT @jorvel/runtime (that's React).
      '@jorvel/event-bus': '^0.3.0',
      ...spec.deps,
    },
    devDependencies: {
      '@rspack/cli': '^1.5.0',
      '@rspack/core': '^1.5.0',
      '@rspack/dev-server': '^1.1.0',
      '@jorvel/eslint-config': '^0.1.0',
      '@jorvel/prettier-config': '^0.1.0',
      'cross-env': '^7.0.3',
      eslint: '^9.20.0',
      prettier: '^3.4.2',
      typescript: '^5.7.3',
      vitest: '^2.1.9',
      ...spec.devDeps,
      ...(tw
        ? {
            tailwindcss: '^4.0.0',
            '@tailwindcss/postcss': '^4.0.0',
            postcss: '^8.5.1',
            'postcss-loader': '^8.1.1',
          }
        : {}),
    },
    prettier: '@jorvel/prettier-config',
  };
  await writeJson(path.join(appDir, 'package.json'), pkg);

  if (tw) {
    // Tailwind v4 — CSS-first, content auto-detected (no tailwind.config).
    await fs.outputFile(
      path.join(appDir, 'postcss.config.cjs'),
      "module.exports = {\n  plugins: {\n    '@tailwindcss/postcss': {},\n  },\n};\n",
      'utf8',
    );
  }

  // ── tsconfig.json (TS) or jsconfig.json (JS) ──────────────────────────────
  if (isTs) {
    await writeJson(path.join(appDir, 'tsconfig.json'), {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        resolveJsonModule: true,
        noEmit: true,
        types: [],
        ...tsconfigExtra(spec.id),
      },
      include: ['src'],
    });
  } else {
    await writeJson(path.join(appDir, 'jsconfig.json'), {
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'Bundler',
        checkJs: false,
        allowJs: true,
        baseUrl: '.',
      },
      include: ['src'],
    });
  }

  // ── eslint / prettier ignore ──────────────────────────────────────────────
  await fs.outputFile(
    path.join(appDir, 'eslint.config.mjs'),
    [
      "import jorvel from '@jorvel/eslint-config';",
      '',
      'export default [',
      '  ...jorvel,',
      "  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },",
      '];',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.outputFile(
    path.join(appDir, '.prettierignore'),
    ['dist', 'coverage', 'node_modules', '*.tsbuildinfo', ''].join('\n'),
    'utf8',
  );

  // ── index.html ────────────────────────────────────────────────────────────
  await fs.outputFile(
    path.join(appDir, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="utf-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
      '    <link rel="icon" type="image/png" href="/logojorvel.png" />',
      `    <title>${name} — ${spec.label} remote</title>`,
      '  </head>',
      '  <body>',
      '    <div id="root"></div>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
    'utf8',
  );

  // Brand logo → public/ (served at /logojorvel.png; matches the host).
  const logoPng = path.join(ASSETS_DIR, 'logojorvel.png');
  if (await fs.pathExists(logoPng)) {
    await fs.ensureDir(path.join(appDir, 'public'));
    await fs.copyFile(logoPng, path.join(appDir, 'public', 'logojorvel.png'));
  }

  // ── MF share-scope shim (framework-agnostic) ──────────────────────────────
  await fs.outputFile(
    path.join(appDir, 'src/mf-shim.js'),
    `// MF share-scope shim — AUTO-GENERATED by \`jorvel generate\`. Do not edit.
// Bridges Rspack federation globals to webpack-style globals so shared
// singletons resolve from the shared scope before any app code executes.
(function jorvelFederationShim() {
  const g = typeof globalThis !== 'undefined' ? globalThis
    : typeof window !== 'undefined' ? window
    : typeof self !== 'undefined' ? self : {};
  try {
    if (typeof g.__federation_init_sharing__ === 'function') {
      g.__webpack_init_sharing__ = async (scope) => g.__federation_init_sharing__(scope);
    }
    if (g.__federation_shared__) {
      const expected = g.__federation_shared__;
      if (g.__webpack_share_scopes__?.default !== expected) {
        g.__webpack_share_scopes__ = { default: expected };
      }
    }
  } catch { /* best-effort */ }
})();
`,
    'utf8',
  );

  // ── src/main.<lang> — async boundary ──────────────────────────────────────
  await fs.outputFile(
    path.join(appDir, `src/main.${ext}`),
    `// Async boundary — defers all imports until Module Federation has initialized
// the shared scope.
import './styles.css';
import('./bootstrap');
`,
    'utf8',
  );

  // ── src/bootstrap.<lang> — standalone dev mount via the mount contract ─────
  await fs.outputFile(
    path.join(appDir, `src/bootstrap.${ext}`),
    `// Standalone dev entry: mount this remote into #root using its OWN exposed
// mount module — the exact same contract the host uses in production.
import remote from './remote';

const el = document.getElementById('root');
if (el) {
  remote.mount({
    el,
    subpath: window.location.pathname || '/',
    basePath: '/',
    params: {},
  });
}
`,
    'utf8',
  );

  // ── src/remote.<lang> — the exposed ./App ─────────────────────────────────
  await fs.outputFile(path.join(appDir, `src/remote.${ext}`), spec.remoteEntry(name, lang), 'utf8');

  // ── sample root component ─────────────────────────────────────────────────
  const root = spec.rootComponent(name, lang);
  await fs.outputFile(path.join(appDir, root.file), root.content, 'utf8');

  // ── styles ────────────────────────────────────────────────────────────────
  const baseCss = `.jorvel-remote { font-family: system-ui, sans-serif; padding: 1rem; }
.jorvel-remote h1 { margin: 0 0 .5rem; }
.jorvel-remote small { color: #888; font-weight: 400; }
.jorvel-remote code { background: rgba(127,127,127,.15); padding: .1em .35em; border-radius: 4px; }
`;
  await fs.outputFile(
    path.join(appDir, 'src/styles.css'),
    tw ? `@import "tailwindcss";\n\n${baseCss}` : baseCss,
    'utf8',
  );

  // ── rspack.config.mjs ─────────────────────────────────────────────────────
  await fs.outputFile(path.join(appDir, 'rspack.config.mjs'), rspackConfig(name, nameJs, port, spec, tw, ext), 'utf8');

  // ── README ────────────────────────────────────────────────────────────────
  await fs.outputFile(path.join(appDir, 'README.md'), readme(name, spec, lang), 'utf8');

  // ── per-app AI skill ──────────────────────────────────────────────────────
  const skillSlug = `${spec.id}-remote`;
  await fs.outputFile(path.join(appDir, '.claude', 'skills', `${skillSlug}.md`), spec.skill(name), 'utf8');
}

function rspackConfig(name: string, nameJs: string, port: number, spec: FrameworkSpec, tw: boolean, ext: string): string {
  const imports = spec.rspackImports ? spec.rspackImports + '\n' : '';
  const extraPlugins = spec.rspackPlugins ? spec.rspackPlugins + '\n' : '';
  const extraDefines = spec.rspackDefines ? spec.rspackDefines + '\n' : '';
  const exts = JSON.stringify(spec.resolveExtensions);
  const cssRule = tw ? "      { test: /\\.css$/, use: ['postcss-loader'], type: 'css/auto' },\n" : '';
  return `import { rspack } from '@rspack/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
${imports}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const federationFile = process.env.JORVEL_FEDERATION_FILE || 'jorvel.federation.json';
const federationPath = path.join(__dirname, federationFile);
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  entry: { main: ['./src/mf-shim.js', './src/main.${ext}'] },
  lazyCompilation: false,
  experiments: { css: true },
  devServer: {
    port: ${port},
    hot: false,
    liveReload: true,
    historyApiFallback: true,
    static: [{ directory: __dirname }],
  },
  output: {
    uniqueName: ${nameJs},
    publicPath: 'auto',
    filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: process.env.NODE_ENV === 'production' ? '[id].[contenthash:8].js' : '[id].js',
  },
  resolve: {
    extensions: ${exts},
  },
  module: {
    rules: [
${cssRule}${spec.rspackRules}
    ]
  },
  plugins: [
    new rspack.DefinePlugin({
      'import.meta.env.JORVEL_FEDERATION_FILE': JSON.stringify(process.env.JORVEL_FEDERATION_FILE || ''),
${extraDefines}    }),
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
${extraPlugins}    ...(federation
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
};
`;
}

function readme(name: string, spec: FrameworkSpec, lang: AppLang): string {
  return `# ${name}

A **${spec.label}** micro-frontend remote, embedded by the React host through the
framework-neutral [\`@jorvel/mount\`](https://jorveljs.vercel.app/docs/cross-framework) contract.

## Develop

\`\`\`sh
pnpm dev            # rspack serve — runs this remote standalone on its port
\`\`\`

Standalone, \`src/bootstrap.${lang}\` mounts the remote's exposed \`./App\` into \`#root\`
using the exact contract the host uses in production.

## Build

\`\`\`sh
pnpm build          # bundle into dist/
pnpm start          # preview the production build
\`\`\`

## Federation

- \`src/remote.${lang}\` exposes \`./App\` — \`export default ${spec.defineFn}(Root)\`.
- Run \`jorvel federation\` at the workspace root to (re)generate \`jorvel.federation.json\`.
- The host mounts this remote at \`/${name}/*\` and passes \`{ subpath, basePath, params }\`.

## Layout

| File | Purpose |
| --- | --- |
| \`src/remote.${lang}\` | Exposed \`./App\` — the mount module (federation contract) |
| \`${spec.rootComponent(name, lang).file}\` | Sample root component (edit freely) |
| \`src/bootstrap.${lang}\` | Standalone dev mount |
| \`rspack.config.mjs\` | Generated — regenerate via the CLI |

> ${spec.label} remotes are an experimental JORVEL scaffold. The mount contract is
> stable; the build config is a starting point — tune it for your app.

Full guide → https://jorveljs.vercel.app/docs/cross-framework
`;
}
