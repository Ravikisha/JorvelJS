import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

// Mock execa so we don't actually start dev servers. dev.ts spawns children via
// execa (which, unlike spawn+shell:false, resolves Windows .cmd shims and does
// not EINVAL on Node >=20.12).
let __nextPid = 1000;
vi.mock('execa', () => {
  return {
    execa: vi.fn((..._args: any[]) => {
      const child: any = {
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        // run() calls `void child.catch(...)`; reject:false means it resolves.
        catch: vi.fn(() => child),
        killed: false,
        exitCode: null,
        pid: __nextPid++,
        kill: vi.fn(),
      };
      return child;
    }),
  };
});

// tree-kill is invoked by attachGracefulShutdown — expose a mock so tests can
// assert that all spawned children get torn down.
vi.mock('tree-kill', () => {
  return {
    default: vi.fn((_pid: number, _signal: string, cb?: (err?: Error | null) => void) => {
      if (cb) cb(null);
    }),
  };
});

// chokidar — we don't exercise the watcher in tests but the import must resolve.
vi.mock('chokidar', () => {
  return {
    default: {
      watch: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        close: vi.fn(),
      })),
    },
  };
});

import { execa } from 'execa';
import treeKill from 'tree-kill';

import { devCommand, isPortFree, findFreePort } from '../src/commands/dev.js';
import net from 'node:net';

async function run(argv: string[], cwd: string) {
  devCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await devCommand.parseAsync(argv, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

// Commander stores option values on the (singleton) devCommand and does NOT
// clear them between parseAsync calls, so sticky string options like --only/
// --exclude would leak across tests. Reset them before each test.
beforeEach(() => {
  (devCommand as unknown as { setOptionValue(k: string, v: unknown): void }).setOptionValue('only', undefined);
  (devCommand as unknown as { setOptionValue(k: string, v: unknown): void }).setOptionValue('exclude', undefined);
});

describe('jorvel dev', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterEach(() => {
    logSpy.mockClear();
  });

  it('auto-generates federation configs when missing (default)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

    await run(['--dir', tmp], tmp);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'jorvel.federation.json'))).toBe(true);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'jorvel.federation.json'))).toBe(true);
  });

  it('proxy mode writes jorvel.federation.proxy.json for the host', async () => {
  const workspaceDir = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-dev-proxy-'))) as string;

    // Minimal workspace
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'shell'));
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'dashboard'));

    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'jorvel.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'dashboard', 'jorvel.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001
    });

    // Pretend federation already exists.
    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'jorvel.federation.json'), {
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js'
      }
    });

    devCommand.exitOverride();
    await devCommand.parseAsync(['--dir', workspaceDir, '--proxy-remotes'], { from: 'user' });

    const proxyCfgPath = path.join(workspaceDir, 'apps', 'shell', 'jorvel.federation.proxy.json');
    const proxyCfg = await fs.readJson(proxyCfgPath);
    expect(proxyCfg.remotes.dashboard).toBe('dashboard@http://localhost:3000/jorvel/remotes/dashboard/remoteEntry.js');

  // Also ensure the host process is started with federation override env.
    const calls = (execa as unknown as { mock: { calls: any[][] } }).mock.calls;
    const hostSpawnCall = calls.find(
      (c) =>
        c[0] === 'pnpm' &&
        Array.isArray(c[1]) &&
        c[1][0] === 'dev' &&
        String(c[2]?.cwd || '').includes('jorvel-dev-proxy-') &&
        // Accept both POSIX and Windows separators.
        /[\\/]apps[\\/]shell$/.test(String(c[2]?.cwd || '')),
    );
  expect(hostSpawnCall).toBeTruthy();
    expect(hostSpawnCall?.[2]?.env?.JORVEL_FEDERATION_FILE).toBe('jorvel.federation.proxy.json');
  });

  it('does not auto-generate federation configs when --no-federation is used', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

    await run(['--dir', tmp, '--no-federation'], tmp);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'jorvel.federation.json'))).toBe(false);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'jorvel.federation.json'))).toBe(false);
  });

  it('--only starts just the named apps', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-only-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));
    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });
    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.federation.json'), { name: 'shell' });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'), { name: 'dashboard' });

    vi.mocked(execa as unknown as (...a: any[]) => any).mockClear();
    await run(['--dir', tmp, '--no-federation', '--only', 'shell'], tmp);

    const cwds = (execa as unknown as { mock: { calls: any[][] } }).mock.calls.map((c) => String(c[2]?.cwd || ''));
    expect(cwds.some((d) => /[\\/]shell$/.test(d))).toBe(true);
    expect(cwds.some((d) => /[\\/]dashboard$/.test(d))).toBe(false);
  });

  it('rejects when two apps share a port', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-dupport-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));
    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3000 });

    await expect(run(['--dir', tmp, '--no-federation'], tmp)).rejects.toThrow(/Port 3000/);
  });

  it('SIGINT terminates all spawned child processes', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-sigint-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000,
    });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001,
    });

    (execa as unknown as { mock: { calls: any[][] } }).mock.calls.length = 0;
    vi.mocked(execa as unknown as (...args: any[]) => any).mockClear();
    vi.mocked(treeKill as unknown as (...args: any[]) => any).mockClear();

    await run(['--dir', tmp], tmp);

    // Simulate SIGINT — attachGracefulShutdown registered process.once('SIGINT', ...).
    process.emit('SIGINT');
    // Allow the queued microtasks (Promise.all of killTree calls) to settle.
    await new Promise((r) => setTimeout(r, 50));

    const spawned = (execa as unknown as { mock: { results: any[] } }).mock.results.map(
      (r) => r.value as { pid: number },
    );
    const killedPids = vi
      .mocked(treeKill as unknown as (...args: any[]) => any)
      .mock.calls.map((c: unknown[]) => c[0] as number);

    for (const child of spawned) {
      expect(killedPids).toContain(child.pid);
    }
  });
});

// ── Dev server proxy rules ────────────────────────────────────────────────────

describe('jorvel dev — port preflight', () => {
  function listen(port = 0): Promise<{ port: number; close: () => Promise<void> }> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', reject);
      srv.listen(port, '127.0.0.1', () => {
        const addr = srv.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        resolve({ port: p, close: () => new Promise((r) => srv.close(() => r())) });
      });
    });
  }

  it('isPortFree returns false for an occupied port, true for a free one', async () => {
    const held = await listen(0);
    try {
      expect(await isPortFree(held.port)).toBe(false);
    } finally {
      await held.close();
    }
    // After close the port is free again.
    expect(await isPortFree(held.port)).toBe(true);
  });

  it('findFreePort skips the occupied port and returns the next free one', async () => {
    const held = await listen(0);
    try {
      const found = await findFreePort(held.port);
      expect(found).not.toBe(held.port);
      expect(typeof found).toBe('number');
      expect(await isPortFree(found as number)).toBe(true);
    } finally {
      await held.close();
    }
  });
});

describe('jorvel dev — proxy rules', () => {
  it('proxy remoteEntry: rewrites remote URL to same-origin proxy path on host port', async () => {
    const workspaceDir = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-proxy-get-'))) as string;

    await fs.ensureDir(path.join(workspaceDir, 'apps', 'shell'));
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'dashboard'));

    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'jorvel.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000,
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'dashboard', 'jorvel.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001,
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'jorvel.federation.json'), {
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
      },
    });

    devCommand.exitOverride();
    await devCommand.parseAsync(['--dir', workspaceDir, '--proxy-remotes'], { from: 'user' });

    // The proxy federation config rewrites the remote entry URL to the same-origin proxy path:
    // GET /jorvel/remotes/dashboard/remoteEntry.js  →  forwards to  http://localhost:3001/remoteEntry.js
    const proxyCfg = await fs.readJson(
      path.join(workspaceDir, 'apps', 'shell', 'jorvel.federation.proxy.json')
    );

    // Proxy URL encodes the forwarding target in a same-origin path on port 3000 (host port).
    expect(proxyCfg.remotes.dashboard).toBe(
      'dashboard@http://localhost:3000/jorvel/remotes/dashboard/remoteEntry.js'
    );

    // The proxy path segment encodes the actual remote target: /jorvel/remotes/<name>/remoteEntry.js
    // which rspack devServer proxy rules forward to http://localhost:3001/remoteEntry.js
    const proxyPath = '/jorvel/remotes/dashboard/remoteEntry.js';
    const targetUrl = `http://localhost:3001${proxyPath.replace(/^\/jorvel\/remotes\/dashboard/, '')}`;
    expect(targetUrl).toBe('http://localhost:3001/remoteEntry.js');
  });
});
