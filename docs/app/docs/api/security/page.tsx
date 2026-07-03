import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/security API',
  description:
    'CSP builder, SRI helpers, origin allowlist, rate-limit guard, audit logger, sanitization helpers, OAuth helpers, sandbox bridge.',
};

export default function SecApi() {
  return (
    <>
      <h1>@jorvel/security</h1>
      <p>
        Edge-runtime-safe primitives (Web Crypto, no <code>Buffer</code>, no{' '}
        <code>node:crypto</code>) for federation security. Every helper is tree-shakable and
        side-effect-free.
      </p>

      <Callout variant="info" title="Runtime guarantees">
        Every export runs unchanged on Vercel Edge, Cloudflare Workers, Deno Deploy, and Node. No
        polyfills required — the package only uses <code>crypto.subtle</code>, <code>fetch</code>,
        <code>TextEncoder</code>, and standard JS.
      </Callout>

      <h2 id="csp">CSP</h2>
      <p>
        Build a strict-dynamic + nonce CSP that lets federated remoteEntry scripts execute while
        blocking everything else. <code>cspMiddleware</code> wraps Express/Connect; edge handlers
        call <code>buildCsp</code> directly.
      </p>
      <CodeBlock
        language="ts"
        code={`buildCsp(opts?: {
  nonce?: string;                  // base64url; required for strict-dynamic
  strictDynamic?: boolean;         // default true when nonce present
  strictStyles?: boolean;          // drops 'unsafe-inline' from style-src
  reportTo?: string;
  extra?: Record<string, string[]>; // merged directive overrides
}): string;

cspMeta(opts?: Parameters<typeof buildCsp>[0]): string;  // <meta http-equiv="...">
generateNonce(bytes?: number): string;                   // default 16 bytes → 22-char base64url

cspMiddleware(opts: {
  remotes?: string[];
  reportOnly?: boolean;
  extra?: Record<string, string[]>;
}): RequestHandler;                                       // Express/Connect

cspFastifyHook(opts): FastifyPreHandler;
cspHeaderFactory(opts): (req: { url: string }) => { header: string; nonce: string };`}
      />

      <h3>Wiring a strict-dynamic CSP into an SSR response</h3>
      <CodeBlock
        language="ts"
        code={`import { buildCsp, generateNonce, safeJsonForScript } from '@jorvel/security';

export async function handler(req: Request): Promise<Response> {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    strictDynamic: true,
    extra: { 'connect-src': ['https://api.acme.com'] },
  });

  const html = template
    .replace('__NONCE__', nonce)
    .replace('__STATE__', safeJsonForScript(state));

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': csp,
    },
  });
}`}
      />

      <h2 id="sri">SRI</h2>
      <p>
        Subresource Integrity hashes for federation entry scripts. Generate the hash at build time
        with <code>sriHashFromUrl</code> or compute on-demand from in-memory content.
      </p>
      <CodeBlock
        language="ts"
        code={`sriHash(content: string | ArrayBuffer | Uint8Array, algo?: 'sha256' | 'sha384' | 'sha512'): Promise<string>;
sriAttributes(content, algo?, crossorigin?: 'anonymous' | 'use-credentials'): Promise<{ integrity: string; crossorigin: string }>;
sriHashFromUrl(url: string, opts?: { algo?: 'sha256' | 'sha384' | 'sha512'; allowHttp?: boolean }): Promise<string>;`}
      />

      <h3>Build-time manifest of remote SRI hashes</h3>
      <CodeBlock
        language="ts"
        code={`import { sriHashFromUrl } from '@jorvel/security';

const remotes = [
  'https://cdn.acme.com/dashboard/remoteEntry.js',
  'https://cdn.acme.com/billing/remoteEntry.js',
];

const manifest = Object.fromEntries(
  await Promise.all(remotes.map(async (url) => [url, await sriHashFromUrl(url, { algo: 'sha384' })])),
);
// → { 'https://cdn.acme.com/dashboard/remoteEntry.js': 'sha384-...' }`}
      />

      <h2 id="allowlist">Allowlist</h2>
      <p>
        Single-label (<code>*</code>) and multi-label (<code>**</code>) wildcards. Defense-in-depth
        even with SRI — rejects URLs at the registry level before the network request fires.
      </p>
      <CodeBlock
        language="ts"
        code={`new RemoteAllowlist(rules: string[], opts?: { schemes?: string[] });
// rules: 'https://cdn.acme.com'      — exact
//        'https://*.acme.com'        — single-label wildcard
//        'https://**.cdn.acme.com'   — multi-label wildcard

allow.allows(url: string, name?: string): boolean;
allow.assertAllowed(url: string, name?: string): void;   // throws on miss
allow.isAllowed(url: string, name?: string): boolean;`}
      />

      <CodeBlock
        language="ts"
        code={`import { RemoteAllowlist } from '@jorvel/security';
import { getRemoteRegistry } from '@jorvel/runtime';

const allow = new RemoteAllowlist([
  'https://cdn.acme.com',
  'https://*.preview.acme.com',
]);

getRemoteRegistry().setGuard((url) => allow.allows(url));`}
      />

      <h2 id="rate-limit">Rate limiting</h2>
      <p>
        Token-bucket rate limiter for protected endpoints (auth, write paths). In-memory LRU by
        default; bring your own store for distributed enforcement.
      </p>
      <CodeBlock
        language="ts"
        code={`createRateLimitGuard(opts: {
  capacity: number;                // burst
  refillPerSec: number;            // sustained
  keyFor: (req: { url: string; headers: Record<string, string> }) => string;
  store?: RateLimitStore;          // default: in-memory LRU
  maxKeys?: number;                // default 10_000
}): (req) => {
  allowed: boolean;
  headers: Record<string, string>; // X-RateLimit-*
  response?: { status: 429; headers; body };
};

interface RateLimitStore {
  consume(key: string, amount: number): Promise<{ remaining: number; resetMs: number }>;
}`}
      />

      <h3>Edge worker usage</h3>
      <CodeBlock
        language="ts"
        code={`const limiter = createRateLimitGuard({
  capacity: 30,
  refillPerSec: 5,
  keyFor: (req) => req.headers['cf-connecting-ip'] ?? 'anon',
});

export default {
  async fetch(req) {
    const decision = await limiter({ url: req.url, headers: Object.fromEntries(req.headers) });
    if (!decision.allowed) {
      return new Response('Rate limit', { status: 429, headers: decision.headers });
    }
    return handle(req);
  },
};`}
      />

      <h2 id="audit">Audit log</h2>
      <p>
        Structured audit logger with built-in PII redaction. Multiple sinks; the buffer sink is
        ideal for tests.
      </p>
      <CodeBlock
        language="ts"
        code={`new AuditLogger(opts: {
  sinks: AuditSink[];
  redactKeys?: string[];           // case-insensitive metadata key match
  defaultRedactions?: boolean;     // password, token, cookie, secret — default true
});

audit.success(entry: AuditEntry): Promise<void>;
audit.denied(entry: Omit<AuditEntry, 'metadata'> & { reason: string }): Promise<void>;
audit.error(entry: AuditEntry & { error: unknown }): Promise<void>;

interface AuditSink { (entry: NormalizedEntry): Promise<void> | void }
bufferSink(): { sink: AuditSink; drain(): NormalizedEntry[] };`}
      />

      <h2 id="oauth">OAuth helpers</h2>
      <p>
        Stateless helpers for PKCE flow + state-cookie protection. The package never stores
        anything itself — you persist via cookies / KV.
      </p>
      <CodeBlock
        language="ts"
        code={`generatePkcePair(): Promise<{ verifier: string; challenge: string }>;
buildAuthorizeUrl(opts: { authorizeEndpoint, clientId, redirectUri, scope, state, codeChallenge }): string;
exchangeCodeForToken(opts: { tokenEndpoint, clientId, redirectUri, code, verifier }): Promise<TokenResponse>;

constantTimeEqual(a: string, b: string): boolean;       // for state-cookie comparison
generateStateValue(bytes?: number): string;`}
      />

      <h2 id="sessions">Sessions</h2>
      <p>
        Stateless signed-cookie sessions (HMAC-SHA256). See <a href="/docs/auth">Authentication</a>.
      </p>
      <CodeBlock
        language="ts"
        code={`class SessionManager<T> {
  constructor(opts: { secret: string; verifySecrets?: string[]; cookieName?; maxAge?; cookie?; now? });
  sign(data: T): Promise<string>;                 // payload.signature token
  verify(token): Promise<T | null>;               // null if invalid/expired/tampered
  seal(data: T): Promise<string>;                  // Set-Cookie (HttpOnly Secure SameSite=Lax)
  destroy(): string;                               // Set-Cookie clearing the session
  read(src: string | Request): Promise<T | null>;
  requireUser(src: string | Request): Promise<T>;  // throws SessionRequiredError (status 401)
}
getSession<T>(src, opts): Promise<T | null>;
requireUser<T>(src, opts): Promise<T>;

// OAuth provider presets + profile fetch
OAUTH_PROVIDERS.github | .google | .microsoft;     // { authorizationEndpoint, tokenEndpoint, userinfoEndpoint, defaultScope }
fetchUserInfo<T>(provider, accessToken, fetcher?): Promise<T>;`}
      />

      <h2 id="csrf">CSRF</h2>
      <p>
        Signed double-submit cookie. See <a href="/docs/forms">Forms &amp; CSRF</a>.
      </p>
      <CodeBlock
        language="ts"
        code={`issueCsrfToken(opts?: { cookieName?; headerName?; fieldName?; secret?; cookie? }):
  Promise<{ token: string; setCookie: string }>;

verifyCsrf(req: { method; headers }, opts?, submittedToken?):
  Promise<{ ok: true } | { ok: false; reason: 'missing-cookie'|'missing-token'|'mismatch'|'bad-signature' }>;

csrfFieldName(opts?): string;

// low-level cookie/crypto primitives
serializeCookie(name, value, opts?): string;
parseCookieHeader(header): Record<string, string>;
randomToken(bytes?): string;
hmacSign(data, secret): Promise<string>;  hmacVerify(data, sig, secret): Promise<boolean>;
timingSafeEqual(a, b): boolean;`}
      />

      <h2 id="sandbox">Sandbox bridge</h2>
      <p>
        Postmessage bridge between a sandboxed iframe and the host. The bridge enforces an origin
        allowlist and a schema per message kind. Use for third-party widgets where{' '}
        <code>ShadowRemote</code> isn&apos;t isolation enough.
      </p>
      <CodeBlock
        language="ts"
        code={`createSandboxBridge<E>(opts: {
  iframe: HTMLIFrameElement;
  origin: string | string[];        // exact or wildcard
  schemas: { [K in keyof E]?: Validator<E[K]> };
}): SandboxBridge<E>;

interface SandboxBridge<E> {
  send<K extends keyof E>(kind: K, payload: E[K]): void;
  on<K extends keyof E>(kind: K, handler: (payload: E[K]) => void): () => void;
  destroy(): void;
}`}
      />

      <h2 id="sanitize">Sanitize</h2>
      <CodeBlock
        language="ts"
        code={`escapeHtml(s: string): string;
safeJsonForScript(value: unknown): string;
isSafePathname(path: string): boolean;
pruneProtoKeys<T extends object>(obj: T): T;     // strips __proto__, constructor, prototype`}
      />

      <h3><code>safeJsonForScript</code></h3>
      <p>
        Use whenever you inline server-rendered state into a <code>&lt;script&gt;</code> tag.
        Escapes <code>&lt;/script&gt;</code>, line separator (U+2028), and paragraph separator
        (U+2029) — the three sequences that turn a JSON blob into a script-injection vector.
      </p>
      <CodeBlock
        language="tsx"
        code={`<script id="__STATE__" type="application/json">
  {safeJsonForScript(state)}
</script>`}
      />

      <h2 id="middleware">Composite security middleware</h2>
      <p>
        <code>cspMiddleware</code>, <code>cspFastifyHook</code>, and <code>cspHeaderFactory</code>{' '}
        are pre-baked compositions of CSP + nonce + Referer-Policy + X-Content-Type-Options. They
        cover ~80% of production header policies; reach for the lower-level builders when you need
        custom directives.
      </p>
    </>
  );
}
