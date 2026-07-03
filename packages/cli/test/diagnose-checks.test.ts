import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { diagnoseCommand } from '../src/commands/diagnose.js';

// diagnose calls process.exit at the end; capture instead of exiting the runner.
async function run(cwd: string): Promise<string[]> {
  const logs: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...a) => { logs.push(a.join(' ')); });
  const exit = vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never));
  diagnoseCommand.exitOverride();
  try {
    await diagnoseCommand.parseAsync(['diagnose', '--cwd', cwd], { from: 'user' });
  } finally {
    log.mockRestore();
    exit.mockRestore();
  }
  return logs;
}

async function workspace(): Promise<string> {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-diag-'))) as string;
  await fs.writeJson(path.join(tmp, 'package.json'), { name: 'demo' });
  await fs.writeFile(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n');
  await fs.writeJson(path.join(tmp, 'jorvel.config.json'), { name: 'demo', appsDir: 'apps' });
  await fs.ensureDir(path.join(tmp, 'apps', 'shell'));
  await fs.writeJson(path.join(tmp, 'apps', 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  return tmp;
}

describe('diagnose extra checks', () => {
  it('flags missing .env keys against .env.example', async () => {
    const tmp = await workspace();
    await fs.writeFile(path.join(tmp, '.env.example'), 'PORT=3000\nDATABASE_URL=\n');
    await fs.writeFile(path.join(tmp, '.env'), 'PORT=3000\n'); // DATABASE_URL missing
    const logs = (await run(tmp)).join('\n');
    expect(logs).toMatch(/\.env/);
    expect(logs).toMatch(/DATABASE_URL/);
  }, 30_000);

  it('warns on federation contract drift when config is missing', async () => {
    const tmp = await workspace();
    const logs = (await run(tmp)).join('\n');
    expect(logs).toMatch(/contract drift/);
    expect(logs).toMatch(/federation/);
  }, 30_000);
});
