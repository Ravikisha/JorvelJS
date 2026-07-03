import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  diffFederationConfigs,
  hasBreaking,
  runFederationDiff,
  type DiffableFederationConfig,
} from '../src/commands/federation-diff.js';

describe('diffFederationConfigs', () => {
  it('flags a removed exposed module as breaking', () => {
    const base = { dash: { name: 'dash', exposes: { './App': 'src/App', './Widget': 'src/Widget' } } };
    const head = { dash: { name: 'dash', exposes: { './App': 'src/App' } } };
    const changes = diffFederationConfigs(base, head);
    expect(changes).toContainEqual(
      expect.objectContaining({ app: 'dash', kind: 'exposes', severity: 'breaking' }),
    );
    expect(hasBreaking(changes)).toBe(true);
  });

  it('flags an added exposed module as compatible', () => {
    const base = { dash: { name: 'dash', exposes: { './App': 'src/App' } } };
    const head = { dash: { name: 'dash', exposes: { './App': 'src/App', './New': 'src/New' } } };
    const changes = diffFederationConfigs(base, head);
    expect(changes.every((c) => c.severity !== 'breaking')).toBe(true);
    expect(changes).toContainEqual(expect.objectContaining({ severity: 'compatible' }));
  });

  it('flags a removed remote app as breaking', () => {
    const base = { a: { name: 'a' }, b: { name: 'b' } };
    const head = { a: { name: 'a' } };
    const changes = diffFederationConfigs(base, head);
    expect(changes).toContainEqual(
      expect.objectContaining({ app: 'b', kind: 'app', severity: 'breaking' }),
    );
  });

  it('flags a singleton demotion as breaking', () => {
    const base: Record<string, DiffableFederationConfig> = {
      a: { name: 'a', shared: { react: { singleton: true } } },
    };
    const head: Record<string, DiffableFederationConfig> = {
      a: { name: 'a', shared: { react: { singleton: false } } },
    };
    const changes = diffFederationConfigs(base, head);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'shared', severity: 'breaking' }),
    );
  });

  it('flags a shared requiredVersion change as risky and a removed dep as risky', () => {
    const base: Record<string, DiffableFederationConfig> = {
      a: { name: 'a', shared: { react: { singleton: true, requiredVersion: '^18' }, lodash: {} } },
    };
    const head: Record<string, DiffableFederationConfig> = {
      a: { name: 'a', shared: { react: { singleton: true, requiredVersion: '^19' } } },
    };
    const changes = diffFederationConfigs(base, head);
    expect(changes.filter((c) => c.severity === 'risky')).toHaveLength(2);
    expect(hasBreaking(changes)).toBe(false);
  });

  it('flags a remote url change as info, not breaking', () => {
    const base = { host: { name: 'host', remotes: { dash: 'dash@http://localhost:3001/remoteEntry.js' } } };
    const head = { host: { name: 'host', remotes: { dash: 'dash@https://cdn.example.com/remoteEntry.js' } } };
    const changes = diffFederationConfigs(base, head);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'remotes', severity: 'info' }));
    expect(hasBreaking(changes)).toBe(false);
  });

  it('returns no changes for identical configs', () => {
    const cfg = { a: { name: 'a', exposes: { './App': 'src/App' }, shared: { react: { singleton: true } } } };
    expect(diffFederationConfigs(cfg, cfg)).toEqual([]);
  });

  it('sorts breaking changes first', () => {
    const base = { a: { name: 'a', exposes: { './App': 'x', './Gone': 'y' } } };
    const head = { a: { name: 'a', exposes: { './App': 'x', './Added': 'z' } } };
    const changes = diffFederationConfigs(base, head);
    expect(changes[0]!.severity).toBe('breaking');
  });
});

describe('runFederationDiff', () => {
  async function workspace(): Promise<string> {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fdiff-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'dashboard'));
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), {
      name: 'dashboard', type: 'remote', port: 3001,
    });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'), {
      name: 'dashboard', filename: 'remoteEntry.js', exposes: { './App': './src/App' },
      shared: { react: { singleton: true } },
    });
    return tmp;
  }

  it('exits 1 when a base contract has an exposed module the head dropped', async () => {
    const tmp = await workspace();
    const out: string[] = [];
    const { changes, exitCode } = await runFederationDiff({
      dir: tmp,
      base: 'main',
      log: (m) => out.push(m),
      // base had two exposes; head (on disk) has one → './Widget' removed = breaking
      readBase: async (rel) =>
        rel.includes('dashboard')
          ? JSON.stringify({ name: 'dashboard', exposes: { './App': './src/App', './Widget': './src/Widget' }, shared: { react: { singleton: true } } })
          : null,
    });
    expect(hasBreaking(changes)).toBe(true);
    expect(exitCode).toBe(1);
  });

  it('exits 0 with --allow-breaking', async () => {
    const tmp = await workspace();
    const { exitCode } = await runFederationDiff({
      dir: tmp,
      base: 'main',
      allowBreaking: true,
      log: () => {},
      readBase: async () => JSON.stringify({ name: 'dashboard', exposes: { './App': './src/App', './Widget': './src/Widget' } }),
    });
    expect(exitCode).toBe(0);
  });

  it('exits 0 when nothing changed', async () => {
    const tmp = await workspace();
    const { changes, exitCode } = await runFederationDiff({
      dir: tmp,
      base: 'main',
      log: () => {},
      readBase: async (rel) =>
        rel.includes('dashboard')
          ? JSON.stringify({ name: 'dashboard', exposes: { './App': './src/App' }, shared: { react: { singleton: true } } })
          : null,
    });
    expect(changes).toEqual([]);
    expect(exitCode).toBe(0);
  });
});
