import { describe, expect, it, vi, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { addCommand } from '../src/commands/add.js';
import { generateCommand } from '../src/commands/generate.js';

afterEach(() => vi.restoreAllMocks());

async function scaffoldHost(tmp: string) {
  const hostDir = path.join(tmp, 'apps', 'shell');
  await fs.ensureDir(path.join(hostDir, 'src'));
  await fs.writeJson(path.join(hostDir, 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  await fs.writeJson(path.join(hostDir, 'jorvel.federation.json'), {
    name: 'shell',
    filename: 'remoteEntry.js',
    remotes: {},
  });
  await fs.writeJson(path.join(hostDir, 'jorvel.routes.host.json'), { host: 'shell', routes: [] });
  await fs.writeFile(
    path.join(hostDir, 'src', 'bootstrap.tsx'),
    [
      "const REMOTES = {",
      "};",
      "function App() {",
      "  return <nav><NavLink to=\"/\" label=\"Home\" /></nav>;",
      "}",
      '',
    ].join('\n'),
    'utf8',
  );
  return hostDir;
}

async function run(cmd: typeof addCommand, argv: string[], cwd: string) {
  cmd.exitOverride();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await cmd.parseAsync(argv, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('jorvel add remote', () => {
  it('wires a remote into the host (federation + routes + types + bootstrap)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-add-'))) as string;
    const hostDir = await scaffoldHost(tmp);

    await run(addCommand, ['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const fed = await fs.readJson(path.join(hostDir, 'jorvel.federation.json'));
    expect(fed.remotes.dashboard).toBe('dashboard@http://localhost:3001/remoteEntry.js');

    const routes = await fs.readJson(path.join(hostDir, 'jorvel.routes.host.json'));
    expect(routes.routes).toContainEqual({ path: '/dashboard/*', remote: 'dashboard', module: './App' });

    const dts = await fs.readFile(path.join(hostDir, 'src', 'remotes.d.ts'), 'utf8');
    expect(dts).toContain("declare module 'dashboard/App'");

    const bootstrap = await fs.readFile(path.join(hostDir, 'src', 'bootstrap.tsx'), 'utf8');
    expect(bootstrap).toContain("import('dashboard/App')");
    expect(bootstrap).toContain('to="/dashboard"');
  });

  it('sanitizes the container global for a hyphenated remote name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-add-h-'))) as string;
    const hostDir = await scaffoldHost(tmp);

    await run(addCommand, ['remote', 'user-portal', '--dir', tmp, '--url', 'https://cdn/x/remoteEntry.js'], tmp);

    const fed = await fs.readJson(path.join(hostDir, 'jorvel.federation.json'));
    // key keeps the hyphen; global (left of @) is sanitized.
    expect(fed.remotes['user-portal']).toBe('user_portal@https://cdn/x/remoteEntry.js');
  });

  it('is idempotent (no duplicate route on re-run)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-add-idem-'))) as string;
    const hostDir = await scaffoldHost(tmp);
    await run(addCommand, ['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
    await run(addCommand, ['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);
    const routes = await fs.readJson(path.join(hostDir, 'jorvel.routes.host.json'));
    expect(routes.routes.filter((r: { remote: string }) => r.remote === 'dashboard')).toHaveLength(1);
  });
});

describe('jorvel generate types', () => {
  it('emits remotes.d.ts from the host federation config', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-gentypes-'))) as string;
    const hostDir = await scaffoldHost(tmp);
    await fs.writeJson(path.join(hostDir, 'jorvel.federation.json'), {
      name: 'shell',
      remotes: { dashboard: 'dashboard@http://x/r.js', billing: 'billing@http://y/r.js' },
    });

    await run(generateCommand, ['types', '--dir', tmp], tmp);

    const dts = await fs.readFile(path.join(hostDir, 'src', 'remotes.d.ts'), 'utf8');
    expect(dts).toContain("declare module 'dashboard/App'");
    expect(dts).toContain("declare module 'billing/App'");
  });
});
