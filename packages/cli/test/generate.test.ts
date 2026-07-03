import { describe, expect, it, test } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { buildGenerateCommand } from '../src/commands/generate.js';

async function run(argv: string[], cwd: string) {
  // Fresh command tree per call — prevents commander state from leaking between tests.
  const generateCommand = buildGenerateCommand();
  generateCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(cwd);
  try {
  const [sub, ...rest] = argv;
  if (!sub) throw new Error('missing subcommand');

  // Execute the subcommand directly to avoid parent command parsing quirks in tests.
  // Use a realistic argv shape so Commander treats `rest` as user args.
  const cmd = generateCommand.commands.find((c) => c.name() === sub || c.name() === `generate:${sub}`);
  if (!cmd) throw new Error(`unknown generate subcommand: ${sub}`);
  cmd.exitOverride();
  await cmd.parseAsync(rest, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('jorvel generate', () => {
  it('remote includes src/remote.tsx and jorvel.app.json exposes ./App -> ./src/remote.tsx', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

  await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const entryFile = path.join(tmp, 'apps', 'dashboard', 'src', 'remote.tsx');
    expect(await fs.pathExists(entryFile)).toBe(true);

  expect(await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'src', 'pages', 'index.tsx'))).toBe(true);
  expect(await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'src', 'jorvel.routes.ts'))).toBe(true);

    const meta = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'jorvel.app.json'));
    expect(meta.exposes).toEqual({ './App': './src/remote.tsx' });
  });

  it('remote template uses getFederatedRouter() so it can consume the host router when shared via federation', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

    await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const remote = await fs.readFile(path.join(tmp, 'apps', 'dashboard', 'src', 'remote.tsx'), 'utf8');
    expect(remote).toContain("from '@jorvel/runtime'");
    expect(remote).toContain('getFederatedRouter');
    expect(remote).toContain('getFederatedRouter()');
  expect(remote).toContain('RemoteApp');
  expect(remote).toContain("from './jorvel.routes.js'");
    expect(remote).toContain('router.navigate');
  });

  it('host bootstrap.tsx uses RemoteOutlet + NavLink + usePathname (routing proof-of-life)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

  await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    // After introducing the async boundary, app code lives in bootstrap.tsx
    const bootstrap = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'), 'utf8');
    expect(bootstrap).toContain("from '@jorvel/runtime'");
  expect(bootstrap).toContain('RemoteOutlet');
  expect(bootstrap).toContain('NavLink');
  expect(bootstrap).toContain('usePathname');
  expect(bootstrap).toContain('jorvel.routes.host.json');
    expect(bootstrap).toContain('connectJorvelDevReload');
    expect(bootstrap).toContain('JORVEL_DEV_RELOAD_URL');
    expect(bootstrap).toContain('provideHostRouter');
    expect(bootstrap).toContain('getRouter');
    expect(bootstrap).toContain('provideHostRouter(getRouter())');

  expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'jorvel.routes.host.json'))).toBe(true);
  });

  test('host exposes JORVEL_DEV_RELOAD_URL to client and connects reload client when present', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');
    // After introducing the async boundary, app code lives in bootstrap.tsx
    const hostBootstrap = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'), 'utf8');

    // Assert rspack config exposes import.meta.env.JORVEL_DEV_RELOAD_URL
    expect(rspackConfig).toContain('import.meta.env.JORVEL_DEV_RELOAD_URL');

    // Assert host wires the runtime reload client off import.meta.env
    expect(hostBootstrap).toContain('connectJorvelDevReload');
    expect(hostBootstrap).toContain('JORVEL_DEV_RELOAD_URL');
  });

  test('rspack config enables source maps in dev by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');

    // We want dev-only sourcemaps: prod should not emit sourcemaps by default.
    expect(rspackConfig).toContain("devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'");
  });
  
  test('rspack config enables HMR + React Refresh in dev by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');

    // HMR switch
    expect(rspackConfig).toContain('hot: true');
    expect(rspackConfig).toContain('liveReload: false');

    // React refresh plugin + SWC refresh transform
    expect(rspackConfig).toContain("import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'");
    expect(rspackConfig).toContain('new ReactRefreshWebpackPlugin');
    expect(rspackConfig).toContain('refresh: process.env.NODE_ENV !== \'production\'');
  });

  it('rspack config wires on-demand starter URL into proxy (best-effort)', async () => {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;

  await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const cfgPath = path.join(tmp, 'apps', 'shell', 'rspack.config.mjs');
    const cfg = await fs.readFile(cfgPath, 'utf8');

    // Exposed to client for symmetry/debugging (and to keep templates consistent).
    expect(cfg).toContain('import.meta.env.JORVEL_ON_DEMAND_STARTER_URL');

    // Used by proxy before proxying remote assets.
    expect(cfg).toContain('process.env.JORVEL_ON_DEMAND_STARTER_URL');
    expect(cfg).toContain('/__jorvel/start-remote?name=');
    expect(cfg).toContain('onProxyReq');
  });

  it('scaffolded app includes mf-shim.js as first entry and lazyCompilation: false', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const cfg = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');
    // Entry must list mf-shim.js before main.tsx so the share-scope bridge runs first
    expect(cfg).toContain("'./src/mf-shim.js'");
    expect(cfg).toContain("'./src/main.tsx'");
    expect(cfg.indexOf('./src/mf-shim.js')).toBeLessThan(cfg.indexOf('./src/main.tsx'));
    // Lazy compilation must be disabled to prevent hot-update proxy crashes in MF containers
    expect(cfg).toContain('lazyCompilation: false');

    // The shim file itself must exist
    const shim = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'mf-shim.js'), 'utf8');
    expect(shim).toContain('__federation_init_sharing__');
    expect(shim).toContain('__webpack_init_sharing__');
    expect(shim).toContain('__webpack_share_scopes__');
  });

  it('scaffolded app uses async boundary pattern: main.tsx imports bootstrap.tsx dynamically', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const main = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'main.tsx'), 'utf8');
    // main.tsx must only contain a dynamic import — no direct React/ReactDOM imports.
    // This async boundary lets Module Federation initialize the share scope before any
    // shared dep is consumed synchronously (prevents RUNTIME-006 loadShareSync errors).
    expect(main).toContain("import('./bootstrap')");
    expect(main).not.toContain("import React");
    expect(main).not.toContain("import ReactDOM");

    // The actual app code must live in bootstrap.tsx
    const bootstrap = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'), 'utf8');
    expect(bootstrap).toContain('import React');
    expect(bootstrap).toContain('ReactDOM.createRoot');
  });

  it('tsconfig has allowImportingTsExtensions and noEmit for .tsx dynamic imports', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const tsconfig = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'tsconfig.json'));
    expect(tsconfig.compilerOptions.allowImportingTsExtensions).toBe(true);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
  });

  // ── Generated app package.json scripts ──────────────────────────────────────

  describe('generated app package.json scripts', () => {
    async function generateHost() {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      return { tmp, pkg: await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json')) };
    }

    it.each([
      'dev',
      'start',
      'build',
      'build:prod',
      'preview',
      'clean',
      'typecheck',
      'lint',
      'lint:fix',
      'format',
      'format:check',
      'test',
      'test:watch',
      'test:coverage',
      'test:ui',
    ])('declares script "%s"', async (key) => {
      const { pkg } = await generateHost();
      expect(pkg.scripts[key]).toBeTypeOf('string');
      expect(pkg.scripts[key].length).toBeGreaterThan(0);
    });

    it('dev script runs rspack serve', async () => {
      const { pkg } = await generateHost();
      expect(pkg.scripts.dev).toBe('rspack serve');
    });

    it('build script runs rspack build', async () => {
      const { pkg } = await generateHost();
      expect(pkg.scripts.build).toBe('rspack build');
    });

    it('lint script uses eslint with --max-warnings=0', async () => {
      const { pkg } = await generateHost();
      expect(pkg.scripts.lint).toContain('eslint');
      expect(pkg.scripts.lint).toContain('--max-warnings');
    });

    it('test scripts run vitest', async () => {
      const { pkg } = await generateHost();
      expect(pkg.scripts.test).toBe('vitest run');
      expect(pkg.scripts['test:watch']).toBe('vitest');
      expect(pkg.scripts['test:coverage']).toContain('--coverage');
    });

    it('clean script removes dist', async () => {
      const { pkg } = await generateHost();
      expect(pkg.scripts.clean).toContain('dist');
    });

    it('format scripts target src files with prettier', async () => {
      const { pkg } = await generateHost();
      expect(pkg.scripts.format).toContain('prettier --write');
      expect(pkg.scripts.format).toContain('src');
      expect(pkg.scripts['format:check']).toContain('prettier --check');
    });

    it('uses @jorvel/prettier-config', async () => {
      const { pkg } = await generateHost();
      expect(pkg.prettier).toBe('@jorvel/prettier-config');
    });

    it('lists eslint + prettier + vitest coverage as devDeps', async () => {
      const { pkg } = await generateHost();
      expect(pkg.devDependencies.eslint).toBeDefined();
      expect(pkg.devDependencies.prettier).toBeDefined();
      expect(pkg.devDependencies['@vitest/coverage-v8']).toBeDefined();
      expect(pkg.devDependencies['@jorvel/eslint-config']).toBeDefined();
      expect(pkg.devDependencies['@jorvel/prettier-config']).toBeDefined();
    });

    it('uses @app/<name> as package name', async () => {
      const { pkg } = await generateHost();
      expect(pkg.name).toBe('@app/shell');
      expect(pkg.private).toBe(true);
      expect(pkg.type).toBe('module');
    });
  });

  // ── Generated app tooling files ─────────────────────────────────────────────

  describe('generated app tooling files', () => {
    async function generateRemote() {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
      return tmp;
    }

    it('writes eslint.config.mjs extending @jorvel/eslint-config', async () => {
      const tmp = await generateRemote();
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'eslint.config.mjs'),
        'utf8',
      );
      expect(content).toContain("from '@jorvel/eslint-config'");
      expect(content).toContain('export default');
      expect(content).toContain('dist');
    });

    it('writes .prettierignore', async () => {
      const tmp = await generateRemote();
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', '.prettierignore'),
        'utf8',
      );
      expect(content).toContain('dist');
      expect(content).toContain('coverage');
      expect(content).toContain('node_modules');
    });

    it('writes vitest.config.ts with jsdom env + coverage settings', async () => {
      const tmp = await generateRemote();
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'vitest.config.ts'),
        'utf8',
      );
      expect(content).toContain("environment: 'jsdom'");
      expect(content).toContain('coverage');
      expect(content).toContain("provider: 'v8'");
      expect(content).toContain('lcov');
    });

    it('writes a real React Testing Library test (not expect(1+1))', async () => {
      const tmp = await generateRemote();
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'src', 'pages', 'index.test.tsx'),
        'utf8',
      );
      expect(content).toContain("from '@testing-library/react'");
      expect(content).toContain('render(<HomePage />)');
      expect(content).toContain('toBeInTheDocument');
      expect(content).not.toContain('expect(1 + 1)');
    });

    it('writes a vitest.setup.ts that registers jest-dom + cleanup', async () => {
      const tmp = await generateRemote();
      const setup = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'vitest.setup.ts'),
        'utf8',
      );
      expect(setup).toContain('@testing-library/jest-dom/vitest');
      expect(setup).toContain('cleanup');
      const cfg = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'vitest.config.ts'),
        'utf8',
      );
      expect(cfg).toContain("setupFiles: ['./vitest.setup.ts']");
    });

    it('lists React Testing Library in devDependencies', async () => {
      const tmp = await generateRemote();
      const pkg = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'package.json'));
      expect(pkg.devDependencies['@testing-library/react']).toBeDefined();
      expect(pkg.devDependencies['@testing-library/jest-dom']).toBeDefined();
      expect(pkg.devDependencies['@testing-library/user-event']).toBeDefined();
    });
  });

  // ── Name + port validation ──────────────────────────────────────────────────

  describe('input validation', () => {
    it('rejects names with special characters', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await expect(
        run(['host', 'bad@name', '--dir', tmp, '--port', '3000'], tmp),
      ).rejects.toThrow(/Invalid app name/i);
    });

    it('normalizes CamelCase to kebab-case (not rejected)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'BadName', '--dir', tmp, '--port', '3000'], tmp);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'bad-name'))).toBe(true);
    });

    it('rejects name starting with digit', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await expect(
        run(['host', '1shell', '--dir', tmp, '--port', '3000'], tmp),
      ).rejects.toThrow(/Invalid app name/i);
    });

    it('rejects name with underscore', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      // Note: toKebab converts "_" to "-", so we hit the regex via something else.
      // Use a literal space which toKebab also strips, then test a clearly bad case.
      await expect(
        run(['host', 'shell!', '--dir', tmp, '--port', '3000'], tmp),
      ).rejects.toThrow(/Invalid app name/i);
    });

    it('rejects port = 0', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await expect(
        run(['host', 'shell', '--dir', tmp, '--port', '0'], tmp),
      ).rejects.toThrow(/Invalid port/i);
    });

    it('rejects port > 65535', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await expect(
        run(['host', 'shell', '--dir', tmp, '--port', '70000'], tmp),
      ).rejects.toThrow(/Invalid port/i);
    });

    it('rejects non-numeric port', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await expect(
        run(['host', 'shell', '--dir', tmp, '--port', 'abc'], tmp),
      ).rejects.toThrow(/Invalid port/i);
    });

    it('rejects scaffolding into a non-empty directory', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      const appDir = path.join(tmp, 'apps', 'shell');
      await fs.ensureDir(appDir);
      await fs.outputFile(path.join(appDir, 'existing.txt'), 'x');
      await expect(
        run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp),
      ).rejects.toThrow(/not empty/i);
    });
  });

  // ── Kebab conversion + default ports ────────────────────────────────────────

  describe('name normalization', () => {
    it('converts camelCase to kebab-case', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'myShell', '--dir', tmp, '--port', '3000'], tmp);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'my-shell'))).toBe(true);
    });

    it('converts space-separated to kebab-case', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'my shell', '--dir', tmp, '--port', '3000'], tmp);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'my-shell'))).toBe(true);
    });
  });

  describe('default ports', () => {
    it('host defaults to 3000', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp], tmp);
      const appJson = await fs.readJson(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'));
      expect(appJson.port).toBe(3000);
    });

    it('remote defaults to 3001', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp], tmp);
      const appJson = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'jorvel.app.json'));
      expect(appJson.port).toBe(3001);
    });
  });

  // ── Tailwind option ─────────────────────────────────────────────────────────

  describe('--tailwind flag', () => {
    it('adds tailwindcss + postcss + autoprefixer devDeps', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--tailwind'], tmp);
      const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
      expect(pkg.devDependencies.tailwindcss).toBeDefined();
      expect(pkg.devDependencies.postcss).toBeDefined();
      expect(pkg.devDependencies.autoprefixer).toBeDefined();
    });

    it('writes tailwind.config.cjs + postcss.config.cjs + styles.css', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--tailwind'], tmp);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'tailwind.config.cjs')),
      ).toBe(true);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'postcss.config.cjs')),
      ).toBe(true);
      const css = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'styles.css'),
        'utf8',
      );
      expect(css).toContain('@tailwind base');
      expect(css).toContain('@tailwind components');
      expect(css).toContain('@tailwind utilities');
    });

    it('main.tsx imports styles.css when tailwind enabled', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--tailwind'], tmp);
      const main = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'main.tsx'),
        'utf8',
      );
      expect(main).toContain("import './styles.css'");
    });

    it('does NOT write tailwind config when flag omitted', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'tailwind.config.cjs')),
      ).toBe(false);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'postcss.config.cjs')),
      ).toBe(false);
      const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
      expect(pkg.devDependencies.tailwindcss).toBeUndefined();
    });
  });

  // ── Error + 404 page scaffolding ───────────────────────────────────────────

  describe('error + 404 pages (TS)', () => {
    it('host scaffolds error-boundary.tsx + pages/_error.tsx + pages/_404.tsx', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const src = path.join(tmp, 'apps', 'shell', 'src');
      expect(await fs.pathExists(path.join(src, 'error-boundary.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', '_error.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', '_404.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', 'README.md'))).toBe(true);
    });

    it('error-boundary exports a class component with getDerivedStateFromError', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'error-boundary.tsx'),
        'utf8',
      );
      expect(content).toContain('export class ErrorBoundary');
      expect(content).toContain('getDerivedStateFromError');
      expect(content).toContain('componentDidCatch');
      expect(content).toContain('React.Component');
      expect(content).toContain('fallback');
    });

    it('_error.tsx branches on NODE_ENV for dev stack trace', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'pages', '_error.tsx'),
        'utf8',
      );
      expect(content).toContain("process.env.NODE_ENV !== 'production'");
      expect(content).toContain('error.stack');
      expect(content).toContain('error.message');
      expect(content).toContain('reset');
      expect(content).toContain('export function ErrorPage');
    });

    it('_404.tsx renders NotFoundPage with path prop + go-home link', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'pages', '_404.tsx'),
        'utf8',
      );
      expect(content).toContain('export function NotFoundPage');
      expect(content).toContain('404');
      expect(content).toContain('Go home');
      expect(content).toContain('jorvel.routes.host.json');
    });

    it('bootstrap.tsx wraps App in <ErrorBoundary> and renders <NotFoundPage> on unknown route', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--remote', 'dashboard'], tmp);
      const boot = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'),
        'utf8',
      );
      expect(boot).toContain("from './error-boundary'");
      expect(boot).toContain("from './pages/_404'");
      expect(boot).toContain('<ErrorBoundary>');
      expect(boot).toContain('</ErrorBoundary>');
      expect(boot).toContain('matchesAnyHostRoute');
      expect(boot).toContain('<NotFoundPage path={pathname}');
    });

    it('pages/README.md documents override mechanism', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const readme = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'pages', 'README.md'),
        'utf8',
      );
      expect(readme).toContain('fallback={MyCustomErrorPage}');
      expect(readme).toContain('_error.tsx');
      expect(readme).toContain('_404.tsx');
      expect(readme).toContain('unhandledrejection');
    });

    it('remote also gets error-boundary + pages/_error + pages/_404', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
      const src = path.join(tmp, 'apps', 'dashboard', 'src');
      expect(await fs.pathExists(path.join(src, 'error-boundary.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', '_error.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', '_404.tsx'))).toBe(true);
    });
  });

  describe('error + 404 pages (JS)', () => {
    it('host scaffolds .jsx variants when --lang js', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const src = path.join(tmp, 'apps', 'shell', 'src');
      expect(await fs.pathExists(path.join(src, 'error-boundary.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', '_error.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', '_404.jsx'))).toBe(true);
      // No .tsx variants for a JS app.
      expect(await fs.pathExists(path.join(src, 'error-boundary.tsx'))).toBe(false);
      expect(await fs.pathExists(path.join(src, 'pages', '_error.tsx'))).toBe(false);
    });

    it('error-boundary.jsx omits TS type annotations', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'error-boundary.jsx'),
        'utf8',
      );
      expect(content).not.toContain('interface Props');
      expect(content).not.toContain('interface State');
      expect(content).not.toContain(': React.ReactNode');
      expect(content).not.toContain(': Error)');
      expect(content).toContain('export class ErrorBoundary');
    });

    it('_error.jsx props are not typed', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const content = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'pages', '_error.jsx'),
        'utf8',
      );
      expect(content).not.toContain(': { error: Error');
      expect(content).toContain('({ error, reset })');
    });

    it('bootstrap.jsx wires ErrorBoundary + NotFoundPage without TS', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const boot = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.jsx'),
        'utf8',
      );
      expect(boot).toContain('<ErrorBoundary>');
      expect(boot).toContain('matchesAnyHostRoute');
      expect(boot).toContain('<NotFoundPage path={pathname}');
      expect(boot).not.toContain(': RouteTarget[]');
      // Plain JS function signature for the matcher.
      expect(boot).toContain('function matchesAnyHostRoute(pathname, routes)');
    });

    it('pages/README.md uses .jsx language hint', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const readme = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'pages', 'README.md'),
        'utf8',
      );
      expect(readme).toContain('_error.jsx');
      expect(readme).toContain('_404.jsx');
      expect(readme).toContain('```jsx');
    });
  });

  // ── JS / TS language selection ──────────────────────────────────────────────

  describe('--lang ts (default)', () => {
    it('writes tsconfig.json (not jsconfig.json)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'tsconfig.json'))).toBe(true);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'jsconfig.json'))).toBe(false);
    });

    it('writes .tsx + .ts source files (not .jsx / .js)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const src = path.join(tmp, 'apps', 'shell', 'src');
      expect(await fs.pathExists(path.join(src, 'main.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'bootstrap.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'main.jsx'))).toBe(false);
      expect(await fs.pathExists(path.join(src, 'bootstrap.jsx'))).toBe(false);
    });

    it('includes typescript + @types/react in devDeps + typecheck script', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
      expect(pkg.devDependencies.typescript).toBeDefined();
      expect(pkg.devDependencies['@types/react']).toBeDefined();
      expect(pkg.devDependencies['@types/react-dom']).toBeDefined();
      expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    });

    it('vitest config is vitest.config.ts and includes {ts,tsx} globs', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const cfg = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'vitest.config.ts'),
        'utf8',
      );
      expect(cfg).toContain('{ts,tsx}');
    });

    it('test file extension is .tsx for TS apps', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'src', 'pages', 'index.test.tsx')),
      ).toBe(true);
    });

    it('remote scaffold uses .tsx + jorvel.routes.ts', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
      const src = path.join(tmp, 'apps', 'dashboard', 'src');
      expect(await fs.pathExists(path.join(src, 'remote.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'jorvel.routes.ts'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', 'index.tsx'))).toBe(true);
    });

    it('typescript alias passes through', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'typescript'], tmp);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'tsconfig.json'))).toBe(true);
    });
  });

  describe('--lang js', () => {
    it('writes jsconfig.json (not tsconfig.json)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'jsconfig.json'))).toBe(true);
      expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'tsconfig.json'))).toBe(false);
    });

    it('writes .jsx + .js source files (not .tsx / .ts)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const src = path.join(tmp, 'apps', 'shell', 'src');
      expect(await fs.pathExists(path.join(src, 'main.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'bootstrap.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'main.tsx'))).toBe(false);
      expect(await fs.pathExists(path.join(src, 'bootstrap.tsx'))).toBe(false);
    });

    it('omits typescript + @types/react devDeps and typecheck script', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
      expect(pkg.devDependencies.typescript).toBeUndefined();
      expect(pkg.devDependencies['@types/react']).toBeUndefined();
      expect(pkg.devDependencies['@types/react-dom']).toBeUndefined();
      expect(pkg.scripts.typecheck).toBeUndefined();
    });

    it('keeps eslint + prettier + vitest devDeps', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
      expect(pkg.devDependencies.eslint).toBeDefined();
      expect(pkg.devDependencies.prettier).toBeDefined();
      expect(pkg.devDependencies.vitest).toBeDefined();
      expect(pkg.devDependencies['@vitest/coverage-v8']).toBeDefined();
    });

    it('vitest config is vitest.config.js and includes {js,jsx} globs', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const cfg = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'vitest.config.js'),
        'utf8',
      );
      expect(cfg).toContain('{js,jsx}');
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'vitest.config.ts')),
      ).toBe(false);
    });

    it('test file extension is .jsx for JS apps', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'src', 'pages', 'index.test.jsx')),
      ).toBe(true);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'shell', 'vitest.setup.js')),
      ).toBe(true);
    });

    it('rspack config entry points to ./src/main.jsx', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const cfg = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'),
        'utf8',
      );
      expect(cfg).toContain("'./src/main.jsx'");
      expect(cfg).not.toContain("'./src/main.tsx'");
    });

    it('rspack config has both TS+JS swc rules (TS apps can still co-exist)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const cfg = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'),
        'utf8',
      );
      expect(cfg).toContain('/\\.(ts|tsx)$/');
      expect(cfg).toContain('/\\.(js|jsx|mjs|cjs)$/');
      expect(cfg).toContain("syntax: 'typescript'");
      expect(cfg).toContain("syntax: 'ecmascript'");
    });

    it('bootstrap.jsx does NOT use `!` non-null assertion', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const boot = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.jsx'),
        'utf8',
      );
      expect(boot).not.toContain("getElementById('root')!");
      expect(boot).toContain("getElementById('root')");
    });

    it('bootstrap.jsx omits TypeScript-only `type RouteTarget` import', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const boot = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.jsx'),
        'utf8',
      );
      expect(boot).not.toContain('type RouteTarget');
      expect(boot).not.toContain('RouteTarget[]');
      expect(boot).not.toContain('as any');
    });

    it('remote scaffold uses .jsx + jorvel.routes.js + pages/index.jsx', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001', '--lang', 'js'], tmp);
      const src = path.join(tmp, 'apps', 'dashboard', 'src');
      expect(await fs.pathExists(path.join(src, 'remote.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'jorvel.routes.js'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'pages', 'index.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(src, 'remote.tsx'))).toBe(false);
      expect(await fs.pathExists(path.join(src, 'jorvel.routes.ts'))).toBe(false);
    });

    it('remote.jsx does NOT carry TypeScript prop annotations', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001', '--lang', 'js'], tmp);
      const remote = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'src', 'remote.jsx'),
        'utf8',
      );
      expect(remote).not.toContain(': { subpath?: string }');
      expect(remote).toContain("subpath = '/'");
    });

    it('remote jorvel.routes.js has no `import type` line', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001', '--lang', 'js'], tmp);
      const routes = await fs.readFile(
        path.join(tmp, 'apps', 'dashboard', 'src', 'jorvel.routes.js'),
        'utf8',
      );
      expect(routes).not.toContain('import type');
      expect(routes).not.toContain('RemotePageRoute[]');
      expect(routes).toContain('export const pages');
    });

    it('remote jorvel.app.json exposes ./App -> ./src/remote.jsx', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001', '--lang', 'js'], tmp);
      const appJson = await fs.readJson(
        path.join(tmp, 'apps', 'dashboard', 'jorvel.app.json'),
      );
      expect(appJson.exposes['./App']).toBe('./src/remote.jsx');
    });

    it('host gets a JS welcome stub at src/welcome.jsx (not the rich TS template)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'js'], tmp);
      const welcome = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'welcome.jsx'),
        'utf8',
      );
      // TS template uses `interface TemplateOption`; JS stub must not.
      expect(welcome).not.toContain('interface ');
      expect(welcome).toContain('export function Welcome');
    });

    it('javascript alias passes through', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(
        ['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'javascript'],
        tmp,
      );
      expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'jsconfig.json'))).toBe(true);
    });

    it('rejects unknown --lang values', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await expect(
        run(['host', 'shell', '--dir', tmp, '--port', '3000', '--lang', 'rust'], tmp),
      ).rejects.toThrow(/Invalid --lang/i);
    });
  });

  // ── README, favicon, public assets per app ─────────────────────────────────

  describe('per-app README + branding assets', () => {
    it('writes README.md with workspace logo references', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const readme = await fs.readFile(path.join(tmp, 'apps', 'shell', 'README.md'), 'utf8');
      expect(readme).toContain('../../assets/logojorvel.png');
      expect(readme).toContain('@app/shell');
    });

    it('README lists all generated scripts', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const readme = await fs.readFile(path.join(tmp, 'apps', 'shell', 'README.md'), 'utf8');
      for (const s of [
        'pnpm dev',
        'pnpm build',
        'pnpm preview',
        'pnpm clean',
        'pnpm test',
        'pnpm test:watch',
        'pnpm test:coverage',
        'pnpm lint',
        'pnpm format',
        'pnpm typecheck',
      ]) {
        expect(readme).toContain(s);
      }
    });

    it('README references the chosen port', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '4242'], tmp);
      const readme = await fs.readFile(path.join(tmp, 'apps', 'shell', 'README.md'), 'utf8');
      expect(readme).toContain('localhost:4242');
      expect(readme).toContain('4242');
    });

    it('writes public/favicon.ico (real .ico binary)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const ico = path.join(tmp, 'apps', 'shell', 'public', 'favicon.ico');
      expect(await fs.pathExists(ico)).toBe(true);
      const bytes = await fs.readFile(ico);
      expect(bytes.length).toBeGreaterThan(100);
      // ICO magic: 00 00 01 00
      expect(bytes[0]).toBe(0x00);
      expect(bytes[1]).toBe(0x00);
      expect(bytes[2]).toBe(0x01);
      expect(bytes[3]).toBe(0x00);
    });

    it('writes public/logo.svg + logo-light.svg', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const pub = path.join(tmp, 'apps', 'shell', 'public');
      const dark = await fs.readFile(path.join(pub, 'logo.svg'), 'utf8');
      const light = await fs.readFile(path.join(pub, 'logo-light.svg'), 'utf8');
      expect(dark).toContain('<svg');
      expect(light).toContain('<svg');
    });

    it('index.html links favicon.ico, logojorvel.png, and adds description meta', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const html = await fs.readFile(path.join(tmp, 'apps', 'shell', 'index.html'), 'utf8');
      expect(html).toContain('rel="icon"');
      expect(html).toContain('href="/favicon.ico"');
      expect(html).toContain('href="/logojorvel.png"');
      expect(html).toContain('name="description"');
      expect(html).toContain('JORVEL');
    });

    it('remote also gets README + public assets', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'README.md')),
      ).toBe(true);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'public', 'favicon.ico')),
      ).toBe(true);
      expect(
        await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'public', 'logo.svg')),
      ).toBe(true);
    });
  });

  // ── Host vs remote shape ────────────────────────────────────────────────────

  describe('host vs remote outputs', () => {
    it('host writes jorvel.routes.host.json with the remote prefix', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000', '--remote', 'dashboard'], tmp);
      const manifest = await fs.readJson(
        path.join(tmp, 'apps', 'shell', 'jorvel.routes.host.json'),
      );
      expect(manifest.host).toBe('shell');
      expect(manifest.routes).toEqual([
        { path: '/dashboard/*', remote: 'dashboard', module: './App' },
      ]);
    });

    it('host jorvel.app.json has type=host and no exposes', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);
      const appJson = await fs.readJson(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'));
      expect(appJson.type).toBe('host');
      expect(appJson.name).toBe('shell');
      expect(appJson.exposes).toBeUndefined();
    });

    it('remote jorvel.app.json has type=remote and exposes ./App', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
      const appJson = await fs.readJson(
        path.join(tmp, 'apps', 'dashboard', 'jorvel.app.json'),
      );
      expect(appJson.type).toBe('remote');
      expect(appJson.exposes['./App']).toBe('./src/remote.tsx');
    });

    it('host with custom remote name wires NavLinks to that remote', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
      await run(
        ['host', 'shell', '--dir', tmp, '--port', '3000', '--remote', 'billing'],
        tmp,
      );
      const bootstrap = await fs.readFile(
        path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'),
        'utf8',
      );
      expect(bootstrap).toContain('to="/billing"');
      expect(bootstrap).toContain('to="/billing/settings"');
      expect(bootstrap).toContain("'billing/App'");
    });
  });
});
