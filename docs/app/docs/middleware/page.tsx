import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Middleware',
  description:
    'Runtime-agnostic route middleware — auth gating, geo/locale redirects, A/B bucketing, rewrites. Runs on the edge, the Node server, and the client router.',
};

export default function Middleware() {
  return (
    <>
      <h1>Middleware</h1>
      <p>
        A <code>middleware.ts</code> chain runs <em>before</em> a route renders or responds. Use it
        for auth gating, geo/locale redirects, A/B bucketing, and rewrites. The primitive is
        runtime-agnostic: the same chain runs on the edge (SSR adapters), the Node server, and the
        client router.
      </p>

      <Callout variant="info" title="One primitive, three runtimes">
        <code>runMiddleware</code> is a pure async function over a request context. Adapters call it
        per request to produce a redirect/rewrite/response; the client router calls it before
        committing a navigation. No framework magic — just a typed chain.
      </Callout>

      <h2 id="define">Define middleware</h2>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/middleware.ts"
        code={`import { defineMiddleware, redirect, next } from '@jorvel/runtime';

export default defineMiddleware(async (ctx) => {
  // ctx: { pathname, searchParams, url?, request?, state }
  const token = ctx.request?.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
  if (ctx.pathname.startsWith('/dashboard') && !token) {
    return redirect('/login?from=' + encodeURIComponent(ctx.pathname));
  }
  return next();
});`}
      />
      <p>
        A middleware returns one of four decisions — or nothing, which is treated as{' '}
        <code>next()</code> so you can write guard-style functions:
      </p>
      <table>
        <thead>
          <tr><th>Helper</th><th>Decision</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>next(headers?)</code></td><td><code>{'{ type: "next" }'}</code></td><td>Continue the chain / render the route. Optional response headers (server/edge).</td></tr>
          <tr><td><code>redirect(to, status?)</code></td><td><code>{'{ type: "redirect" }'}</code></td><td>Stop and send elsewhere. Default <code>307</code> (preserves method).</td></tr>
          <tr><td><code>rewrite(to)</code></td><td><code>{'{ type: "rewrite" }'}</code></td><td>Render a different path without changing the visible URL.</td></tr>
          <tr><td><code>respond(res)</code></td><td><code>{'{ type: "respond" }'}</code></td><td>Short-circuit with a fully-formed <code>Response</code> (server/edge only).</td></tr>
        </tbody>
      </table>

      <h2 id="chain">Compose a chain with matchers</h2>
      <p>
        Pass an array of bare middlewares or <code>{'{ matcher, handler }'}</code> entries.{' '}
        <code>*</code> matches one path segment, <code>**</code> matches any depth. An entry with no
        matcher runs for every path. The first terminal decision (redirect / rewrite / respond)
        wins; <code>next()</code> headers from passing middlewares are merged.
      </p>
      <CodeBlock
        language="ts"
        code={`import { runMiddleware, redirect, next } from '@jorvel/runtime';

const chain = [
  { matcher: '/admin/**', handler: requireRole('admin') },
  { matcher: '/blog/*',   handler: addCacheHeaders },     // /blog/post, not /blog/post/comments
  { handler: geoRedirect },                               // runs for all paths
];

const decision = await runMiddleware(chain, {
  pathname: new URL(request.url).pathname,
  url: new URL(request.url),
  request,
});

switch (decision.type) {
  case 'redirect': return Response.redirect(decision.to, decision.status);
  case 'rewrite':  return render(decision.to);
  case 'respond':  return decision.response;
  case 'next':     return render(request.url, decision.headers);
}`}
      />

      <h2 id="state">Sharing state between middlewares</h2>
      <p>
        Every middleware in one run shares <code>ctx.state</code> — a mutable bag. Resolve the
        session once, gate on it downstream:
      </p>
      <CodeBlock
        language="ts"
        code={`const chain = [
  async (ctx) => { ctx.state.user = await getSession(ctx.request); },
  (ctx) => (ctx.state.user ? next() : redirect('/login')),
  (ctx) => (ctx.state.user?.tier === 'pro' ? next() : redirect('/upgrade')),
];`}
      />

      <h2 id="edge">On the edge</h2>
      <p>
        Wire the chain into any adapter&apos;s request handler. Because <code>runMiddleware</code> is
        a plain function, it works under Cloudflare Workers, Vercel Edge, and Node alike — no
        per-runtime variant.
      </p>
      <CodeBlock
        language="ts"
        code={`// inside @jorvel/adapter-cloudflare fetch(request, env, ctx)
const decision = await runMiddleware(chain, { url: new URL(request.url), request, pathname: new URL(request.url).pathname });
if (decision.type === 'redirect') return Response.redirect(new URL(decision.to, request.url), decision.status);`}
      />

      <Callout variant="warn" title="Middleware is not a render layer">
        Keep middleware fast and side-effect-light — it runs on every matching request before the
        route. Do data loading in a <code>defineLoader</code> / <code>defineAction</code>, not here.
      </Callout>
    </>
  );
}
