import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { federationCommand } from '../src/commands/federation.js';

async function runCommand(argv: string[], cwd: string) {
  federationCommand.exitOverride();
  federationCommand.configureHelp({ helpWidth: 120 });

  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await federationCommand.parseAsync(['federation', ...argv], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

async function scaffold(tmp: string) {
  const appsDir = path.join(tmp, 'apps');
  await fs.ensureDir(path.join(appsDir, 'shell'));
  await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  await fs.ensureDir(path.join(appsDir, 'dashboard'));
  await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });
  return appsDir;
}

describe('jorvel federation', () => {
  it('writes jorvel.federation.json for host and remote apps', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    expect(remoteCfg).toMatchObject({
      name: 'dashboard',
      filename: 'remoteEntry.js'
    });

    expect(hostCfg).toMatchObject({
      name: 'shell',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js'
      }
    });
  });

  it('wires hyphenated remotes with a sanitized container global on the host', async () => {
    // Regression: a remote named `user-portal` has container global `user_portal`
    // (ModuleFederationPlugin name), but the host must reference that same global
    // on the left of `@` while keeping the hyphenated import-specifier key.
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-hyphen-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.ensureDir(path.join(appsDir, 'user-portal'));
    await fs.writeJson(path.join(appsDir, 'user-portal', 'jorvel.app.json'), { name: 'user-portal', type: 'remote', port: 3002 });

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'user-portal', 'jorvel.federation.json'));
    expect(remoteCfg.name).toBe('user_portal');

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    // Key keeps the hyphen (import('user-portal/App')); global is sanitized.
    expect(hostCfg.remotes['user-portal']).toBe('user_portal@http://localhost:3002/remoteEntry.js');
  });

  it('remote config has correct name and filename fields', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));
    expect(remoteCfg.name).toBe('dashboard');
    expect(remoteCfg.filename).toBe('remoteEntry.js');
  });

  it('remote config exposes ./App when src/remote.tsx exists', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);
    // Create the entry file so the federation generator can detect it.
    await fs.outputFile(
      path.join(appsDir, 'dashboard', 'src', 'remote.tsx'),
      'export default function Remote() { return null; }\n'
    );

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));
    expect(remoteCfg.exposes?.['./App']).toBe('./src/remote.tsx');
  });

  it('react and react-dom shared entries have singleton: true', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));
    const shared = remoteCfg.shared as Record<string, any>;

    expect(shared['react']?.singleton).toBe(true);
    expect(shared['react-dom']?.singleton).toBe(true);
  });

  it('@jorvel/runtime is always a singleton shared dep to prevent duplicate runtime instances', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    expect(hostCfg.shared?.['@jorvel/runtime']?.singleton).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/runtime']?.singleton).toBe(true);
    // HOST eager:true — owns the share scope; REMOTE eager:false — lazy-resolves
    // through host's scope via the async boundary in main.{tsx,jsx}.
    expect(hostCfg.shared?.['@jorvel/runtime']?.eager).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/runtime']?.eager).toBe(false);
  });

  it('a non-react remote shares its OWN framework runtime, not react', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    // A Vue remote with an explicit exposed entry.
    await fs.ensureDir(path.join(appsDir, 'pricing', 'src'));
    await fs.writeJson(path.join(appsDir, 'pricing', 'jorvel.app.json'), {
      name: 'pricing',
      type: 'remote',
      port: 3002,
      framework: 'vue',
      exposes: { './App': './src/remote.ts' },
    });

    await runCommand(['--dir', tmp], tmp);

    const cfg = await fs.readJson(path.join(appsDir, 'pricing', 'jorvel.federation.json'));
    const shared = cfg.shared as Record<string, { singleton: boolean }>;
    expect(shared['vue']?.singleton).toBe(true);
    expect(shared['@jorvel/event-bus']?.singleton).toBe(true);
    // A Vue remote must NOT force react / the React runtime into its scope.
    expect(shared['react']).toBeUndefined();
    expect(shared['react-dom']).toBeUndefined();
    expect(shared['@jorvel/runtime']).toBeUndefined();
    // Host still wires the vue remote.
    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    expect(hostCfg.remotes?.['pricing']).toContain('remoteEntry.js');
  });

  it('@jorvel/event-bus is a singleton on both sides; eager on host, lazy on remote', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    expect(hostCfg.shared?.['@jorvel/event-bus']?.singleton).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/event-bus']?.singleton).toBe(true);
    expect(hostCfg.shared?.['@jorvel/event-bus']?.eager).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/event-bus']?.eager).toBe(false);
  });

  it('react/react-dom — eager on host (share-scope owner), lazy on remote', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    // Host must be eager so the share scope is populated before any remote loads.
    expect(hostCfg.shared?.['react']?.eager).toBe(true);
    expect(hostCfg.shared?.['react-dom']?.eager).toBe(true);
    // Remote must be lazy so the async boundary (main → import('./bootstrap'))
    // can initialize the share scope before React is consumed synchronously.
    expect(remoteCfg.shared?.['react']?.eager).toBe(false);
    expect(remoteCfg.shared?.['react-dom']?.eager).toBe(false);
  });

  it('host remotes map uses name@url format pointing to the remote port', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    expect(hostCfg.remotes.dashboard).toBe('dashboard@http://localhost:3001/remoteEntry.js');
  });

  it('running federation twice produces the same output (idempotent)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);
    const firstRun = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));

    await runCommand(['--dir', tmp], tmp);
    const secondRun = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));

    expect(firstRun).toEqual(secondRun);
  });
});
