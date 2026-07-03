import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import kleur from 'kleur';

/** Minimal `.env` parser (KEY=VALUE, # comments, optional surrounding quotes). */
function parseDotenv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

export const envCommand = new Command('env')
  .description('Inspect, validate, and scaffold environment variables.')
  .option('--cwd <dir>', 'Workspace root', process.cwd());

envCommand
  .command('check')
  .description('Verify required env vars listed in .env.example are defined.')
  .action(async (_opts, cmd) => {
    const cwd = path.resolve((cmd.parent?.opts().cwd as string) ?? process.cwd());
    const example = path.join(cwd, '.env.example');
    if (!(await fs.pathExists(example))) {
      console.error(kleur.red('env check: .env.example missing. Run `jorvel env scaffold`.'));
      process.exit(1);
    }
    const raw = await fs.readFile(example, 'utf8');
    const vars = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0]!);
    // Also load `.env` — the file users are told to create — so vars defined
    // there count as present (previously the check only looked at process.env
    // and failed in the exact setup it recommends).
    const dotenvPath = path.join(cwd, '.env');
    const dotenv = (await fs.pathExists(dotenvPath))
      ? parseDotenv(await fs.readFile(dotenvPath, 'utf8'))
      : {};
    const isPresent = (v: string) =>
      (process.env[v] !== undefined && process.env[v] !== '') ||
      (dotenv[v] !== undefined && dotenv[v] !== '');
    const missing = vars.filter((v) => !isPresent(v));
    if (missing.length === 0) {
      console.log(kleur.green('all required env vars present'));
      return;
    }
    console.error(kleur.red(`missing env vars:\n  - ${missing.join('\n  - ')}`));
    process.exit(1);
  });

envCommand
  .command('scaffold')
  .description('Write a starter .env.example.')
  .action(async (_opts, cmd) => {
    const cwd = path.resolve((cmd.parent?.opts().cwd as string) ?? process.cwd());
    const example = path.join(cwd, '.env.example');
    if (await fs.pathExists(example)) {
      console.log(kleur.dim('.env.example already exists'));
      return;
    }
    await fs.writeFile(
      example,
      `# Copy to .env and fill in values.
PORT=3000
NODE_ENV=development
JORVEL_REMOTES_URL=
JORVEL_CDN_URL=
SENTRY_DSN=
`,
      'utf8',
    );
    console.log(kleur.green('wrote .env.example'));
  });
