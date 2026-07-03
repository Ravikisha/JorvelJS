/**
 * OAuth 2.0 / OIDC helpers — PKCE + token refresh.
 *
 * Pure protocol helpers; no React, no IDP-specific quirks. Wire them to any
 * provider (Auth0, Cognito, Keycloak, Okta, your own).
 *
 * - `generatePkceChallenge()` — random 43-byte verifier + S256 challenge
 * - `buildAuthorizeUrl({ ... })` — authorization request URL
 * - `parseAuthorizationResponse(url, expectedState)` — extract code + state
 * - `exchangeCodeForTokens({ ... })` — POST /token with PKCE verifier
 * - `refreshTokens({ ... })` — POST /token with refresh_token grant
 * - `TokenStore` — wraps a token set, knows when to refresh
 */

export interface PkceChallenge {
  verifier: string;
  challenge: string;
  method: 'S256';
}

const VERIFIER_BYTES = 32; // 32 random bytes → 43-char base64url string

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) throw new Error('[jorvel/security] OAuth helpers require Web Crypto');
  return c;
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  const b64 = typeof btoa === 'function'
    ? btoa(bin)
    : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function generatePkceChallenge(): Promise<PkceChallenge> {
  const c = getCrypto();
  const verifierBytes = new Uint8Array(VERIFIER_BYTES);
  c.getRandomValues(verifierBytes);
  const verifier = base64UrlFromBytes(verifierBytes);
  const challengeBytes = new Uint8Array(
    await c.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  return { verifier, challenge: base64UrlFromBytes(challengeBytes), method: 'S256' };
}

export interface AuthorizeUrlOptions {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope?: string | string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod?: 'S256' | 'plain';
  /** OIDC ID-token request — pass `'openid'` in scope to enable. */
  nonce?: string;
  /** Extra params merged onto the URL (`prompt`, `audience`, etc). */
  extras?: Record<string, string>;
}

export function buildAuthorizeUrl(opts: AuthorizeUrlOptions): string {
  const u = new URL(opts.authorizationEndpoint);
  const params = u.searchParams;
  // Apply caller extras FIRST so the security-critical managed params below
  // always win — otherwise `extras: { redirect_uri: 'https://evil' }` would
  // override the real redirect_uri / response_type (open-redirect / flow hijack).
  if (opts.extras) for (const [k, v] of Object.entries(opts.extras)) params.set(k, v);
  params.set('response_type', 'code');
  params.set('client_id', opts.clientId);
  params.set('redirect_uri', opts.redirectUri);
  if (opts.scope) {
    params.set('scope', Array.isArray(opts.scope) ? opts.scope.join(' ') : opts.scope);
  }
  params.set('state', opts.state);
  params.set('code_challenge', opts.codeChallenge);
  params.set('code_challenge_method', opts.codeChallengeMethod ?? 'S256');
  if (opts.nonce) params.set('nonce', opts.nonce);
  return u.toString();
}

export interface AuthorizationResponse {
  code: string;
  state: string;
}

export function parseAuthorizationResponse(url: string, expectedState: string): AuthorizationResponse {
  const u = new URL(url);
  const error = u.searchParams.get('error');
  if (error) {
    const desc = u.searchParams.get('error_description') ?? '';
    throw new Error(`[jorvel/security] authorization error "${error}"${desc ? `: ${desc}` : ''}`);
  }
  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  if (!code) throw new Error('[jorvel/security] authorization response missing "code"');
  if (!state) throw new Error('[jorvel/security] authorization response missing "state"');
  if (state !== expectedState) throw new Error('[jorvel/security] authorization "state" mismatch (CSRF guard)');
  return { code, state };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface ExchangeCodeOptions {
  tokenEndpoint: string;
  clientId: string;
  /** Confidential clients only — public SPAs omit this. */
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  fetcher?: typeof fetch;
}

async function postForm(
  url: string,
  body: Record<string, string>,
  fetcher: typeof fetch,
): Promise<TokenResponse> {
  const form = new URLSearchParams(body).toString();
  const res = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: form,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`[jorvel/security] token endpoint ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCodeForTokens(opts: ExchangeCodeOptions): Promise<TokenResponse> {
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: opts.clientId,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  };
  if (opts.clientSecret) body['client_secret'] = opts.clientSecret;
  return postForm(opts.tokenEndpoint, body, opts.fetcher ?? fetch);
}

export interface RefreshTokensOptions {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scope?: string | string[];
  fetcher?: typeof fetch;
}

export async function refreshTokens(opts: RefreshTokensOptions): Promise<TokenResponse> {
  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: opts.clientId,
    refresh_token: opts.refreshToken,
  };
  if (opts.clientSecret) body['client_secret'] = opts.clientSecret;
  if (opts.scope) body['scope'] = Array.isArray(opts.scope) ? opts.scope.join(' ') : opts.scope;
  return postForm(opts.tokenEndpoint, body, opts.fetcher ?? fetch);
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Absolute UNIX ms when the access token expires. */
  expiresAt?: number;
  scope?: string;
}

export interface TokenStoreOptions {
  /** Number of ms before `expiresAt` to consider the token stale. Default 60s. */
  skewMs?: number;
  /** Wall-clock source — testable. */
  now?: () => number;
  /** Caller-supplied refresher. Receives the current set, returns a new one. */
  refresher: (current: TokenSet) => Promise<TokenSet>;
}

/**
 * Wraps a token set with auto-refresh. Concurrent callers to `getAccessToken`
 * share a single in-flight refresh promise so the IDP isn't hammered.
 */
export class TokenStore {
  private set: TokenSet;
  private readonly opts: Required<Omit<TokenStoreOptions, 'now'>> & { now: () => number };
  private inFlight: Promise<TokenSet> | null = null;

  constructor(initial: TokenSet, opts: TokenStoreOptions) {
    this.set = initial;
    this.opts = {
      skewMs: opts.skewMs ?? 60_000,
      now: opts.now ?? Date.now,
      refresher: opts.refresher,
    };
  }

  current(): TokenSet { return this.set; }

  isExpired(): boolean {
    if (this.set.expiresAt === undefined) return false;
    return this.opts.now() + this.opts.skewMs >= this.set.expiresAt;
  }

  async getAccessToken(): Promise<string> {
    if (!this.isExpired()) return this.set.accessToken;
    if (this.inFlight) {
      const next = await this.inFlight;
      return next.accessToken;
    }
    this.inFlight = (async () => {
      try {
        const next = await this.opts.refresher(this.set);
        this.set = mergeTokens(this.set, next);
        return this.set;
      } finally {
        this.inFlight = null;
      }
    })();
    const next = await this.inFlight;
    return next.accessToken;
  }
}

function mergeTokens(prev: TokenSet, next: TokenSet): TokenSet {
  const out: TokenSet = { accessToken: next.accessToken };
  const refreshToken = next.refreshToken ?? prev.refreshToken;
  if (refreshToken !== undefined) out.refreshToken = refreshToken;
  const idToken = next.idToken ?? prev.idToken;
  if (idToken !== undefined) out.idToken = idToken;
  const scope = next.scope ?? prev.scope;
  if (scope !== undefined) out.scope = scope;
  const expiresAt = next.expiresAt ?? prev.expiresAt;
  if (expiresAt !== undefined) out.expiresAt = expiresAt;
  return out;
}

// ── Provider presets ─────────────────────────────────────────────────────

export interface ProviderPreset {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  /** Userinfo endpoint for fetching the profile after token exchange. */
  userinfoEndpoint: string;
  /** Sensible default scopes for "log in + read basic profile". */
  defaultScope: string[];
}

/**
 * Endpoint presets for common IDPs so callers don't hand-copy URLs. Pair with
 * `buildAuthorizeUrl` / `exchangeCodeForTokens`. Microsoft uses the multi-tenant
 * `common` authority — swap in your tenant id for single-tenant apps.
 */
export const OAUTH_PROVIDERS = {
  github: {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    userinfoEndpoint: 'https://api.github.com/user',
    defaultScope: ['read:user', 'user:email'],
  },
  google: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userinfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    defaultScope: ['openid', 'email', 'profile'],
  },
  microsoft: {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
    defaultScope: ['openid', 'email', 'profile'],
  },
} as const satisfies Record<string, ProviderPreset>;

export type OAuthProviderName = keyof typeof OAUTH_PROVIDERS;

/** Fetch the user profile with a bearer access token from a preset's userinfo endpoint. */
export async function fetchUserInfo<T = Record<string, unknown>>(
  provider: OAuthProviderName | { userinfoEndpoint: string },
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const endpoint =
    typeof provider === 'string' ? OAUTH_PROVIDERS[provider].userinfoEndpoint : provider.userinfoEndpoint;
  const res = await fetcher(endpoint, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`[jorvel/security] userinfo ${res.status}`);
  return (await res.json()) as T;
}

/** Convert a `TokenResponse` (seconds-from-now) to a `TokenSet` (absolute ms). */
export function tokenSetFromResponse(
  res: TokenResponse,
  now: number = Date.now(),
): TokenSet {
  const out: TokenSet = { accessToken: res.access_token };
  if (res.refresh_token) out.refreshToken = res.refresh_token;
  if (res.id_token) out.idToken = res.id_token;
  if (res.scope) out.scope = res.scope;
  if (res.expires_in) out.expiresAt = now + res.expires_in * 1000;
  return out;
}
