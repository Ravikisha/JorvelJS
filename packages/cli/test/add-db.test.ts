import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { scaffoldDb } from '../src/commands/add-db.js';

async function workspace(opts: { ts?: boolean; withEnv?: boolean } = {}): Promise<string> {
  const ts = opts.ts ?? true;
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-adddb-'))) as string;
  const shell = path.join(tmp, 'apps', 'shell');
  await fs.ensureDir(shell);
  await fs.writeJson(path.join(shell, 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  await fs.writeJson(path.join(shell, 'package.json'), { name: '@app/shell', private: true });
  if (ts) await fs.writeJson(path.join(shell, 'tsconfig.json'), {});
  if (opts.withEnv) await fs.writeFile(path.join(tmp, '.env.example'), 'PORT=3000\n', 'utf8');
  return tmp;
}

describe('scaffoldDb (sqlite, default)', () => {
  it('writes schema, client, seed, data loader, and drizzle config', async () => {
    const tmp = await workspace();
    const written = await scaffoldDb({ dir: tmp, log: () => {} });
    const shell = path.join(tmp, 'apps', 'shell');
    for (const rel of ['src/db/schema.ts', 'src/db/client.ts', 'src/db/seed.ts', 'src/server/posts.data.ts', 'drizzle.config.ts']) {
      expect(await fs.pathExists(path.join(shell, rel))).toBe(true);
    }
    expect(written.some((w) => w.includes('schema.ts'))).toBe(true);
  });

  it('uses better-sqlite3 in the client and exports inferred types', async () => {
    const tmp = await workspace();
    await scaffoldDb({ dir: tmp, log: () => {} });
    const client = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'db', 'client.ts'), 'utf8');
    expect(client).toContain("drizzle-orm/better-sqlite3");
    expect(client).toContain('better-sqlite3');
    const schema = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'db', 'schema.ts'), 'utf8');
    expect(schema).toContain('export type User');
    expect(schema).toContain("sqliteTable('users'");
  });

  it('adds drizzle deps + db scripts to the app package.json', async () => {
    const tmp = await workspace();
    await scaffoldDb({ dir: tmp, log: () => {} });
    const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
    expect(pkg.dependencies['drizzle-orm']).toBeDefined();
    expect(pkg.dependencies['better-sqlite3']).toBeDefined();
    expect(pkg.dependencies['@jorvel/ssr']).toBe('workspace:*');
    expect(pkg.devDependencies['drizzle-kit']).toBeDefined();
    expect(pkg.devDependencies['@types/better-sqlite3']).toBeDefined();
    expect(pkg.scripts['db:generate']).toBe('drizzle-kit generate');
    expect(pkg.scripts['db:migrate']).toBe('drizzle-kit migrate');
    expect(pkg.scripts['db:studio']).toBe('drizzle-kit studio');
  });

  it('appends DATABASE_URL to .env.example without duplicating', async () => {
    const tmp = await workspace({ withEnv: true });
    await scaffoldDb({ dir: tmp, log: () => {} });
    let env = await fs.readFile(path.join(tmp, '.env.example'), 'utf8');
    expect(env).toContain('PORT=3000');
    expect(env).toMatch(/^DATABASE_URL=file:\.\/data\/app\.db$/m);
    // Idempotent: a second run does not add a second DATABASE_URL.
    await scaffoldDb({ dir: tmp, log: () => {} });
    env = await fs.readFile(path.join(tmp, '.env.example'), 'utf8');
    expect(env.match(/DATABASE_URL=/g)).toHaveLength(1);
  });

  it('data loader uses defineLoader from @jorvel/ssr', async () => {
    const tmp = await workspace();
    await scaffoldDb({ dir: tmp, log: () => {} });
    const data = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'server', 'posts.data.ts'), 'utf8');
    expect(data).toContain("from '@jorvel/ssr'");
    expect(data).toContain('defineLoader');
    expect(data).toContain('recentPostsLoader');
  });
});

describe('scaffoldDb (libsql)', () => {
  it('uses @libsql/client and turso driver in drizzle config', async () => {
    const tmp = await workspace();
    await scaffoldDb({ dir: tmp, driver: 'libsql', log: () => {} });
    const client = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'db', 'client.ts'), 'utf8');
    expect(client).toContain('@libsql/client');
    expect(client).toContain('drizzle-orm/libsql');
    const cfg = await fs.readFile(path.join(tmp, 'apps', 'shell', 'drizzle.config.ts'), 'utf8');
    expect(cfg).toContain("driver: 'turso'");
    const pkg = await fs.readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
    expect(pkg.dependencies['@libsql/client']).toBeDefined();
    expect(pkg.dependencies['better-sqlite3']).toBeUndefined();
  });

  it('writes a TURSO_AUTH_TOKEN hint into .env.example', async () => {
    const tmp = await workspace({ withEnv: true });
    await scaffoldDb({ dir: tmp, driver: 'libsql', log: () => {} });
    const env = await fs.readFile(path.join(tmp, '.env.example'), 'utf8');
    expect(env).toContain('DATABASE_URL=file:local.db');
    expect(env).toContain('TURSO_AUTH_TOKEN');
  });
});

describe('scaffoldDb — JS app + targeting + errors', () => {
  it('emits .js files for a JS app (no tsconfig.json)', async () => {
    const tmp = await workspace({ ts: false });
    await scaffoldDb({ dir: tmp, log: () => {} });
    const shell = path.join(tmp, 'apps', 'shell');
    expect(await fs.pathExists(path.join(shell, 'src', 'db', 'schema.js'))).toBe(true);
    expect(await fs.pathExists(path.join(shell, 'src', 'db', 'schema.ts'))).toBe(false);
    const schema = await fs.readFile(path.join(shell, 'src', 'db', 'schema.js'), 'utf8');
    expect(schema).not.toContain('export type User'); // no TS types in JS output
  });

  it('targets a named app', async () => {
    const tmp = await workspace();
    const remote = path.join(tmp, 'apps', 'dashboard');
    await fs.ensureDir(remote);
    await fs.writeJson(path.join(remote, 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });
    await fs.writeJson(path.join(remote, 'package.json'), { name: '@app/dashboard' });
    await fs.writeJson(path.join(remote, 'tsconfig.json'), {});
    await scaffoldDb({ dir: tmp, app: 'dashboard', log: () => {} });
    expect(await fs.pathExists(path.join(remote, 'src', 'db', 'schema.ts'))).toBe(true);
    // host untouched
    expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'src', 'db', 'schema.ts'))).toBe(false);
  });

  it('throws when the named app does not exist', async () => {
    const tmp = await workspace();
    await expect(scaffoldDb({ dir: tmp, app: 'nope', log: () => {} })).rejects.toThrow(/not found/);
  });

  it('rejects an unknown driver', async () => {
    const tmp = await workspace();
    // @ts-expect-error testing runtime guard
    await expect(scaffoldDb({ dir: tmp, driver: 'postgres', log: () => {} })).rejects.toThrow(/driver/);
  });
});
