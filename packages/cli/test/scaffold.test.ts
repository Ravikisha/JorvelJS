import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { scaffoldCommand } from '../src/commands/scaffold.js';

async function run(argv: string[], cwd: string): Promise<void> {
  // `scaffoldCommand` is the parent; the action lives on the `app` subcommand,
  // so prefix the argv with `app`.
  scaffoldCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await scaffoldCommand.parseAsync(['app', ...argv], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

afterEach(() => vi.restoreAllMocks());

describe('jorvel scaffold app --yes', () => {
  it('generates host + remote with jorvel.app.json', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-scaff-'))) as string;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['--dir', tmp, '--yes'], tmp);

    expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'jorvel.app.json'))).toBe(true);
  });

  it('writes federation config for host and remote', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-scaff-'))) as string;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['--dir', tmp, '--yes'], tmp);

    expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'jorvel.federation.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'jorvel.federation.json'))).toBe(true);
  });

  it('writes a smoke test under tests/', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-scaff-'))) as string;
    // Provide a package.json so the script-registration branch is exercised.
    await fs.writeJson(path.join(tmp, 'package.json'), { name: 'x', private: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['--dir', tmp, '--yes'], tmp);

    const test = path.join(tmp, 'tests', 'mfe-smoke.test.ts');
    expect(await fs.pathExists(test)).toBe(true);
    const txt = await fs.readFile(test, 'utf8');
    expect(txt).toContain('jorvel.app.json');

    const pkg = await fs.readJson(path.join(tmp, 'package.json'));
    expect(pkg.scripts['test:smoke']).toBeDefined();
    expect(pkg.devDependencies.vitest).toBeDefined();
  });
});
