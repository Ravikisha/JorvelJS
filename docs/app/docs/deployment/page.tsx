import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { RocketIcon } from '@/components/icons';

export const metadata = {
  title: 'Deployment',
  description:
    'Deploy JORVEL to Vercel Edge, Cloudflare Workers/Pages, Node.js, or Docker. jorvel deploy resolves the right adapter package automatically.',
};

export default function DeploymentPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <RocketIcon className="h-3 w-3" /> Deploy
      </Badge>
      <h1>Deployment</h1>
      <p>
        <code>jorvel deploy</code> dynamically loads the right adapter package — Vercel Edge,
        Cloudflare, or Node — and scaffolds a working platform config. Adapters are loose deps;
        install only what you actually ship. Every adapter wraps the same edge-runtime-safe core
        from <code>@jorvel/ssr/edge</code>, so the behavior is consistent across platforms — the
        adapter only handles request/response translation and platform-specific bootstrapping.
      </p>

      <h2 id="picking">Picking a target</h2>
      <table>
        <thead>
          <tr>
            <th>Target</th>
            <th>Best for</th>
            <th>Trade-offs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel Edge</td>
            <td>Global low-latency SSR with minimal ops. Built-in CDN, preview deploys.</td>
            <td>50ms CPU per request, no long-running tasks, vendor lock-in on KV.</td>
          </tr>
          <tr>
            <td>Cloudflare Workers</td>
            <td>Global edge with KV/Durable Objects. Generous free tier.</td>
            <td>No <code>node:*</code>, 128MB memory cap, cold-start ~5ms.</td>
          </tr>
          <tr>
            <td>Cloudflare Pages</td>
            <td>Static host + edge functions for SSR. Cheapest production deploy.</td>
            <td>Limited to Pages Functions API; less flexibility than Workers.</td>
          </tr>
          <tr>
            <td>Node.js</td>
            <td>Long-running tasks, native modules, streaming SSR with backpressure.</td>
            <td>You own the box. No global edge unless you fan-out yourself.</td>
          </tr>
          <tr>
            <td>Docker</td>
            <td>Kubernetes, ECS, your own infra. Reproducible builds.</td>
            <td>Slower cold start, more ops overhead.</td>
          </tr>
        </tbody>
      </table>

      <Tabs defaultValue="vercel">
        <TabsList>
          <TabsTrigger value="vercel">Vercel</TabsTrigger>
          <TabsTrigger value="cloudflare">Cloudflare</TabsTrigger>
          <TabsTrigger value="node">Node</TabsTrigger>
          <TabsTrigger value="docker">Docker</TabsTrigger>
        </TabsList>

        <TabsContent value="vercel">
          <h2 id="vercel">Vercel Edge</h2>
          <CodeBlock
            language="bash"
            code={`pnpm add -D @jorvel/adapter-vercel
jorvel deploy --target vercel
vercel deploy`}
          />
          <p>
            The adapter forwards <code>request.body</code> and <code>signal</code>, lowercases
            headers, and returns a <code>ReadableStream</code> for streaming SSR. Static assets are
            served with <code>Cache-Control: public, max-age=31536000, immutable</code>.
          </p>
          <CodeBlock
            language="ts"
            filename="api/[[...slug]].ts"
            code={`import { createVercelHandler } from '@jorvel/adapter-vercel';
import { App } from '../src/App';
import template from '../src/template.html?raw';
import routes from '../src/jorvel.routes';

export const config = { runtime: 'edge' };

export default createVercelHandler({ App, template, routes, etag: true });`}
          />

          <h3>Edge config (recommended)</h3>
          <p>The scaffold writes <code>vercel.json</code> with rewrites that route every URL through the edge handler, while letting the CDN serve hashed assets:</p>
          <CodeBlock
            language="json"
            filename="vercel.json"
            code={`{
  "rewrites": [
    { "source": "/_assets/(.*)", "destination": "/_assets/$1" },
    { "source": "/(.*)",         "destination": "/api/ssr" }
  ],
  "headers": [
    {
      "source": "/_assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}`}
          />

          <h3>Streaming SSR on Vercel</h3>
          <p>
            The handler returns a <code>ReadableStream</code> when the SSR call streams; Vercel
            Edge passes it through. Pair with <code>renderRouteToReadableStream</code> from{' '}
            <code>@jorvel/ssr/edge</code> for progressive rendering.
          </p>
        </TabsContent>

        <TabsContent value="cloudflare">
          <h2 id="cloudflare">Cloudflare Workers / Pages</h2>
          <CodeBlock
            language="bash"
            code={`pnpm add -D @jorvel/adapter-cloudflare
jorvel deploy --target cloudflare
wrangler deploy
# or, for Cloudflare Pages
wrangler pages deploy apps/shell/dist`}
          />
          <CodeBlock
            language="ts"
            filename="src/worker.ts"
            code={`import { createCloudflareWorker } from '@jorvel/adapter-cloudflare';

const worker = createCloudflareWorker({
  App,
  template,
  routes,
  etag: true,
  csp: () => buildCsp({ nonce: cryptoRandomNonce() }),
});

export default worker;`}
          />

          <h3>KV-backed HTML cache</h3>
          <p>
            Wire the optional <code>htmlCache</code> param to a Workers KV namespace to cache
            rendered HTML at the edge. Cache key = URL + accept-language + auth fingerprint.
          </p>
          <CodeBlock
            language="ts"
            code={`export default {
  async fetch(req, env, ctx) {
    return createCloudflareWorker({
      App, template, routes,
      htmlCache: {
        get: (k) => env.HTML_KV.get(k),
        set: (k, v, ttl) => env.HTML_KV.put(k, v, { expirationTtl: ttl }),
      },
    })(req, env, ctx);
  },
};`}
          />

          <h3>Durable Objects + remotes</h3>
          <p>
            For Pub/Sub or shared state across the federation graph, expose a Durable Object as the
            event bus and bridge with <code>connectBroadcast</code> from{' '}
            <code>@jorvel/event-bus</code>.
          </p>
        </TabsContent>

        <TabsContent value="node">
          <h2 id="node">Node.js</h2>
          <CodeBlock
            language="bash"
            code={`pnpm add -D @jorvel/adapter-node
jorvel deploy --target node`}
          />
          <CodeBlock
            language="ts"
            filename="server.ts"
            code={`import { startNodeServer } from '@jorvel/adapter-node';

startNodeServer({
  App,
  template,
  routes,
  port: Number(process.env.PORT) || 3000,
  staticDir: 'apps/shell/dist',
  maxBodyBytes: 1024 * 1024,
  bodyTimeoutMs: 30_000,
  logger: { info: console.log, error: console.error },
});`}
          />
          <Callout variant="info" title="Slowloris hardening">
            The Node adapter sets <code>keepAliveTimeout</code>, <code>headersTimeout</code>, and{' '}
            <code>requestTimeout</code> to safe defaults; binary uploads get a size cap and a read
            deadline.
          </Callout>

          <h3>Graceful shutdown</h3>
          <p>
            The adapter listens for <code>SIGTERM</code> and <code>SIGINT</code>, stops accepting
            new connections, waits up to <code>shutdownTimeoutMs</code> for in-flight requests to
            finish, then exits. K8s pod restarts and rolling deploys ride this out cleanly.
          </p>
        </TabsContent>

        <TabsContent value="docker">
          <h2 id="docker">Docker</h2>
          <CodeBlock
            language="bash"
            code={`jorvel deploy --target docker
docker build -t shell .
docker run -p 3000:3000 shell`}
          />
          <p>The generated Dockerfile is multi-stage:</p>
          <CodeBlock
            language="text"
            filename="Dockerfile"
            code={`FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["node", "apps/shell/dist/server.js"]`}
          />

          <h3>Layer caching</h3>
          <p>
            The two-stage build keeps <code>pnpm install</code> in a separate layer from the source
            copy, so changes to <code>src/</code> don&apos;t bust the install cache. Average
            re-build is &lt;30s for incremental source changes.
          </p>

          <h3>Kubernetes manifests</h3>
          <p>
            <code>jorvel deploy --target docker --k8s</code> additionally emits a Deployment +
            Service + HPA YAML. Edit the resource limits and pod count to taste.
          </p>
        </TabsContent>
      </Tabs>

      <h2 id="github-pages">GitHub Pages (static export)</h2>
      <p>
        For a static-export site (SPA host + prebuilt remotes on the same origin),{' '}
        <code>jorvel deploy --target github-pages</code> emits a Pages deploy workflow +{' '}
        <code>.nojekyll</code>. Enable Pages (Settings → Pages → Source: GitHub Actions) and push to{' '}
        <code>main</code>. For a project page, set a base path: <code>jorvel build --base /&lt;repo&gt;/</code>.
      </p>
      <CodeBlock language="bash" code={`jorvel deploy --target github-pages\n# writes .github/workflows/pages.yml + apps/<host>/dist/.nojekyll`} />

      <h2 id="cdn">Putting remotes on a CDN</h2>
      <p>
        Each remote app is a self-contained bundle under <code>apps/&lt;name&gt;/dist/</code>.
        Upload that directory to a CDN and point <code>federation.publicPath</code> at it before
        building. The host&apos;s federation config uses the CDN URLs at runtime; users get
        cached, geo-routed remoteEntry files.
      </p>

      <CodeBlock
        language="json"
        filename="jorvel.config.json"
        code={`{
  "federation": {
    "publicPath": "https://cdn.acme.com/dashboard/",
    "sri": { "algo": "sha384" },
    "allowlist": ["https://cdn.acme.com"]
  }
}`}
      />

      <h2 id="multi-region">Multi-region SSR</h2>
      <p>
        For latency-sensitive apps with a global user base, deploy the host to multiple regions
        and let the platform&apos;s smart-routing pick the closest. Three rules:
      </p>
      <ol>
        <li>
          <strong>Stateless handlers.</strong> Don&apos;t cache anything in process memory; use
          KV/Redis with a regional reader and a primary writer.
        </li>
        <li>
          <strong>Pin auth.</strong> If your auth provider is single-region, regional handlers
          still need to call back to that origin. Cache the verification result aggressively.
        </li>
        <li>
          <strong>Replicate remotes.</strong> Push every remote to a global CDN. Skipping this
          turns the multi-region setup into &quot;fast host, slow remote&quot;.
        </li>
      </ol>

      <h2 id="custom-adapter">Writing your own adapter</h2>
      <p>
        Each adapter is just a thin bridge that turns the platform&apos;s native request type into{' '}
        <code>EdgeRequest</code>. Implement <code>scaffoldDeploy()</code> + a handler factory and{' '}
        <code>jorvel deploy --target your-adapter</code> will pick it up.
      </p>

      <CodeBlock
        language="ts"
        filename="@your-co/jorvel-adapter-foo/src/index.ts"
        code={`import { createEdgeAdapter } from '@jorvel/ssr';

export const deployTarget = 'foo';

export async function scaffoldDeploy(opts: { cwd: string; dryRun?: boolean }) {
  // Write your platform config here.
  return { files: [], nextHint: 'foo deploy' };
}

export function createFooHandler(options) {
  const handler = createEdgeAdapter(options);
  return async (request) => {
    const res = await handler(toEdgeRequest(request));
    return toFooResponse(res);
  };
}`}
      />

      <h2 id="env">Environment variables</h2>
      <p>
        Adapters read a small set of envs at boot:
      </p>
      <table>
        <thead><tr><th>Variable</th><th>Used by</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>NODE_ENV</code></td><td>All</td><td>Production-mode defaults (caching, error verbosity).</td></tr>
          <tr><td><code>PORT</code></td><td>Node, Docker</td><td>Listen port.</td></tr>
          <tr><td><code>JORVEL_DEBUG</code></td><td>All</td><td>Verbose logs.</td></tr>
          <tr><td><code>JORVEL_REMOTE_TIMEOUT_MS</code></td><td>All</td><td>Per-remote load timeout (default 10s).</td></tr>
        </tbody>
      </table>
    </>
  );
}
