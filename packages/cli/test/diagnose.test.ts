import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { diagnoseCommand } from '../src/commands/diagnose.js';

async function run(argv: string[], cwd: string): Promise<number> {
  diagnoseCommand.exitOverride();
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`__exit__:${code ?? 0}`);
  });
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await diagnoseCommand.parseAsync(['diagnose', ...argv], { from: 'user' });
    return 0;
  } catch (e) {
    const m = /^__exit__:(\d+)$/.exec((e as Error).message);
    if (m) return Number(m[1]);
    throw e;
  } finally {
    process.chdir(prev);
    exitSpy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('jorvel diagnose', () => {
  it('exits non-zero when workspace root has no package.json', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-diag-'))) as string;
    const code = await run(['--cwd', tmp], tmp);
    expect(code).toBe(1);
  });

  it('exits 0 on a minimally healthy workspace (warns only)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-diag-'))) as string;
    await fs.writeJson(path.join(tmp, 'package.json'), { name: 'x', private: true });
    await fs.writeFile(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    const code = await run(['--cwd', tmp], tmp);
    expect(code).toBe(0);
  });

  it('fails on a port conflict between apps', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-diag-'))) as string;
    await fs.writeJson(path.join(tmp, 'package.json'), { name: 'x', private: true });
    await fs.writeFile(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    await fs.ensureDir(path.join(tmp, 'apps', 'shell'));
    await fs.ensureDir(path.join(tmp, 'apps', 'dashboard'));
    await fs.writeJson(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(tmp, 'apps', 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3000 });
    const code = await run(['--cwd', tmp], tmp);
    expect(code).toBe(1);
  });

  it('lists discovered apps', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-diag-'))) as string;
    await fs.writeJson(path.join(tmp, 'package.json'), { name: 'x', private: true });
    await fs.writeFile(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    await fs.ensureDir(path.join(tmp, 'apps', 'shell'));
    await fs.writeJson(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host' });
    await run(['--cwd', tmp], tmp);
    expect(logs.some((l) => l.includes('shell'))).toBe(true);
  });
});
