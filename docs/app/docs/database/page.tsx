import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Database & backend',
  description:
    'jorvel add db scaffolds a Drizzle ORM backend (SQLite or libsql) — schema, typed client, migrations, and a server data loader, end to end.',
};

export default function Database() {
  return (
    <>
      <h1>Database &amp; backend</h1>
      <p>
        <code>jorvel add db</code> scaffolds a <strong>Drizzle ORM</strong> backend into an app —
        schema, a typed client, drizzle-kit migrations, a seed script, and an example server data
        loader wired to <code>defineLoader</code>. Two drivers: <code>sqlite</code> (better-sqlite3,
        zero-infra local file) and <code>libsql</code> (Turso / edge-friendly).
      </p>

      <h2 id="scaffold">Scaffold</h2>
      <CodeBlock
        language="bash"
        code={`# into the host app, SQLite (default)
jorvel add db

# into a specific app, libsql/Turso
jorvel add db dashboard --driver libsql`}
      />
      <p>It writes (TypeScript app shown; a JS app gets <code>.js</code> equivalents):</p>
      <table>
        <thead><tr><th>File</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>src/db/schema.ts</code></td><td>Drizzle tables (<code>users</code>, <code>posts</code>) + inferred <code>User</code>/<code>Post</code> types</td></tr>
          <tr><td><code>src/db/client.ts</code></td><td>The <code>db</code> client bound to the driver</td></tr>
          <tr><td><code>src/db/seed.ts</code></td><td>Sample-data seeder</td></tr>
          <tr><td><code>src/server/posts.data.ts</code></td><td>A <code>defineLoader</code> reading rows — hydration-ready</td></tr>
          <tr><td><code>drizzle.config.ts</code></td><td>drizzle-kit config (schema path, out dir, credentials)</td></tr>
        </tbody>
      </table>
      <p>
        Plus <code>drizzle-orm</code> + the driver added to the app&apos;s dependencies,{' '}
        <code>db:generate</code> / <code>db:migrate</code> / <code>db:push</code> /{' '}
        <code>db:studio</code> / <code>db:seed</code> scripts, and a <code>DATABASE_URL</code> entry
        appended to <code>.env.example</code>.
      </p>

      <h2 id="migrate">Generate &amp; migrate</h2>
      <CodeBlock
        language="bash"
        code={`pnpm install                 # pick up the new deps
cd apps/shell
pnpm db:generate             # emit SQL migration into ./drizzle
pnpm db:migrate              # apply it to the database
pnpm db:seed                 # optional: insert sample rows
pnpm db:studio               # browse data in Drizzle Studio`}
      />

      <h2 id="schema">Schema</h2>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/db/schema.ts"
        code={`import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorId: integer('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
});

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;`}
      />

      <h2 id="read">Read in a loader</h2>
      <p>
        The generated data module pairs the query with a <a href="/docs/actions">loader</a>, so the
        rows are fetched on the server and hydrated without a second client request.
      </p>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/server/posts.data.ts"
        code={`import { defineLoader } from '@jorvel/ssr';
import { desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { posts } from '../db/schema.js';

export const recentPostsLoader = defineLoader({
  key: 'recentPosts',
  load: async () => db.select().from(posts).orderBy(desc(posts.id)).limit(20),
});`}
      />
      <CodeBlock
        language="tsx"
        code={`import { useLoaderData } from '@jorvel/ssr';
import type { Post } from '../db/schema.js';

export default function Posts() {
  const posts = useLoaderData<Post[]>('recentPosts') ?? [];
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}`}
      />

      <h2 id="write">Write with an action</h2>
      <p>
        Mutations go through a <a href="/docs/actions">server action</a> — symmetric to the loader.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineAction } from '@jorvel/runtime';
import { db } from '../db/client.js';
import { posts } from '../db/schema.js';

export const createPost = defineAction(async (input: { authorId: number; title: string; body: string }) => {
  const [row] = await db.insert(posts).values(input).returning();
  return row;
});`}
      />

      <Callout variant="info" title="Driver choice">
        <strong>sqlite</strong> (better-sqlite3) is synchronous, fast, and perfect for Node servers
        and local dev. <strong>libsql</strong> targets Turso and edge runtimes (HTTP-based) — use it
        when you deploy to Cloudflare/Vercel edge or want a managed replica.
      </Callout>

      <Callout variant="warn" title="Server-only">
        <code>src/db/*</code> and <code>src/server/*</code> import a native/HTTP driver and read{' '}
        <code>DATABASE_URL</code> — keep them out of client bundles. Import them only from loaders,
        actions, and SSR/edge handlers, never from a component that ships to the browser.
      </Callout>
    </>
  );
}
