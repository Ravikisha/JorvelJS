/**
 * `jorvel add db [app]` — scaffold a Drizzle ORM backend into an app.
 *
 * Drivers:
 *   - sqlite (default) — better-sqlite3, zero-infra local file DB
 *   - libsql           — @libsql/client, edge-friendly (Turso / local file)
 *
 * Writes a schema, a typed client, a seed script, and an example server data
 * module wired to a `defineLoader`, plus drizzle-kit config + package scripts
 * (db:generate / db:migrate / db:studio). End-to-end: scaffold → migrate →
 * read in a loader → render.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { discoverApps } from '../discovery.js';
import { JorvelCliError } from '../errors.js';

export type DbDriver = 'sqlite' | 'libsql';

export interface AddDbOptions {
  dir: string;
  app?: string;
  driver?: DbDriver;
  log?: (msg: string) => void;
}

interface TargetApp {
  dir: string;
  name: string;
  isTs: boolean;
}

async function resolveTarget(workspaceDir: string, appName?: string): Promise<TargetApp> {
  const apps = await discoverApps(workspaceDir);
  if (apps.length === 0) {
    throw new JorvelCliError('No apps found under apps/*.', {
      code: 'DB-001',
      hint: 'Scaffold one first: jorvel generate host shell',
    });
  }
  if (appName) {
    const found = apps.find((a) => a.meta.name === appName);
    if (!found) {
      throw new JorvelCliError(`App "${appName}" not found under apps/*.`, {
        code: 'DB-002',
        hint: `Available: ${apps.map((a) => a.meta.name).join(', ')}`,
      });
    }
    const isTs = await fs.pathExists(path.join(found.dir, 'tsconfig.json'));
    return { dir: found.dir, name: found.meta.name, isTs };
  }
  // Default: the host app, else the first discovered app.
  const picked = apps.find((a) => a.meta.type === 'host') ?? apps[0]!;
  const isTs = await fs.pathExists(path.join(picked.dir, 'tsconfig.json'));
  return { dir: picked.dir, name: picked.meta.name, isTs };
}

const DEPS: Record<DbDriver, { deps: Record<string, string>; devDeps: Record<string, string> }> = {
  sqlite: {
    deps: { 'drizzle-orm': '^0.38.3', 'better-sqlite3': '^11.8.1' },
    devDeps: { 'drizzle-kit': '^0.30.2', '@types/better-sqlite3': '^7.6.12' },
  },
  libsql: {
    deps: { 'drizzle-orm': '^0.38.3', '@libsql/client': '^0.14.0' },
    devDeps: { 'drizzle-kit': '^0.30.2' },
  },
};

function schemaSource(isTs: boolean): string {
  // SQLite column types are identical across better-sqlite3 and libsql.
  const header = "import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';";
  const body = `
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
});
`;
  const types = isTs
    ? `
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
`
    : '';
  return `${header}\n${body}${types}`;
}

function clientSource(driver: DbDriver, isTs: boolean): string {
  if (driver === 'libsql') {
    return `import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';

// DATABASE_URL: libsql://<db>.turso.io (with TURSO_AUTH_TOKEN) or file:local.db
const url = process.env.DATABASE_URL ?? 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });
export const db = drizzle(client, { schema });
export { schema };
`;
  }
  // better-sqlite3
  const typeHint = isTs ? ': string' : '';
  return `import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';

// DATABASE_URL is a file path for better-sqlite3 (file: prefix is stripped).
const file${typeHint} = (process.env.DATABASE_URL ?? 'file:./data/app.db').replace(/^file:/, '');
const sqlite = new Database(file);
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export { schema };
`;
}

function seedSource(): string {
  return `import { db } from './client.js';
import { users, posts } from './schema.js';

// Run with: node --import tsx src/db/seed.ts   (or your runtime's TS loader)
async function seed() {
  const [ada] = await db
    .insert(users)
    .values({ email: 'ada@example.com', name: 'Ada Lovelace' })
    .returning();
  await db.insert(posts).values({
    authorId: ada.id,
    title: 'Hello JORVEL',
    body: 'First post, served from SQLite via Drizzle.',
  });
  console.log('Seeded.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
}

function dataLoaderSource(): string {
  // Server data module + a defineLoader (from @jorvel/ssr) so the example is
  // hydration-ready and symmetric with the actions/forms story.
  return `import { defineLoader } from '@jorvel/ssr';
import { desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { posts } from '../db/schema.js';

/** Reads — pair with useLoaderData('recentPosts') in a component. */
export const recentPostsLoader = defineLoader({
  key: 'recentPosts',
  load: async () => db.select().from(posts).orderBy(desc(posts.id)).limit(20),
});
`;
}

function drizzleConfigSource(driver: DbDriver, isTs: boolean): string {
  const dialect = "  dialect: 'sqlite',";
  const schemaPath = isTs ? "  schema: './src/db/schema.ts'," : "  schema: './src/db/schema.js',";
  const creds =
    driver === 'libsql'
      ? `  dbCredentials: { url: process.env.DATABASE_URL ?? 'file:local.db' },`
      : `  dbCredentials: { url: (process.env.DATABASE_URL ?? 'file:./data/app.db').replace(/^file:/, '') },`;
  const driverLine = driver === 'libsql' ? "  driver: 'turso'," : '';
  return `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
${schemaPath}
  out: './drizzle',
${dialect}
${driverLine ? driverLine + '\n' : ''}${creds}
});
`;
}

/** Scaffold the DB layer. Returns the list of written file paths (relative). */
export async function scaffoldDb(opts: AddDbOptions): Promise<string[]> {
  const workspaceDir = path.resolve(opts.dir);
  const driver: DbDriver = opts.driver ?? 'sqlite';
  if (driver !== 'sqlite' && driver !== 'libsql') {
    throw new JorvelCliError(`Unknown --driver "${driver}".`, {
      code: 'DB-003',
      hint: 'Use sqlite (default) or libsql.',
    });
  }
  const log = opts.log ?? ((m: string) => console.log(m));
  const target = await resolveTarget(workspaceDir, opts.app);
  const ext = target.isTs ? 'ts' : 'js';
  const written: string[] = [];

  const write = async (rel: string, content: string) => {
    const abs = path.join(target.dir, rel);
    await fs.outputFile(abs, content, 'utf8');
    written.push(path.relative(workspaceDir, abs));
  };

  await write(`src/db/schema.${ext}`, schemaSource(target.isTs));
  await write(`src/db/client.${ext}`, clientSource(driver, target.isTs));
  await write(`src/db/seed.${ext}`, seedSource());
  await write(`src/server/posts.data.${ext}`, dataLoaderSource());
  await write(`drizzle.config.${ext}`, drizzleConfigSource(driver, target.isTs));

  // package.json — deps + scripts
  const pkgPath = path.join(target.dir, 'package.json');
  const pkg = (await fs.pathExists(pkgPath)) ? await fs.readJson(pkgPath) : {};
  pkg.dependencies = { ...(pkg.dependencies ?? {}), ...DEPS[driver].deps, '@jorvel/ssr': 'workspace:*' };
  pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...DEPS[driver].devDeps };
  pkg.scripts = {
    ...(pkg.scripts ?? {}),
    'db:generate': 'drizzle-kit generate',
    'db:migrate': 'drizzle-kit migrate',
    'db:push': 'drizzle-kit push',
    'db:studio': 'drizzle-kit studio',
    'db:seed': `node --import tsx src/db/seed.${ext}`,
  };
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  written.push(path.relative(workspaceDir, pkgPath));

  // .env.example — append DATABASE_URL (idempotent)
  const envExample = path.join(workspaceDir, '.env.example');
  const dbUrlLine = driver === 'libsql' ? 'DATABASE_URL=file:local.db' : 'DATABASE_URL=file:./data/app.db';
  let envContent = (await fs.pathExists(envExample)) ? await fs.readFile(envExample, 'utf8') : '';
  if (!/^DATABASE_URL=/m.test(envContent)) {
    if (envContent && !envContent.endsWith('\n')) envContent += '\n';
    envContent += `${dbUrlLine}\n`;
    if (driver === 'libsql') envContent += '# TURSO_AUTH_TOKEN=...   # only for remote Turso\n';
    await fs.writeFile(envExample, envContent, 'utf8');
    written.push(path.relative(workspaceDir, envExample));
  }

  log(kleur.green(`Scaffolded Drizzle (${driver}) into app "${target.name}":`));
  for (const f of written) log(kleur.gray(`  - ${f}`));
  log('');
  log(kleur.bold('Next:'));
  log(kleur.gray(`  1. install deps (pnpm install)`));
  log(kleur.gray(`  2. jorvel-app$ pnpm db:generate   # create the SQL migration`));
  log(kleur.gray(`  3. jorvel-app$ pnpm db:migrate    # apply it`));
  log(kleur.gray(`  4. jorvel-app$ pnpm db:seed       # optional sample data`));
  log(kleur.gray(`  Read rows via recentPostsLoader (src/server/posts.data.${ext}).`));
  return written;
}

/** Register `add db` under the parent `add` command. */
export function attachAddDb(parent: Command): void {
  parent
    .command('db')
    .description('Scaffold a Drizzle ORM backend (SQLite or libsql) into an app')
    .argument('[app]', 'Target app name (default: the host app)')
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .option('--driver <driver>', 'sqlite | libsql', 'sqlite')
    .action(async (app: string | undefined, o: { dir: string; driver?: string }) => {
      await scaffoldDb({
        dir: o.dir,
        ...(app ? { app } : {}),
        driver: (o.driver as DbDriver) ?? 'sqlite',
      });
    });
}
