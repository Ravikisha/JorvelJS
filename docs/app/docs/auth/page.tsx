import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Authentication',
  description:
    'Stateless signed-cookie sessions (getSession / requireUser), middleware route gating, and prebuilt OAuth providers (GitHub / Google / Microsoft).',
};

export default function Auth() {
  return (
    <>
      <h1>Authentication</h1>
      <p>
        JORVEL ships the auth <em>primitives</em>, not a framework lock-in: a signed-cookie session
        (<code>getSession</code> / <code>requireUser</code>), a middleware gate, and OAuth 2.0 + PKCE
        helpers with presets for GitHub, Google, and Microsoft. All live in{' '}
        <code>@jorvel/security</code> and are runtime-agnostic (Web Crypto — edge, Node, Workers).
      </p>

      <h2 id="sessions">Sessions</h2>
      <p>
        Sessions are <strong>stateless</strong>: the payload is JSON, base64url-encoded, and signed
        with HMAC-SHA256. The cookie <em>is</em> the session — tamper-evident, no server store. For
        revocation or large payloads, store a DB session id as the payload instead.
      </p>
      <CodeBlock
        language="ts"
        code={`import { SessionManager } from '@jorvel/security';

const sessions = new SessionManager<{ id: string; role: string }>({
  secret: process.env.SESSION_SECRET!,   // long random; rotate via verifySecrets: [...old]
  maxAge: 7 * 24 * 60 * 60,              // 7 days; embedded as exp for expiry checks
});

// after a successful login:
const setCookie = await sessions.seal({ id: user.id, role: user.role });
return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': setCookie } });

// reading (returns null when absent / expired / tampered):
const user = await sessions.read(request);          // pass a Request or a Cookie header string

// logout:
return new Response(null, { headers: { 'set-cookie': sessions.destroy() } });`}
      />
      <p>
        Cookies default to <code>HttpOnly</code> + <code>Secure</code> + <code>SameSite=Lax</code>.
        Rotate the secret without logging everyone out by listing the previous secret in{' '}
        <code>verifySecrets</code> — old cookies still verify, new ones are signed with the new key.
      </p>

      <h2 id="require-user">requireUser</h2>
      <p>
        <code>requireUser</code> throws <code>SessionRequiredError</code> (carrying{' '}
        <code>status: 401</code>) when there is no valid session — catch it at your route/adapter
        boundary to redirect to login.
      </p>
      <CodeBlock
        language="ts"
        code={`import { requireUser, SessionRequiredError } from '@jorvel/security';

try {
  const user = await requireUser(request, { secret: process.env.SESSION_SECRET! });
  // … render the protected route with \`user\`
} catch (e) {
  if (e instanceof SessionRequiredError) {
    return Response.redirect('/login', 302);
  }
  throw e;
}`}
      />

      <h2 id="gate">Middleware route gating</h2>
      <p>
        Combine the session with <a href="/docs/middleware">route middleware</a> to gate whole path
        prefixes in one place:
      </p>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/middleware.ts"
        code={`import { defineMiddleware, redirect, next } from '@jorvel/runtime';
import { getSession } from '@jorvel/security';

export default defineMiddleware(async (ctx) => {
  if (!ctx.pathname.startsWith('/dashboard')) return next();
  const user = await getSession(ctx.request ?? '', { secret: process.env.SESSION_SECRET! });
  if (!user) return redirect('/login?from=' + encodeURIComponent(ctx.pathname));
  ctx.state.user = user;            // downstream middlewares + loaders can read it
  return next();
});`}
      />

      <h2 id="oauth">OAuth (PKCE) with provider presets</h2>
      <p>
        <code>buildAuthorizeUrl</code> / <code>exchangeCodeForTokens</code> implement OAuth 2.0 with
        PKCE. Provider presets supply the endpoints + default scopes so you don&apos;t hand-copy
        URLs. Below: a GitHub login round-trip.
      </p>
      <CodeBlock
        language="ts"
        code={`import {
  OAUTH_PROVIDERS, generatePkceChallenge, buildAuthorizeUrl,
  parseAuthorizationResponse, exchangeCodeForTokens, fetchUserInfo,
} from '@jorvel/security';

const gh = OAUTH_PROVIDERS.github;

// 1. /login/github — redirect to GitHub
const { verifier, challenge } = await generatePkceChallenge();
const state = crypto.randomUUID();
// persist { verifier, state } in a short-lived signed cookie, then:
const url = buildAuthorizeUrl({
  authorizationEndpoint: gh.authorizationEndpoint,
  clientId: process.env.GITHUB_CLIENT_ID!,
  redirectUri: 'https://app.example.com/callback/github',
  scope: gh.defaultScope,
  state,
  codeChallenge: challenge,
});

// 2. /callback/github — exchange code → tokens → profile → session
const { code } = parseAuthorizationResponse(callbackUrl, savedState);
const tokens = await exchangeCodeForTokens({
  tokenEndpoint: gh.tokenEndpoint,
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  code,
  redirectUri: 'https://app.example.com/callback/github',
  codeVerifier: savedVerifier,
});
const profile = await fetchUserInfo('github', tokens.access_token);
const setCookie = await sessions.seal({ id: String(profile.id), role: 'user' });`}
      />

      <Callout variant="warn" title="Never put secrets in the bundle">
        <code>SESSION_SECRET</code> and OAuth client secrets are server-only env vars. Read them in
        middleware / adapters / server routes — never in code that ships to the browser.
      </Callout>

      <h2 id="rbac">RBAC — roles &amp; permissions</h2>
      <p>
        Gate on permissions, not just login. <code>createRbac</code> maps roles → permission strings
        (supports <code>*</code> and <code>posts:*</code> wildcards) and pairs with the session.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createRbac } from '@jorvel/security';

const rbac = createRbac({
  roles: {
    admin: ['*'],
    editor: ['posts:*', 'media:read'],
    viewer: ['posts:read'],
  },
});

const user = await requireUser(request, { secret });
rbac.can(user.roles, 'posts:write');            // editor → true
rbac.requirePermission(user.roles, 'users:delete'); // throws ForbiddenError (403) unless admin
rbac.hasRole(user.roles, 'admin');`}
      />

      <Callout variant="info" title="Pairs with CSRF">
        Cookie-based auth needs CSRF protection on state-changing requests. See the{' '}
        <a href="/docs/forms">Forms &amp; CSRF</a> page for the double-submit cookie helper.
      </Callout>
    </>
  );
}
