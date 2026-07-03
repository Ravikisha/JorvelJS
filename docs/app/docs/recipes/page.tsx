import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Recipes / Cookbook',
  description:
    'Task-focused recipes: Lucia/Auth.js, SSO/SAML, federation kill-switch, mailer/queue/cron, Edge KV / Durable Objects, dark mode, design tokens, CSS-in-JS.',
};

export default function Recipes() {
  return (
    <>
      <h1>Recipes / Cookbook</h1>
      <p>Copy-paste-able solutions built on JORVEL primitives. Each is intentionally small.</p>

      <h2 id="lucia">Auth.js / Lucia integration</h2>
      <p>
        JORVEL ships session + OAuth primitives (<a href="/docs/auth">Authentication</a>), but you
        can bring Auth.js or Lucia. Run the library&apos;s handler in a server route and bridge its
        session into a JORVEL <code>SessionManager</code> cookie (so middleware gating works).
      </p>
      <CodeBlock
        language="ts"
        code={`// Lucia validates its own cookie; mirror the user id into a JORVEL session so
// getSession()/requireUser() and middleware gates keep working.
import { SessionManager } from '@jorvel/security';
const sessions = new SessionManager<{ id: string }>({ secret: process.env.SESSION_SECRET! });

const { session, user } = await lucia.validateSession(sessionId);
if (session) {
  const setCookie = await sessions.seal({ id: user.id });
  // set both cookies on the response
}`}
      />

      <h2 id="sso-saml">SSO / SAML</h2>
      <p>
        For enterprise SSO, terminate SAML at an IdP-facing service (e.g. <code>@node-saml/node-saml</code>
        or WorkOS) and, on assertion success, issue a JORVEL session cookie. OIDC-based SSO uses the
        built-in <a href="/docs/auth#oauth">OAuth/PKCE helpers</a> directly with your IdP&apos;s
        endpoints.
      </p>
      <CodeBlock
        language="ts"
        code={`// /sso/callback — after the IdP POSTs a validated SAML assertion:
const profile = await saml.validatePostResponse(formData);      // your SAML lib
const setCookie = await sessions.seal({ id: profile.nameID, roles: profile.roles });
return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': setCookie } });`}
      />

      <h2 id="kill-switch">Federation kill-switch / circuit breaker</h2>
      <p>
        Wrap remote loads so a failing remote is skipped (and a fallback UI shown) instead of taking
        the host down. Combine the resilience helper with a feature flag as a manual kill-switch.
      </p>
      <CodeBlock
        language="ts"
        code={`import { loadWithFallback, ResilientRemoteCache } from '@jorvel/runtime';
import { isEnabled } from '@jorvel/runtime'; // feature flags

async function loadRemote(remote) {
  if (!isEnabled('remote:' + remote.name)) throw new Error('killed'); // kill-switch
  return loadWithFallback({ remote, cache: new ResilientRemoteCache(), loader });
}
// Render a <RemoteOutlet noMatch={<Degraded/>} /> so a killed/broken remote degrades gracefully.`}
      />

      <h2 id="mailer-cron">Mailer / queue / cron</h2>
      <p>
        Server actions + a DB (<a href="/docs/database">jorvel add db</a>) cover most jobs. For
        email use Resend, for queues/cron use Upstash QStash or your platform&apos;s scheduler.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineAction } from '@jorvel/runtime';

export const sendWelcome = defineAction(async (input: { to: string }) => {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'hi@app.com', to: input.to, subject: 'Welcome', html: '<p>Hi!</p>' }),
  });
});

// Cron: expose a route hit by Vercel Cron / Upstash QStash on a schedule.`}
      />

      <h2 id="edge-kv">Edge KV / Durable Objects</h2>
      <p>
        On Cloudflare, bindings arrive via the Worker <code>env</code> (see{' '}
        <a href="/docs/deployment">adapter-cloudflare</a>&apos;s <code>onRequest(env)</code>). Use KV
        for read-mostly config and Durable Objects for coordination (also backs the distributed{' '}
        <a href="/docs/security#rate-limit">rate-limit stores</a>).
      </p>
      <CodeBlock
        language="ts"
        code={`export default {
  fetch: createCloudflareHandler({
    App, template, routes,
    onRequest: async (req, env) => {
      const flags = await env.CONFIG_KV.get('flags', 'json'); // KV read
      // stash on request-context locals for loaders to read
    },
  }),
};`}
      />

      <h2 id="dark-mode">Dark mode toggle</h2>
      <p>
        Persist the theme in a <code>SimpleStore</code> (survives across remotes) and reflect it on{' '}
        <code>&lt;html data-theme&gt;</code>. Set it before hydration to avoid a flash.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { getSimpleStore } from '@jorvel/state';
import { useSimpleStore } from '@jorvel/state/react';

const theme = getSimpleStore<'light' | 'dark'>('theme', 'light');

export function ThemeToggle() {
  const value = useSimpleStore(theme);
  return (
    <button onClick={() => {
      const next = value === 'dark' ? 'light' : 'dark';
      theme.set(next);
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    }}>{value === 'dark' ? '☀️' : '🌙'}</button>
  );
}
// In index.html <head>, inline: document.documentElement.dataset.theme = localStorage.theme || 'light'`}
      />

      <h2 id="design-tokens">Design tokens / CSS variables</h2>
      <CodeBlock
        language="css"
        code={`:root {
  --color-bg: #ffffff; --color-fg: #0a0a0a; --radius: 8px; --space: 4px;
}
:root[data-theme='dark'] { --color-bg: #0a0a0a; --color-fg: #fafafa; }
/* Consume in every remote — variables cross Shadow DOM boundaries. */
.card { background: var(--color-bg); color: var(--color-fg); border-radius: var(--radius); }`}
      />
      <p>Ship tokens from a shared package so host + remotes reference the same names.</p>

      <h2 id="css-in-js">CSS-in-JS (vanilla-extract / Panda)</h2>
      <p>
        Prefer zero-runtime CSS-in-JS so styles don&apos;t double-load across remotes.
        <strong> vanilla-extract</strong> (<code>@vanilla-extract/webpack-plugin</code> works with
        Rspack) and <strong>Panda CSS</strong> both compile to static CSS at build time. Add the
        plugin in each app&apos;s <code>rspack.config.mjs</code>; the extracted <code>.css</code> is
        shared like any asset.
      </p>

      <h2 id="trpc">tRPC / Hono server routes</h2>
      <p>
        The <a href="/docs/ssr#server-routes">server-route convention</a> (<code>createApiRouter</code>)
        mounts any fetch handler as a prefix fallback — so tRPC or Hono runs alongside JORVEL SSR.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createApiRouter } from '@jorvel/ssr';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc/router.js';

const api = createApiRouter([], {
  prefix: '/trpc',
  fallback: ({ request }) =>
    fetchRequestHandler({ endpoint: '/trpc', req: request, router: appRouter, createContext: () => ({}) }),
});

// adapter handler: const res = await api.handle(request); return res ?? renderSSR(request);
// Hono: fallback: ({ request }) => honoApp.fetch(request)`}
      />

      <h2 id="stripe">Stripe checkout + webhook</h2>
      <p>
        A server action creates a Checkout Session; a server route verifies the webhook signature
        and fulfills. Keep the secret key server-only.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineAction } from '@jorvel/runtime';

export const checkout = defineAction(async (input: { priceId: string }) => {
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ mode: 'payment', 'line_items[0][price]': input.priceId, 'line_items[0][quantity]': '1', success_url: 'https://app/ok', cancel_url: 'https://app/cancel' }),
  });
  return (await res.json()).url as string;   // redirect the browser here
});

// webhook route: verify \`stripe-signature\` (HMAC) before trusting the event, then fulfill.`}
      />

      <h2 id="ai-chatbot">AI chatbot (Vercel AI SDK)</h2>
      <p>
        Stream tokens from a server route with the Vercel AI SDK; render with{' '}
        <code>useChat</code> on the client. Anthropic Claude shown; swap the provider as needed.
      </p>
      <CodeBlock
        language="ts"
        code={`// server route: POST /api/chat
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: anthropic('claude-sonnet-5'), messages });
  return result.toDataStreamResponse();      // streams to the client
}`}
      />
      <CodeBlock
        language="tsx"
        code={`// client
import { useChat } from '@ai-sdk/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({ api: '/api/chat' });
  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => <p key={m.id}><b>{m.role}:</b> {m.content}</p>)}
      <input value={input} onChange={handleInputChange} />
    </form>
  );
}`}
      />

      <h2 id="ai-sdk">AI SDK / LangChain.js</h2>
      <p>
        The Vercel <strong>AI SDK</strong> (<code>ai</code> + <code>@ai-sdk/*</code>) is the
        recommended default — provider-agnostic, streaming-first, pairs with server actions/routes.
        For agents/RAG, <strong>LangChain.js</strong> runs in the same server routes. Keep model API
        keys server-only (env), never in the client bundle.
      </p>

      <h2 id="react-compiler">React Compiler toggle</h2>
      <p>
        Set <code>features.reactCompiler: true</code> in <code>jorvel.config.json</code>, then add a
        babel pass for the compiler in each app&apos;s <code>rspack.config.mjs</code> (SWC handles the
        rest of the transform):
      </p>
      <CodeBlock
        language="js"
        code={`// rspack.config.mjs — run babel-plugin-react-compiler before swc-loader
{
  test: /\\.[jt]sx$/,
  exclude: /node_modules/,
  use: [{ loader: 'babel-loader', options: { plugins: [['babel-plugin-react-compiler', { target: '18' }]] } }],
}
// deps: pnpm add -D babel-loader @babel/core babel-plugin-react-compiler`}
      />

      <h2 id="optimistic-form">Optimistic form</h2>
      <p>Combine <code>&lt;Form&gt;</code> + <code>useOptimistic</code> for instant feedback:</p>
      <CodeBlock
        language="tsx"
        code={`import { Form, useOptimistic, defineAction } from '@jorvel/runtime';

const addComment = defineAction(async (fd: FormData) => api.post('/comments', fd));

function Comments({ list }: { list: Comment[] }) {
  const [optimistic, add] = useOptimistic(list, (cur, text: string) => [...cur, { id: 'temp', text, pending: true }]);
  return (
    <Form action={addComment} onSubmit={(e) => add(new FormData(e.currentTarget).get('text') as string)}>
      <ul>{optimistic.map((c) => <li key={c.id} style={{ opacity: c.pending ? 0.5 : 1 }}>{c.text}</li>)}</ul>
      <input name="text" /><button>Post</button>
    </Form>
  );
}`}
      />

      <h2 id="magic-link">Magic-link / passkey</h2>
      <p>
        <strong>Magic link</strong>: email a signed, expiring token (reuse the session HMAC), verify
        on click, then <code>seal()</code> a session. <strong>Passkey (WebAuthn)</strong>: use{' '}
        <code>navigator.credentials</code> on the client + a verifier lib server-side, then issue the
        same JORVEL session.
      </p>
      <CodeBlock
        language="ts"
        code={`import { randomToken, hmacSign, hmacVerify, SessionManager } from '@jorvel/security';

// request: sign email+exp, email the link
const exp = String(nowSeconds + 900);
const sig = await hmacSign(email + '.' + exp, process.env.MAGIC_SECRET!);
const link = 'https://app/verify?e=' + encodeURIComponent(email) + '&exp=' + exp + '&sig=' + sig;

// verify: check sig + exp, then seal a session
if (Number(exp) > nowSeconds && (await hmacVerify(email + '.' + exp, sig, process.env.MAGIC_SECRET!))) {
  const setCookie = await sessions.seal({ email });
}`}
      />

      <h2 id="owasp">OWASP Top-10 checklist</h2>
      <table>
        <thead><tr><th>Risk</th><th>JORVEL mitigation</th></tr></thead>
        <tbody>
          <tr><td>Broken access control</td><td><a href="/docs/auth#rbac">RBAC</a> + middleware gate + <code>requireUser</code></td></tr>
          <tr><td>Injection / XSS</td><td>React escaping + <a href="/docs/security">CSP</a> + <code>sanitize</code> + <code>serializeState</code> escapes <code>&lt;/script&gt;</code></td></tr>
          <tr><td>CSRF</td><td>Signed double-submit (<a href="/docs/forms#csrf">verifyCsrf</a>)</td></tr>
          <tr><td>Security misconfig</td><td><code>securityHeaders</code> + <code>policyHeaders</code> defaults; secret-scanning (gitleaks) in CI</td></tr>
          <tr><td>Vulnerable deps</td><td>Dependabot + CodeQL scaffolded at init</td></tr>
          <tr><td>Auth failures</td><td>HMAC-signed sessions, rotation, rate-limit</td></tr>
          <tr><td>SSRF / supply chain</td><td>Federation origin allowlist + SRI on <code>remoteEntry</code></td></tr>
        </tbody>
      </table>

      <h2 id="bff">BFF per remote</h2>
      <p>
        Give each remote its own backend-for-frontend: a <a href="/docs/ssr#server-routes">server
        route</a> namespace (<code>/api/&lt;remote&gt;/*</code>) owned by that team, deployed with the
        remote. The host proxies; the remote&apos;s loaders/actions call its own BFF. Keeps data
        contracts per-team and avoids a shared API monolith.
      </p>
      <CodeBlock
        language="ts"
        code={`// each remote ships its BFF routes under its own prefix
createApiRouter(dashboardRoutes, { prefix: '/api/dashboard' });
// host mounts all remote routers; a remote only owns its namespace`}
      />

      <h2 id="translation-management">Translation management</h2>
      <p>
        Keep catalogs as JSON per locale (<code>locales/&lt;lc&gt;.json</code>) and sync with a TMS
        (Crowdin / Lokalise / Tolgee) via their CLI in CI: push source keys on merge to main, pull
        translations on a schedule into the catalog files <code>@jorvel/i18n</code> loads.
      </p>
      <CodeBlock
        language="bash"
        code={`# CI: push new source strings, pull completed translations
crowdin push sources        # or: lokalise2 file upload / tolgee push
crowdin pull                 # writes locales/*.json consumed by createI18n`}
      />

      <Callout variant="info" title="More">
        See <a href="/docs/comparison">comparison</a>, <a href="/docs/migration">migration</a>, and
        the <a href="/docs/api">API reference</a> for the full surface.
      </Callout>
    </>
  );
}
