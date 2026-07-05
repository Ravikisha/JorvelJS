import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { routesCommand } from '../src/commands/routes.js';

async function runCommand(argv: string[], cwd: string) {
  routesCommand.exitOverride();
  routesCommand.configureHelp({ helpWidth: 120 });

  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await routesCommand.parseAsync(['routes', ...argv], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

async function scaffoldWorkspace(tmp: string) {
  const appsDir = path.join(tmp, 'apps');

  // Shell (host)
  const shellDir = path.join(appsDir, 'shell');
  await fs.ensureDir(shellDir);
  await fs.writeJson(path.join(shellDir, 'jorvel.app.json'), {
    name: 'shell',
    type: 'host',
    port: 3000,
  });

  // Dashboard (remote) with pages
  const dashDir = path.join(appsDir, 'dashboard');
  await fs.ensureDir(path.join(dashDir, 'src', 'pages', 'users'));
  await fs.writeJson(path.join(dashDir, 'jorvel.app.json'), {
    name: 'dashboard',
    type: 'remote',
    port: 3001,
  });
  await fs.outputFile(path.join(dashDir, 'src', 'pages', 'index.tsx'), '// home\n');
  await fs.outputFile(path.join(dashDir, 'src', 'pages', 'settings.tsx'), '// settings\n');
  await fs.outputFile(path.join(dashDir, 'src', 'pages', 'users', '[id].tsx'), '// user\n');

  return { shellDir, dashDir };
}

describe('jorvel routes', () => {
  it('writes jorvel.routes.ts for remote apps with correct route paths', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-'))) as string;
    const { dashDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const outFile = path.join(dashDir, 'src', 'jorvel.routes.ts');
    expect(await fs.pathExists(outFile)).toBe(true);

    const content = await fs.readFile(outFile, 'utf8');
    expect(content).toMatch(/path:\s*["']\/["']/);
    expect(content).toMatch(/path:\s*["']\/settings["']/);
    expect(content).toMatch(/path:\s*["']\/users\/:id["']/);
  });

  it('writes jorvel.routes.js (no `import type`) for a JS app', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-js-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    const dashDir = path.join(appsDir, 'dashboard');
    await fs.ensureDir(path.join(dashDir, 'src', 'pages'));
    await fs.writeJson(path.join(dashDir, 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });
    // JS app: jsconfig.json + .jsx pages, no tsconfig.
    await fs.writeJson(path.join(dashDir, 'jsconfig.json'), { compilerOptions: {} });
    await fs.outputFile(path.join(dashDir, 'src', 'pages', 'index.jsx'), '// home\n');

    await runCommand(['--dir', tmp], tmp);

    expect(await fs.pathExists(path.join(dashDir, 'src', 'jorvel.routes.js'))).toBe(true);
    expect(await fs.pathExists(path.join(dashDir, 'src', 'jorvel.routes.ts'))).toBe(false);
    const content = await fs.readFile(path.join(dashDir, 'src', 'jorvel.routes.js'), 'utf8');
    expect(content).not.toContain('import type');
  });

  it('writes jorvel.routes.json manifest for remote app', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-'))) as string;
    const { dashDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const manifest = await fs.readJson(path.join(dashDir, 'jorvel.routes.json'));
    expect(manifest.app).toBe('dashboard');
    expect(Array.isArray(manifest.routes)).toBe(true);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/')).toBe(true);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/settings')).toBe(true);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/users/:id')).toBe(true);
  });

  it('writes jorvel.routes.host.json for the host app with remote mounts', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-'))) as string;
    const { shellDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostManifest = await fs.readJson(path.join(shellDir, 'jorvel.routes.host.json'));
    expect(hostManifest.host).toBe('shell');
    expect(Array.isArray(hostManifest.routes)).toBe(true);
    // Should include a wildcard mount for the dashboard remote
    expect(
      hostManifest.routes.some(
        (r: { path: string; remote: string }) =>
          r.remote === 'dashboard' && r.path.includes('dashboard')
      )
    ).toBe(true);
  });

  it('preserves manually-edited host routes (no clobber) and appends new remotes', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-'))) as string;
    const { shellDir } = await scaffoldWorkspace(tmp);
    // User hand-edits the host manifest: custom module name + a hand-added route.
    await fs.writeJson(path.join(shellDir, 'jorvel.routes.host.json'), {
      host: 'shell',
      routes: [
        { path: '/dashboard/*', remote: 'dashboard', module: './CustomApp' },
        { path: '/legacy/*', remote: 'legacy', module: './App' },
      ],
    });

    await runCommand(['--dir', tmp], tmp);

    const m = await fs.readJson(path.join(shellDir, 'jorvel.routes.host.json'));
    // Manual edits preserved.
    expect(m.routes).toContainEqual({ path: '/dashboard/*', remote: 'dashboard', module: './CustomApp' });
    expect(m.routes).toContainEqual({ path: '/legacy/*', remote: 'legacy', module: './App' });
    // dashboard not duplicated.
    expect(m.routes.filter((r: { remote: string }) => r.remote === 'dashboard')).toHaveLength(1);
  });

  it('scans pages authored as .mjs / .cjs / .js / .jsx (not just .tsx)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-ext-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    const dashDir = path.join(appsDir, 'dashboard');
    await fs.ensureDir(path.join(dashDir, 'src', 'pages', 'reports'));
    await fs.writeJson(path.join(dashDir, 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });
    await fs.writeJson(path.join(dashDir, 'tsconfig.json'), { compilerOptions: {} });
    // Same route table, five different source extensions.
    await fs.outputFile(path.join(dashDir, 'src', 'pages', 'index.mjs'), 'export default () => null;\n');
    await fs.outputFile(path.join(dashDir, 'src', 'pages', 'about.cjs'), 'module.exports = () => null;\n');
    await fs.outputFile(path.join(dashDir, 'src', 'pages', 'contact.js'), 'export default () => null;\n');
    await fs.outputFile(path.join(dashDir, 'src', 'pages', 'help.jsx'), 'export default () => null;\n');
    await fs.outputFile(path.join(dashDir, 'src', 'pages', 'reports', '[id].mjs'), 'export default () => null;\n');

    await runCommand(['--dir', tmp], tmp);

    const manifest = await fs.readJson(path.join(dashDir, 'jorvel.routes.json'));
    const paths = manifest.routes.map((r: { path: string }) => r.path).sort();
    expect(paths).toEqual(['/', '/about', '/contact', '/help', '/reports/:id'].sort());

    // The generated import module must strip the extension (bare specifier).
    const mod = await fs.readFile(path.join(dashDir, 'src', 'jorvel.routes.js'), 'utf8');
    expect(mod).toMatch(/import\(["']\.\/pages\/index["']\)/);
    expect(mod).not.toMatch(/\.mjs["']\)/);
    expect(mod).not.toMatch(/\.cjs["']\)/);
  });

  it('generates correct import path inside jorvel.routes.ts', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routes-'))) as string;
    const { dashDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const content = await fs.readFile(path.join(dashDir, 'src', 'jorvel.routes.ts'), 'utf8');
    // Import paths should be relative to src/ (i.e. './pages/...')
    expect(content).toMatch(/import\(["']\.\/pages\//);
  });
});
