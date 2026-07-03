import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { collectInfo, formatInfo } from '../src/commands/info.js';

async function workspace(): Promise<string> {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-info-'))) as string;
  await fs.writeJson(path.join(tmp, 'jorvel.config.json'), { name: 'demo', appsDir: 'apps' });
  await fs.writeJson(path.join(tmp, 'package.json'), {
    name: 'demo',
    devDependencies: { jorvel: '^0.2.0', '@jorvel/runtime': 'workspace:*', eslint: '^9' },
  });
  await fs.ensureDir(path.join(tmp, 'apps', 'shell'));
  await fs.writeJson(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  return tmp;
}

describe('jorvel info', () => {
  it('collects environment + workspace details', async () => {
    const tmp = await workspace();
    const r = await collectInfo(tmp);
    expect(r.node).toBe(process.version);
    expect(r.os).toBeTruthy();
    expect(r.workspace).toBe('demo');
    expect(r.apps).toContainEqual({ name: 'shell', type: 'host', port: 3000 });
    expect(r.jorvelDeps['jorvel']).toBe('^0.2.0');
    expect(r.jorvelDeps['@jorvel/runtime']).toBe('workspace:*');
    expect(r.jorvelDeps['eslint']).toBeUndefined(); // non-jorvel deps excluded
  });

  it('formatInfo renders a readable block', async () => {
    const tmp = await workspace();
    const text = formatInfo(await collectInfo(tmp));
    expect(text).toContain('JORVEL environment info');
    expect(text).toContain('Node:');
    expect(text).toContain('shell (host) :3000');
  });

  it('handles a non-workspace dir gracefully', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-info-empty-'))) as string;
    const r = await collectInfo(tmp);
    expect(r.workspace).toBeNull();
    expect(r.apps).toEqual([]);
  });
});
