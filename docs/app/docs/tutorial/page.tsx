import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Tutorial — build your first app',
  description: 'End-to-end: scaffold a workspace, add a host + remote, wire routes, load data, add auth, and deploy. ~20 minutes.',
};

export default function Tutorial() {
  return (
    <>
      <h1>Tutorial — build your first JORVEL app</h1>
      <p>
        Start to finish in ~20 minutes: a host shell that loads a federated <code>dashboard</code>{' '}
        remote, a file-based route, server data, a session gate, and a deploy. Assumes Node 20+ and a
        package manager (pnpm recommended).
      </p>

      <Callout variant="info" title="Prefer to poke around first?">
        Open the <a href="/docs/showcase">starters</a> in a browser sandbox, or skim{' '}
        <a href="/docs/concepts">Concepts</a> for the mental model. This page is the guided build.
      </Callout>

      <h2 id="1-scaffold">1 · Scaffold a workspace</h2>
      <CodeBlock
        language="bash"
        code={`npm create jorvel@latest my-shop
cd my-shop
pnpm install`}
      />
      <p>
        Interactive prompts pick a template, package manager, and Tailwind. You get{' '}
        <code>apps/</code>, <code>libs/</code>, <code>jorvel.config.json</code>, CI workflows, ESLint,
        Vitest, and Git hooks — ready to run.
      </p>

      <h2 id="2-generate">2 · Generate a host + a remote</h2>
      <CodeBlock
        language="bash"
        code={`jorvel generate host shell --port 3000
jorvel generate remote dashboard --port 3001
jorvel federation      # wires the host's remotes map to the dashboard`}
      />
      <p>
        The <strong>host</strong> owns top-level URLs; the <strong>remote</strong> owns its
        sub-paths. <code>jorvel federation</code> reads each app&apos;s <code>jorvel.app.json</code>{' '}
        and writes the <code>jorvel.federation.json</code> the runtime consumes.
      </p>

      <h2 id="3-dev">3 · Run the dev server</h2>
      <CodeBlock language="bash" code={`jorvel dev --proxy-remotes --hmr-remotes`} />
      <p>
        Open <a href="http://localhost:3000">localhost:3000</a>. <code>--proxy-remotes</code> serves
        the remote on the host origin (so CSP/cookies behave like prod); <code>--hmr-remotes</code>{' '}
        reloads the host when the remote recompiles.
      </p>

      <h2 id="4-route">4 · Add a route</h2>
      <p>Drop a file in the remote&apos;s <code>src/pages/</code> — file-based, Next-style:</p>
      <CodeBlock
        language="tsx"
        filename="apps/dashboard/src/pages/orders/[id].tsx"
        code={`export default function Order({ params }: { params: { id: string } }) {
  return <main><h2>Order {params.id}</h2></main>;
}`}
      />
      <CodeBlock language="bash" code={`jorvel routes --watch   # regenerates src/jorvel.routes.ts`} />
      <p>The host now matches <code>/dashboard/orders/42</code>.</p>

      <h2 id="5-data">5 · Load data</h2>
      <p>
        Client-side with <a href="/docs/actions#use-query"><code>useQuery</code></a> (cache +
        stale-while-revalidate), or server-side with <a href="/docs/actions">
        <code>defineLoader</code></a> for hydration-ready reads.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useQuery } from '@jorvel/runtime';

function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => fetch('/api/orders').then((r) => r.json()),
  });
  if (isLoading) return <p>Loading…</p>;
  return <ul>{data.map((o) => <li key={o.id}>{o.total}</li>)}</ul>;
}`}
      />
      <p>Need a database? <code>jorvel add db</code> scaffolds Drizzle (<a href="/docs/database">guide</a>).</p>

      <h2 id="6-auth">6 · Gate a route</h2>
      <p>Add a <a href="/docs/middleware">middleware</a> that redirects unauthenticated users:</p>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/middleware.ts"
        code={`import { defineMiddleware, redirect, next } from '@jorvel/runtime';
import { getSession } from '@jorvel/security';

export default defineMiddleware(async (ctx) => {
  if (!ctx.pathname.startsWith('/dashboard')) return next();
  const user = await getSession(ctx.request ?? '', { secret: process.env.SESSION_SECRET! });
  return user ? next() : redirect('/login?from=' + encodeURIComponent(ctx.pathname));
});`}
      />

      <h2 id="7-mutate">7 · Mutate with a form</h2>
      <CodeBlock
        language="tsx"
        code={`import { Form, defineAction } from '@jorvel/runtime';

const createOrder = defineAction(async (fd: FormData) =>
  fetch('/api/orders', { method: 'POST', body: fd }).then((r) => r.json()),
);

function NewOrder({ csrfToken }: { csrfToken: string }) {
  return (
    <Form action={createOrder} csrf={{ token: csrfToken }}>
      {({ pending }) => (<><input name="sku" /><button disabled={pending}>Create</button></>)}
    </Form>
  );
}`}
      />

      <h2 id="8-ship">8 · Build &amp; deploy</h2>
      <CodeBlock
        language="bash"
        code={`jorvel build                       # all apps
jorvel federation diff --base main # confirm no breaking contract changes
jorvel deploy --target vercel      # or cloudflare | node | docker | bun | deno | netlify | github-pages`}
      />

      <Callout variant="success" title="You shipped a micro-frontend">
        Host + independently-deployable remote, routing, data, auth, a form, and a deploy target.
        Next: <a href="/docs/architecture">Architecture</a> (how it all fits), or the{' '}
        <a href="/docs/recipes">Cookbook</a> for auth/Stripe/AI/kill-switch recipes.
      </Callout>
    </>
  );
}
