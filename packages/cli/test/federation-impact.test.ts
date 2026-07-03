import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { analyzeImpact, runImpact } from '../src/commands/federation-impact.js';

describe('analyzeImpact', () => {
  it('maps remotes to their consuming hosts', () => {
    const impact = analyzeImpact([
      { host: 'shell', remotes: { dashboard: 'd@u1', billing: 'b@u2' } },
      { host: 'admin', remotes: { dashboard: 'd@u1' } },
    ]);
    const dash = impact.find((e) => e.remote === 'dashboard')!;
    expect(dash.consumers).toEqual(['admin', 'shell']);
    const billing = impact.find((e) => e.remote === 'billing')!;
    expect(billing.consumers).toEqual(['shell']);
  });
});

describe('runImpact', () => {
  it('reports consumers from federation configs', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-impact-'))) as string;
    await fs.writeJson(path.join(tmp, 'jorvel.config.json'), { name: 'w', appsDir: 'apps' });
    const mk = async (name: string, type: string, fed: object) => {
      const dir = path.join(tmp, 'apps', name);
      await fs.ensureDir(dir);
      await fs.writeJson(path.join(dir, 'jorvel.app.json'), { name, type, port: 3000 });
      await fs.writeJson(path.join(dir, 'jorvel.federation.json'), fed);
    };
    await mk('shell', 'host', { name: 'shell', remotes: { dashboard: 'dashboard@http://x/remoteEntry.js' } });
    await mk('dashboard', 'remote', { name: 'dashboard', exposes: { './App': './src/App' } });

    const out: string[] = [];
    const impact = await runImpact({ dir: tmp, log: (m) => out.push(m) });
    expect(impact).toContainEqual({ remote: 'dashboard', consumers: ['shell'] });

    const filtered = await runImpact({ dir: tmp, remote: 'nope', log: () => {} });
    expect(filtered).toEqual([]);
  });
});
