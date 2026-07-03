import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { ServerIcon } from '@/components/icons';

export const metadata = {
  title: 'SSR & Static Export',
  description:
    'Server-render a federated app with @jorvel/ssr. renderRouteToString, streaming, ETag-before-render cache, static export with content-hash manifests.',
};

export default function SsrPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <ServerIcon className="h-3 w-3" /> SSR
      </Badge>
      <h1>SSR &amp; static export</h1>
      <p>
        <code>@jorvel/ssr</code> renders matched routes on the server, streams them to the browser,
        and hydrates with <code>renderToString</code> by default (so the React tree carries the
        markers needed for hydration). Edge runtimes use <code>@jorvel/ssr/edge</code>; Node uses{' '}
        <code>@jorvel/ssr/node</code>.
      </p>
      <Callout variant="info" title="Bare import is edge-safe">
        The main <code>@jorvel/ssr</code> entry exports <code>worker</code>, <code>edge-light</code>,
        and <code>browser</code> conditions that resolve to a <code>node:fs</code>-free build. So a
        Workers / Vercel-Edge bundler that imports bare <code>@jorvel/ssr</code> won&apos;t drag Node
        built-ins into the bundle — Node tooling still gets the full entry. You can keep using the
        explicit <code>/edge</code> and <code>/node</code> subpaths to be unambiguous.
      </Callout>

      <h2 id="render-to-string">renderRouteToString</h2>
      <CodeBlock
        language="ts"
        filename="apps/shell/server/render.ts"
        code={`import { renderRouteToString, injectIntoTemplate } from '@jorvel/ssr';
import { App } from '../src/App';

export async function renderShell(pathname: string, template: string) {
  const result = await renderRouteToString(App, { path: pathname });
  return {
    html: injectIntoTemplate(template, result.html),
    status: result.statusCode,
  };
}`}
      />

      <Callout variant="info" title="Hydratable by default">
        <code>renderRouteToString</code> uses React&apos;s <code>renderToString</code> so the output
        carries hydration markers. <code>renderToStaticMarkup</code> is opt-in for purely static
        pages (404 markup, error shells).
      </Callout>

      <h2 id="streaming">Streaming SSR</h2>
      <p>
        For above-the-fold-first delivery, use <code>renderRouteToStream</code>. It pipes
        synchronously inside <code>onShellReady</code>, supports <code>signal</code> /{' '}
        <code>timeoutMs</code> / <code>onError</code>, and surfaces deferred Suspense errors via an{' '}
        <code>errors[]</code> array.
      </p>

      <CodeBlock
        language="ts"
        filename="apps/shell/server/stream.ts"
        code={`import { renderRouteToStream, type StreamRenderResult } from '@jorvel/ssr';

export async function streamShell(req, res) {
  const ac = new AbortController();
  req.on('close', () => ac.abort());

  const result: StreamRenderResult = await renderRouteToStream(App, {
    path: req.url,
    signal: ac.signal,
    timeoutMs: 5000,
    onError: (err) => observability.captureException(err),
  });

  res.setHeader('content-type', 'text/html; charset=utf-8');
  result.pipe(res);
}`}
      />

      <h3 id="streaming-edge">Streaming on edge runtimes (Web Streams)</h3>
      <p>
        Cloudflare Workers, Vercel Edge, and Deno Deploy do not provide{' '}
        <code>node:stream</code>. Import <code>renderRouteToReadableStream</code> or{' '}
        <code>renderRouteToResponse</code> from <code>@jorvel/ssr/edge</code> to get a Web{' '}
        <code>ReadableStream&lt;Uint8Array&gt;</code> backed by React 18&apos;s{' '}
        <code>renderToReadableStream</code>. Same options surface — <code>signal</code>,{' '}
        <code>timeoutMs</code>, <code>bootstrapScripts</code>, <code>nonce</code>,{' '}
        <code>onError</code> — and <code>waitForAllReady</code> for SEO crawlers that need the
        finished shell.
      </p>

      <CodeBlock
        language="ts"
        filename="apps/shell/worker.ts"
        code={`import { renderRouteToResponse } from '@jorvel/ssr/edge';

export default {
  async fetch(req: Request) {
    return renderRouteToResponse(App, { path: new URL(req.url).pathname }, {
      bootstrapScripts: ['/static/app.js'],
      nonce: req.headers.get('x-csp-nonce') ?? undefined,
      signal: req.signal,
      timeoutMs: 5_000,
      onError: (err) => console.error(err),
    });
  },
};`}
      />

      <h2 id="fragments">Streaming remote fragments</h2>
      <p>
        For multi-remote pages, SSR each remote in parallel and stream their HTML in any order
        — the host shell flushes first with placeholders, and each fragment swaps in as it
        finishes. Matches the Cloudflare Fragments pattern.
      </p>
      <CodeBlock
        language="ts"
        filename="apps/shell/worker.ts"
        code={`import { renderFragmentsToReadableStream } from '@jorvel/ssr/edge';

const shell = \`<!doctype html><html><body>
  <header><jorvel-fragment name="nav" /></header>
  <main><jorvel-fragment name="cart" /></main>
  <footer><jorvel-fragment name="recs" /></footer>
</body></html>\`;

const { stream, done } = renderFragmentsToReadableStream({
  shell,
  timeoutMs: 5_000,
  fragments: [
    { name: 'nav',  render: async () => fetch('https://nav.acme.dev/ssr').then((r) => r.text()),  fallback: '<nav/>' },
    { name: 'cart', render: async () => fetch('https://cart.acme.dev/ssr').then((r) => r.text()), fallback: '<aside/>' },
    { name: 'recs', render: async () => fetch('https://recs.acme.dev/ssr').then((r) => r.text()), fallback: '' },
  ],
  onFragment: (e) => observability.report('fragment', e),
});
done.then(({ outcomes }) => /* persist outcomes for SLO dashboards */ {});
return new Response(stream, { headers: { 'content-type': 'text/html; charset=utf-8' } });`}
      />
      <Callout variant="info" title="Fallback first, fragment second">
        The stream variant inlines the fallback markup inside the placeholder before any
        fragment resolves. If a fragment times out or fails, the fallback stays on the page —
        the swap script never runs.
      </Callout>

      <h2 id="edge-adapter">Edge adapter</h2>
      <p>
        <code>createEdgeAdapter</code> turns an <code>EdgeRequest</code> into an{' '}
        <code>EdgeResponse</code>. It handles redirects, HEAD/OPTIONS, CSP per-request, ETag, and an
        optional HTML cache.
      </p>

      <CodeBlock
        language="ts"
        filename="worker.ts"
        code={`import { createEdgeAdapter, LruHtmlCache } from '@jorvel/ssr/edge';

const handler = createEdgeAdapter({
  App,
  template,
  routes,
  etag: true,
  htmlCache: new LruHtmlCache({ max: 256, ttlMs: 60_000 }),
  cache: { scope: 'public', maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 600 },
  csp: (req) => buildCsp({ nonce: cryptoRandomNonce() }),
});

export default { fetch: (req: Request) => toResponse(handler(toEdgeRequest(req))) };`}
        highlightLines={[7, 8]}
      />

      <Callout variant="success" title="ETag before render">
        When <code>htmlCache</code> is set and a response is already cached for{' '}
        <code>cacheKey(request)</code>, the adapter checks <code>If-None-Match</code> against the{' '}
        stored ETag <em>before</em> calling React. Hits return 304 with no render. Auto-disabled
        when <code>enrichHead</code> is set, or when <code>loaders</code> are present (per-request HTML).
      </Callout>

      <Callout variant="info" title="Read-only by design">
        The adapter SSR-renders <code>GET</code> and <code>HEAD</code> only — any other method
        returns <strong>405</strong>. Route mutations through your API, not the renderer.
      </Callout>

      <h3 id="edge-adapter-loaders">Loaders in the edge adapter</h3>
      <p>
        Pass <code>loaders</code> to <code>createEdgeAdapter</code> and it runs the matched route
        loaders inside the request context <em>before</em> render — so <code>useLoaderData()</code>{' '}
        resolves during SSR. The collected data is serialized to{' '}
        <code>window.__JORVEL_LOADER_DATA__</code> for the client to hydrate from (no second fetch),
        and each loader&apos;s <code>setHeader</code> / <code>cacheControl</code> is merged into the
        response. Because the HTML is now request-specific, the adapter auto-disables the HTML cache
        whenever loaders are configured.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createEdgeAdapter } from '@jorvel/ssr/edge';
import { userLoader } from './loaders';

const handler = createEdgeAdapter({
  App,
  template,
  routes,
  loaders: [userLoader],   // run before render; data → window.__JORVEL_LOADER_DATA__
});`}
      />

      <h2 id="static-export">Static export (SSG)</h2>
      <p>
        <code>staticExport</code> pre-renders a list of routes with bounded parallelism (default 8).
        It deduplicates output paths, blocks path traversal, and optionally writes a content-hash
        manifest.
      </p>

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="manifest">With manifest</TabsTrigger>
          <TabsTrigger value="detailed">Detailed result</TabsTrigger>
        </TabsList>
        <TabsContent value="basic">
          <CodeBlock
            language="ts"
            code={`import { staticExport } from '@jorvel/ssr/node';

await staticExport({
  routes: [{ path: '/' }, { path: '/about' }],
  App,
  template,
  outDir: 'dist-ssg',
});`}
          />
        </TabsContent>
        <TabsContent value="manifest">
          <CodeBlock
            language="ts"
            code={`await staticExport({
  routes,
  App,
  template,
  outDir: 'dist-ssg',
  concurrency: 16,
  manifestFile: 'manifest.json',
});

// dist-ssg/manifest.json
// {
//   "/": { "file": "index.html", "hash": "5a3c1ef9..", "bytes": 4280 },
//   "/about": { "file": "about/index.html", "hash": "8b1f7c40..", "bytes": 5120 }
// }`}
          />
        </TabsContent>
        <TabsContent value="detailed">
          <CodeBlock
            language="ts"
            code={`const result = await staticExport({
  routes,
  App,
  template,
  outDir: 'dist-ssg',
  detailed: true,
});

if (result.failures.length > 0) {
  for (const f of result.failures) console.error(f.path, f.error);
  process.exit(1);
}`}
          />
        </TabsContent>
      </Tabs>

      <h2 id="ssr-redirects">Redirects and response helpers</h2>
      <p>
        Throw <code>redirect</code>, <code>json</code>, or <code>notFound</code> from anywhere in the
        React tree. <code>renderRouteToString</code> re-throws each control-flow error so the edge
        adapter can map it to a real HTTP response (302, JSON 4xx/5xx, or the configured 404 page).
      </p>

      <CodeBlock
        language="tsx"
        code={`import { redirect, json, notFound } from '@jorvel/ssr';

export default function User({ params }: { params: { id: string } }) {
  if (!isLoggedIn()) throw redirect('/login', 302);

  const user = lookup(params.id);
  if (!user) throw notFound();                       // → 404
  if (user.banned) throw json({ error: 'banned' }, 403);

  return <Profile user={user} />;
}`}
      />

      <h2 id="loaders">Per-route data loaders</h2>
      <p>
        Co-locate data fetching with the route. <code>defineLoader</code> describes one loader;{' '}
        <code>runLoaders</code> runs a list of them concurrently before render. Components read
        results via <code>useLoaderData</code> — no second client fetch needed for hydration.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineLoader, runLoaders, useLoaderData, redirect } from '@jorvel/ssr';

export const userLoader = defineLoader({
  key: 'user',
  cacheControl: 'private, max-age=0',
  load: async ({ ctx, setHeader, params }) => {
    const sid = ctx?.cookies['sid'];
    if (!sid) throw redirect('/login', 302);
    setHeader('Vary', 'Cookie');
    return await fetchUser(params.id, sid);
  },
});

// In your handler — collect headers + cache-control before render.
const { data, headers, cacheControl } = await runLoaders({
  loaders: [userLoader],
  request,
  params: match.params,
});

// In your component
function UserPage() {
  const user = useLoaderData<User>('user');
  return <h1>{user?.name}</h1>;
}`}
      />
      <Callout variant="info" title="Serve client assets alongside SSR">
        <code>jorvel ssr serve --static &lt;dir&gt;</code> serves the built client assets next to the
        SSR handler, so the hydration bundles referenced in the rendered HTML resolve in dev and in
        single-process deployments.
      </Callout>

      <h2 id="request-context">Per-request context</h2>
      <p>
        Components can read the inbound request via <code>getRequestContext()</code> /
        <code> requireRequestContext()</code>. The edge adapter brackets each render with{' '}
        <code>runWithRequestContext</code>, so concurrent requests are isolated.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { requireRequestContext } from '@jorvel/ssr';

export default function Page() {
  const ctx = requireRequestContext();
  const locale = ctx.cookies['locale'] ?? 'en';
  return <Greeting locale={locale} />;
}`}
      />
      <p>
        The context exposes <code>url</code>, <code>method</code>, lowercase{' '}
        <code>headers</code>, parsed <code>cookies</code>, and a free-form <code>locals</code> bag
        you can populate from middleware (user/session/locale).
      </p>

      <h2 id="when-to-pick">When to pick which mode</h2>
      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Cold TTFB</th>
            <th>Time-to-interactive</th>
            <th>Best for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SPA (client-only)</td>
            <td>Fast — static HTML shell</td>
            <td>Slow on big bundles</td>
            <td>Authed dashboards, internal tools</td>
          </tr>
          <tr>
            <td><code>renderRouteToString</code></td>
            <td>Slower (full render before flush)</td>
            <td>Fast — hydrate one tree</td>
            <td>Marketing pages, SEO-critical routes</td>
          </tr>
          <tr>
            <td><code>renderRouteToStream</code></td>
            <td>Fast (flush shell, defer suspense)</td>
            <td>Fast progressively</td>
            <td>Above-the-fold-heavy pages with data fetch</td>
          </tr>
          <tr>
            <td><code>staticExport</code></td>
            <td>CDN-fast</td>
            <td>Fast — pure HTML</td>
            <td>Docs, blog, status pages</td>
          </tr>
        </tbody>
      </table>

      <h2 id="state-hydration">Safe state hydration</h2>
      <p>
        Use <code>safeJsonForScript</code> from <code>@jorvel/security</code> to inject server state.
        It escapes <code>&lt;/script&gt;</code> sequences and validates nonces against the base64url
        alphabet.
      </p>

      <CodeBlock
        language="ts"
        code={`import { safeJsonForScript } from '@jorvel/security';

const head = \`<script id="__jorvel_state" type="application/json" nonce="\${nonce}">\${
  safeJsonForScript({ user, flags })
}</script>\`;`}
      />

      <h2 id="server-routes">Server routes (API + tRPC/Hono)</h2>
      <p>
        A dependency-free API router adapters consult <em>before</em> SSR. Return <code>null</code> on
        no match to fall through to page rendering. Mount tRPC/Hono as a prefix <code>fallback</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createApiRouter, defineRoute, json } from '@jorvel/ssr';

const api = createApiRouter([
  defineRoute('GET', '/health', () => json({ ok: true })),
  defineRoute('GET', '/users/:id', ({ params }) => json({ id: params.id })),
], { prefix: '/api' });

// in your adapter handler:
const res = await api.handle(request);
return res ?? renderSSR(request);

// tRPC / Hono: mount their fetch handler as a fallback
createApiRouter([], { prefix: '/trpc', fallback: ({ request }) => trpcFetchHandler(request) });`}
      />

      <h2 id="critical-css">Critical CSS</h2>
      <p>
        Inline above-the-fold CSS and defer the full sheet — a best-effort, dependency-free
        heuristic that keeps rules whose selectors appear in the rendered HTML.
      </p>
      <CodeBlock
        language="ts"
        code={`import { inlineCriticalCss } from '@jorvel/ssr';

const html = inlineCriticalCss(renderedHtml, fullCss, { href: '/assets/app.css' });
// → <style data-critical>…used rules…</style> in <head>, full sheet loaded via media=print swap`}
      />

      <h2 id="isr">ISR — request-time regeneration</h2>
      <p>
        Serve cached HTML instantly and regenerate in the background when it goes stale
        (stale-while-revalidate). Bring any <code>HtmlCache</code> (in-memory default, or Redis/KV).
      </p>
      <CodeBlock
        language="ts"
        code={`import { serveWithISR, LruHtmlCache } from '@jorvel/ssr';

const cache = new LruHtmlCache();

const { html, status, cached, stale } = await serveWithISR({
  cache,
  key: url.pathname,
  revalidateMs: 60_000,                 // fresh for 60s, then background-regenerate
  render: () => renderRouteToString(App, { path: url.pathname }).then((html) => ({ html })),
});
// concurrent stale hits dedupe to ONE background render per key`}
      />
      <p>
        Complements build-time <code>revalidateStaticPages</code> (on-demand static regeneration) and
        the <code>ETag</code>/304 flow. Full PPR (streaming static shell + dynamic holes) is on the{' '}
        <a href="/docs/roadmap">roadmap</a>.
      </p>
    </>
  );
}
