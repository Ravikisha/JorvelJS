import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { ShieldIcon } from '@/components/icons';

export const metadata = {
  title: 'Security',
  description:
    'CSP builder, SRI, origin allowlist, base64url nonce validation, safe JSON hydration. Edge-runtime safe.',
};

export default function SecurityPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <ShieldIcon className="h-3 w-3" /> Security
      </Badge>
      <h1>Security</h1>
      <p>
        <code>@jorvel/security</code> packages the primitives federated apps actually need: a CSP
        builder with <code>strict-dynamic</code>, SRI hashing for <code>remoteEntry.js</code>, an
        origin allowlist with wildcard support, base64url-validated nonces, and helpers for safe
        hydration. Every primitive is edge-runtime safe (Web Crypto, no <code>Buffer</code>, no{' '}
        <code>node:crypto</code>).
      </p>

      <h2 id="csp">Content Security Policy</h2>
      <p>
        <code>buildCsp</code> emits a strict policy with sensible defaults and validates the nonce
        token. <code>strict-dynamic</code> is on by default whenever a nonce is provided.
      </p>

      <CodeBlock
        language="ts"
        code={`import { buildCsp } from '@jorvel/security';

const policy = buildCsp({
  nonce: cryptoRandomNonce(),       // base64url
  strictDynamic: true,              // default when nonce is set
  strictStyles: true,               // disables 'unsafe-inline' on style-src
  reportTo: 'https://acme.report-uri.com/r/d/csp/enforce',
  extra: {
    'connect-src': ["'self'", 'https://api.acme.dev'],
  },
});`}
      />

      <Callout variant="warn" title="Don&apos;t mix nonce + 'unsafe-inline'">
        <code>'unsafe-inline'</code> defeats nonce enforcement. <code>buildCsp</code> drops it from{' '}
        <code>style-src</code> when <code>strictStyles</code> is on, and from <code>script-src</code>{' '}
        whenever a nonce is set.
      </Callout>

      <Callout variant="info" title="img-src is locked down by default">
        The baseline <code>img-src</code> is <code>'self' data:</code> — not a blanket{' '}
        <code>https:</code>. Add any image CDNs explicitly via{' '}
        <code>{`extra: { 'img-src': ["'self'", 'data:', 'https://images.acme.com'] }`}</code>.
      </Callout>

      <h2 id="headers">Security headers kit</h2>
      <p>
        <code>securityHeaders()</code> returns a secure-by-default header map you spread into any
        response — the edge adapter&apos;s <code>headers</code> option, the node adapter, or a Worker{' '}
        <code>Response</code>. It covers HSTS, <code>X-Content-Type-Options</code>,{' '}
        <code>X-Frame-Options</code>, <code>Referrer-Policy</code>, <code>Permissions-Policy</code>, and
        the Cross-Origin-* trio. Set CSP separately (via <code>buildCsp</code>) so it can carry a
        per-request nonce.
      </p>
      <CodeBlock
        language="ts"
        code={`import { securityHeaders, buildCsp } from '@jorvel/security';
import { createEdgeAdapter } from '@jorvel/ssr';

export default createEdgeAdapter({
  App, template, routes,
  headers: securityHeaders(),          // HSTS, nosniff, Referrer-Policy, COOP/CORP, …
  csp: () => buildCsp({}, { nonce: generateNonce() }),
});`}
      />
      <Callout variant="warn" title="Cross-origin MFE defaults">
        <code>Cross-Origin-Resource-Policy</code> defaults to <code>cross-origin</code> (a host fetches{' '}
        <code>remoteEntry.js</code> cross-origin; <code>same-origin</code> would block it), and{' '}
        <code>Cross-Origin-Embedder-Policy</code> is OFF by default (<code>require-corp</code> blocks
        cross-origin remotes unless every one sends CORP/CORS). Opt into stricter values deliberately.
      </Callout>

      <h2 id="csp-middleware">CSP middleware</h2>
      <p>
        Drop a per-request nonce into your Express/Connect/Fastify server with{' '}
        <code>cspMiddleware</code>. The middleware sets the header and exposes{' '}
        <code>res.locals.cspNonce</code> for downstream renderers.
      </p>
      <CodeBlock
        language="ts"
        code={`import { cspMiddleware } from '@jorvel/security';

app.use(cspMiddleware({
  remotes: ['https://cdn.example.com'],
  reportOnly: false,
}));

app.get('/', (_req, res) => {
  res.send(\`<script nonce="\${res.locals!.cspNonce}">…</script>\`);
});`}
      />
      <p>
        Use <code>cspFastifyHook</code> as a Fastify <code>preHandler</code> hook, or{' '}
        <code>cspHeaderFactory</code> for framework-neutral header computation.
      </p>

      <h2 id="rate-limit">Rate limiting</h2>
      <p>
        <code>RateLimiter</code> implements a token-bucket per key.{' '}
        <code>createRateLimitGuard</code> returns a request guard that emits{' '}
        <code>X-RateLimit-*</code> headers on success and a 429 with <code>Retry-After</code> when
        the bucket is empty.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createRateLimitGuard } from '@jorvel/security';

const guard = createRateLimitGuard({
  capacity: 60,             // burst
  refillPerSec: 30,         // sustained
  keyFor: (req) =>
    req.headers?.['x-api-key'] ?? req.headers?.['x-forwarded-for'] ?? 'anon',
});

export default async function fetch(req) {
  const r = guard({ url: req.url, headers: Object.fromEntries(req.headers) });
  if (!r.allowed) {
    return new Response(r.response!.body, {
      status: r.response!.status,
      headers: r.response!.headers,
    });
  }
  // …route the request, attaching r.headers to the final response.
}`}
      />
      <Callout variant="info" title="In-memory only by default">
        The default store evicts least-recently-used keys above <code>maxKeys</code>. Pass a custom{' '}
        <code>store</code> (Redis, KV) for multi-instance deployments.
      </Callout>
      <Callout variant="warn" title="The default key trusts X-Forwarded-For">
        With no <code>keyFor</code>, the guard keys on the <strong>first</strong>{' '}
        <code>x-forwarded-for</code> hop. That header is client-spoofable unless you sit behind a
        trusted proxy — for untrusted ingress, pass <code>keyFor</code> using your platform&apos;s
        verified client IP (e.g. <code>request.cf?.ip</code>, <code>x-real-ip</code>) so an attacker
        can&apos;t rotate the key per request.
      </Callout>

      <h2 id="audit-log">Audit log</h2>
      <p>
        Track auth/admin actions with <code>AuditLogger</code>. Sensitive fields in{' '}
        <code>metadata</code> (passwords, tokens, cookies) are scrubbed before sinks see them.
        Redacted keys are matched <strong>case-insensitively</strong>, so{' '}
        <code>apiKey</code>, <code>ApiKey</code>, and <code>APIKEY</code> are all replaced.
      </p>
      <CodeBlock
        language="ts"
        code={`import { AuditLogger, bufferSink } from '@jorvel/security';

const buf = bufferSink();
const audit = new AuditLogger({ sinks: [buf.sink], redactKeys: ['ssn'] });

await audit.success({
  actor: user.id,
  action: 'user.login',
  resource: { type: 'user', id: user.id },
  ip: req.headers['x-forwarded-for'],
  requestId: req.id,
  metadata: { token: 'tk-…', ssn: '…' },   // both replaced with '[REDACTED]'
});

await audit.denied({
  actor: user.id,
  action: 'org.delete',
  resource: { type: 'org', id: org.id },
  reason: 'insufficient role',
});`}
      />

      <h2 id="sri">Subresource Integrity</h2>
      <p>
        <code>sriHashFromUrl</code> fetches a URL and returns a SHA-256/384/512 integrity attribute.
        It rejects HTTP URLs by default — pass <code>{`{ allowHttp: true }`}</code> only in tests.
      </p>

      <CodeBlock
        language="ts"
        code={`import { sriHashFromUrl } from '@jorvel/security';

const integrity = await sriHashFromUrl(
  'https://cdn.acme.com/dashboard/remoteEntry.js',
  { algo: 'sha384' },
);

// "sha384-AbCdEf..."`}
      />

      <h3 id="sri-manifest">SRI for a federation manifest</h3>
      <p>
        Use <code>computeSriForManifest</code> at build time to bulk-hash every
        <code> remoteEntry.js</code> in your manifest, then <code>injectSriIntoHtml</code> to
        patch the shell HTML with the matching <code>integrity</code> + <code>crossorigin</code>{' '}
        attributes. Both helpers run under Web Crypto so they work in Workers, Vercel Edge, and
        Node 19+ without <code>node:crypto</code>.
      </p>

      <CodeBlock
        language="ts"
        code={`import { computeSriForManifest, injectSriIntoHtml } from '@jorvel/security';

const { entries, failures } = await computeSriForManifest(
  manifest.map((m) => ({ name: m.name, entryUrl: m.entryUrl })),
  { algo: 'sha384', concurrency: 6 },
);

// Then patch the shell:
const html = injectSriIntoHtml(template, entries, { match: 'basename' });`}
      />

      <h3 id="sri-enforce">Enforcing SRI at load time</h3>
      <p>
        Once a remote carries an <code>integrity</code> hash, the browser refuses to run mismatched
        bytes. To make that <em>mandatory</em>, pass <code>requireIntegrity</code> to{' '}
        <code>loadRemoteEntry</code>/<code>loadRemoteModule</code> — a remote with no hash is rejected{' '}
        <strong>before</strong> any <code>{`<script>`}</code> is injected, so a tampered or typo&apos;d
        entry URL can never run unverified code. The loader also rejects an{' '}
        <code>integrity</code> hash combined with <code>crossOrigin: &apos;none&apos;</code>, since the
        browser skips SRI checks on no-CORS scripts and would silently run the bytes anyway.
      </p>

      <CodeBlock
        language="ts"
        code={`import { loadRemoteModule } from '@jorvel/runtime';

const mod = await loadRemoteModule(
  { name: 'dashboard', entryUrl: '...', integrity: 'sha384-...' }, // stamp from the SRI manifest
  './App',
  { requireIntegrity: true }, // fail closed if integrity is missing
);`}
      />

      <h2 id="sandbox">Sandboxed remotes</h2>
      <p>
        For untrusted code, mount the remote inside an iframe with the
        <code> sandbox</code> attribute and talk to it over a tiny postMessage RPC bridge that
        pins <code>event.origin</code> and <code>event.source</code>.{' '}
        <code>buildSandboxIframeAttrs</code> refuses dangerous tokens (
        <code>allow-same-origin</code>, <code>allow-top-navigation</code>) that would defeat the
        sandbox.
      </p>

      <CodeBlock
        language="ts"
        code={`import { buildSandboxIframeAttrs, createSandboxBridge } from '@jorvel/security';

const attrs = buildSandboxIframeAttrs({
  src: 'https://untrusted.example.com/remote.html',
  permissions: ['allow-scripts'],
});
// → { src, sandbox: 'allow-scripts', referrerpolicy: 'no-referrer' }

const bridge = createSandboxBridge({
  target: iframe.contentWindow!,
  host: window,
  expectedOrigin: 'https://untrusted.example.com',
});
const result = await bridge.request('search', { q: 'react' }, 2_000);`}
      />

      <h2 id="oauth">OAuth 2.0 / OIDC + PKCE</h2>
      <p>
        Pure-protocol helpers — pair with any IDP (Auth0, Cognito, Keycloak, Okta).{' '}
        <code>generatePkceChallenge</code> produces a 43-byte verifier + S256 challenge.{' '}
        <code>buildAuthorizeUrl</code> emits the authorize redirect.
        <code> parseAuthorizationResponse</code> validates the <code>state</code> CSRF guard.
        <code> exchangeCodeForTokens</code> + <code>refreshTokens</code> POST the form-encoded
        grant; <code>TokenStore</code> auto-refreshes with concurrent-call coalescing.
      </p>

      <CodeBlock
        language="ts"
        code={`import {
  generatePkceChallenge, buildAuthorizeUrl,
  parseAuthorizationResponse, exchangeCodeForTokens,
  refreshTokens, TokenStore, tokenSetFromResponse,
} from '@jorvel/security';

// 1. login start
const pkce = await generatePkceChallenge();
const state = crypto.randomUUID();
sessionStorage.setItem('pkce', JSON.stringify({ ...pkce, state }));
location.href = buildAuthorizeUrl({
  authorizationEndpoint: 'https://idp.example.com/authorize',
  clientId: 'my-spa',
  redirectUri: \`\${location.origin}/cb\`,
  scope: ['openid', 'profile', 'email'],
  state,
  codeChallenge: pkce.challenge,
});

// 2. callback
const { code } = parseAuthorizationResponse(location.href, state);
const tokens = await exchangeCodeForTokens({
  tokenEndpoint: 'https://idp.example.com/token',
  clientId: 'my-spa',
  code,
  redirectUri: \`\${location.origin}/cb\`,
  codeVerifier: pkce.verifier,
});

// 3. auto-refreshing store
const store = new TokenStore(tokenSetFromResponse(tokens), {
  refresher: async (current) => tokenSetFromResponse(
    await refreshTokens({
      tokenEndpoint: 'https://idp.example.com/token',
      clientId: 'my-spa',
      refreshToken: current.refreshToken!,
    }),
  ),
});
fetch('/api/me', { headers: { authorization: \`Bearer \${await store.getAccessToken()}\` } });`}
      />

      <h2 id="allowlist">Origin allowlist</h2>
      <CodeBlock
        language="ts"
        code={`import { RemoteAllowlist } from '@jorvel/security';

const list = new RemoteAllowlist([
  'https://*.acme.com',
  'https://**.cdn.cloudflare.net',
]);

list.allows('https://cdn.acme.com/x.js');         // true
list.allows('https://evil.cdn.cloudflare.net/x'); // true (multi-label match)
list.allows('https://acme.com/x.js');             // false (single-label needs subdomain)`}
      />

      <Callout variant="info" title="Schemes are restricted by default">
        Only <code>http(s):</code> URLs are allowed. Pass{' '}
        <code>{`new RemoteAllowlist(rules, { schemes: ['file:'] })`}</code> to opt in to additional
        schemes — useful for tests, never for production.
      </Callout>

      <h2 id="nonce">Nonce generation + validation</h2>
      <CodeBlock
        language="ts"
        code={`function cryptoRandomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}`}
      />

      <p>
        Nonces are validated against <code>/^[A-Za-z0-9_-]+$/</code> before being baked into the CSP
        — corrupted or forgotten nonces throw rather than silently producing an invalid policy.{' '}
        <code>generateNonce()</code> <strong>throws</strong> when Web Crypto is unavailable; it never
        falls back to an insecure <code>Math.random()</code> source.
      </p>

      <h2 id="safe-json">Safe state hydration</h2>
      <CodeBlock
        language="ts"
        code={`import { safeJsonForScript, escapeHtml, pruneProtoKeys } from '@jorvel/security';

const head = \`
  <script id="__jorvel_state" type="application/json" nonce="\${nonce}">
    \${safeJsonForScript({ user, flags })}
  </script>
\`;

// Render error messages back to the user (XSS-safe)
const message = escapeHtml(error.message);

// Sanitize untrusted maps before merging into runtime config
const safe = pruneProtoKeys(JSON.parse(rawConfig));`}
      />

      <Callout variant="danger" title="Why this matters">
        Without <code>safeJsonForScript</code>, a string containing <code>{`</script>`}</code> in
        your serialized state breaks out of the script element and turns into reflected XSS. The
        helper escapes the closing-tag sequence and wraps circular-reference errors so they
        don&apos;t take down the request.
      </Callout>

      <h2 id="threat-model">Threat model</h2>
      <p>
        Federation surfaces three threat classes. Each JORVEL primitive maps to one of them.
      </p>
      <table>
        <thead>
          <tr><th>Threat</th><th>Mitigation</th><th>Defense layer</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Untrusted remote URL (config injection)</td>
            <td><code>RemoteAllowlist</code> with wildcard rules</td>
            <td>Runtime — fetch time</td>
          </tr>
          <tr>
            <td>CDN tampering of <code>remoteEntry.js</code></td>
            <td>SRI hashes (<code>sriHashFromUrl</code>, <code>federation.sri</code>)</td>
            <td>Browser — script execution</td>
          </tr>
          <tr>
            <td>XSS via hydration payload</td>
            <td><code>safeJsonForScript</code> + nonce</td>
            <td>Serialization + CSP</td>
          </tr>
          <tr>
            <td>Inline-script injection in remote markup</td>
            <td><code>strict-dynamic</code> CSP with base64url nonce</td>
            <td>Browser — script-src</td>
          </tr>
          <tr>
            <td>Credential/token leakage in logs</td>
            <td><code>AuditLogger</code> with <code>redactKeys</code></td>
            <td>Application</td>
          </tr>
          <tr>
            <td>Brute-force / scraping</td>
            <td><code>createRateLimitGuard</code> token-bucket</td>
            <td>Edge / origin</td>
          </tr>
        </tbody>
      </table>

      <h2 id="defense-in-depth">Defense in depth recipe</h2>
      <p>
        Strict-CSP <em>and</em> SRI <em>and</em> allowlist together. Any one of them prevents a
        compromise; the combination forces an attacker to break the browser, the CDN, and your
        build pipeline simultaneously.
      </p>
      <CodeBlock
        language="ts"
        filename="edge/handler.ts"
        code={`import { buildCsp, generateNonce, RemoteAllowlist } from '@jorvel/security';
import { createEdgeAdapter, LruHtmlCache } from '@jorvel/ssr/edge';

const allow = new RemoteAllowlist(['https://*.cdn.acme.com']);

export default createEdgeAdapter({
  App,
  template,
  routes,
  csp: (_req) => {
    const nonce = generateNonce();
    return {
      header: buildCsp({
        nonce,
        strictDynamic: true,
        strictStyles: true,
        extra: { 'connect-src': ["'self'", 'https://api.acme.com'] },
      }),
      nonce,
    };
  },
  beforeRemoteLoad: (descriptor) => allow.assertAllowed(descriptor.entryUrl),
});`}
      />
    </>
  );
}
