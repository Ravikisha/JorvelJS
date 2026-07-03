import { describe, expect, it, vi } from 'vitest';
import {
  generatePkceChallenge,
  buildAuthorizeUrl,
  parseAuthorizationResponse,
  exchangeCodeForTokens,
  refreshTokens,
  tokenSetFromResponse,
  TokenStore,
  type TokenResponse,
} from '../src/index.js';

describe('generatePkceChallenge', () => {
  it('returns S256 challenge with base64url verifier/challenge (no padding)', async () => {
    const c = await generatePkceChallenge();
    expect(c.method).toBe('S256');
    expect(c.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c.verifier.length).toBeGreaterThanOrEqual(43);
    expect(c.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c.challenge.length).toBeGreaterThanOrEqual(43);
    expect(c.verifier).not.toBe(c.challenge);
  });

  it('produces different verifiers across calls', async () => {
    const a = await generatePkceChallenge();
    const b = await generatePkceChallenge();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('buildAuthorizeUrl', () => {
  it('extras cannot override security-critical managed params', () => {
    const url = buildAuthorizeUrl({
      authorizationEndpoint: 'https://idp.example.com/authorize',
      clientId: 'my-spa',
      redirectUri: 'https://app.example.com/cb',
      state: 's',
      codeChallenge: 'C',
      extras: { redirect_uri: 'https://evil.example.com', response_type: 'token', audience: 'api' },
    });
    const u = new URL(url);
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    // Non-conflicting extras are still applied.
    expect(u.searchParams.get('audience')).toBe('api');
  });

  it('emits the canonical OIDC authorize URL', () => {
    const url = buildAuthorizeUrl({
      authorizationEndpoint: 'https://idp.example.com/authorize',
      clientId: 'my-spa',
      redirectUri: 'https://app.example.com/cb',
      scope: ['openid', 'profile', 'email'],
      state: 'state-abc',
      codeChallenge: 'CHAL',
      nonce: 'nonce-xyz',
    });
    const u = new URL(url);
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('my-spa');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
    expect(u.searchParams.get('scope')).toBe('openid profile email');
    expect(u.searchParams.get('state')).toBe('state-abc');
    expect(u.searchParams.get('code_challenge')).toBe('CHAL');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('nonce')).toBe('nonce-xyz');
  });

  it('passes through extras (audience / prompt)', () => {
    const url = buildAuthorizeUrl({
      authorizationEndpoint: 'https://idp.example.com/authorize',
      clientId: 'c', redirectUri: '/', state: 's', codeChallenge: 'C',
      extras: { audience: 'api://x', prompt: 'login' },
    });
    expect(new URL(url).searchParams.get('audience')).toBe('api://x');
    expect(new URL(url).searchParams.get('prompt')).toBe('login');
  });
});

describe('parseAuthorizationResponse', () => {
  it('returns code + state when both match', () => {
    const out = parseAuthorizationResponse(
      'https://app.example.com/cb?code=AUTH_CODE&state=state-abc',
      'state-abc',
    );
    expect(out).toEqual({ code: 'AUTH_CODE', state: 'state-abc' });
  });

  it('throws CSRF guard error when state mismatches', () => {
    expect(() =>
      parseAuthorizationResponse('https://app.example.com/cb?code=X&state=evil', 'expected'),
    ).toThrow(/"state" mismatch/);
  });

  it('throws when the IdP returned an error', () => {
    expect(() =>
      parseAuthorizationResponse(
        'https://app.example.com/cb?error=access_denied&error_description=User+aborted',
        'state',
      ),
    ).toThrow(/access_denied.*User aborted/);
  });

  it('throws when the response is missing the code', () => {
    expect(() =>
      parseAuthorizationResponse('https://app.example.com/cb?state=s', 's'),
    ).toThrow(/missing "code"/);
  });
});

describe('exchangeCodeForTokens', () => {
  it('POSTs the form-encoded payload with PKCE verifier', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: 'AT', expires_in: 3600 }), { status: 200 }),
    );
    const out = await exchangeCodeForTokens({
      tokenEndpoint: 'https://idp.example.com/token',
      clientId: 'c', code: 'CODE', redirectUri: '/cb', codeVerifier: 'V',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(out.access_token).toBe('AT');
    const init = fetcher.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('V');
    expect(body.get('code')).toBe('CODE');
  });

  it('throws with response body when the IdP returns non-2xx', async () => {
    const fetcher = vi.fn(async () => new Response('invalid_grant', { status: 400 }));
    await expect(exchangeCodeForTokens({
      tokenEndpoint: 'https://idp.example.com/token',
      clientId: 'c', code: 'X', redirectUri: '/', codeVerifier: 'V',
      fetcher: fetcher as unknown as typeof fetch,
    })).rejects.toThrow(/400: invalid_grant/);
  });
});

describe('refreshTokens', () => {
  it('sends the refresh_token grant', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: 'NEW', expires_in: 600 }), { status: 200 }),
    );
    const out = await refreshTokens({
      tokenEndpoint: 'https://idp.example.com/token',
      clientId: 'c',
      refreshToken: 'RT',
      scope: ['openid', 'email'],
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(out.access_token).toBe('NEW');
    const body = new URLSearchParams(fetcher.mock.calls[0]![1]!.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('RT');
    expect(body.get('scope')).toBe('openid email');
  });
});

describe('TokenStore', () => {
  const baseRes = (over: Partial<TokenResponse> = {}): TokenResponse => ({
    access_token: 'AT', expires_in: 3600, ...over,
  });

  it('returns the cached access token while it is fresh', async () => {
    const now = vi.fn(() => 1_000_000);
    const refresher = vi.fn(async () => tokenSetFromResponse(baseRes({ access_token: 'NEW' }), now()));
    const store = new TokenStore(tokenSetFromResponse(baseRes(), now()), { refresher, now });
    expect(await store.getAccessToken()).toBe('AT');
    expect(refresher).not.toHaveBeenCalled();
  });

  it('refreshes when within the expiry skew window', async () => {
    let t = 1_000_000;
    const now = () => t;
    const set = tokenSetFromResponse(baseRes({ expires_in: 60 }), t); // expiresAt = t + 60000
    const refresher = vi.fn(async () =>
      tokenSetFromResponse(baseRes({ access_token: 'NEW' }), now()),
    );
    const store = new TokenStore(set, { refresher, now, skewMs: 30_000 });
    t = 1_000_000 + 40_000; // 20s left → inside skew → refresh
    expect(await store.getAccessToken()).toBe('NEW');
    expect(refresher).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent refreshes into one IdP call', async () => {
    const now = vi.fn(() => 1_000_000);
    const set = { accessToken: 'OLD', expiresAt: 0 }; // already expired
    let resolve!: (v: TokenResponse) => void;
    const refresher = vi.fn(() => new Promise<typeof set>((res) => {
      resolve = (v) => res(tokenSetFromResponse(v, now()));
    }));
    const store = new TokenStore(set, { refresher, now });
    const a = store.getAccessToken();
    const b = store.getAccessToken();
    // Let the inFlight IIFE schedule the spy invocation, then resolve it.
    await new Promise((r) => setTimeout(r, 0));
    resolve(baseRes({ access_token: 'X' }));
    expect(await Promise.all([a, b])).toEqual(['X', 'X']);
    expect(refresher).toHaveBeenCalledOnce();
  });

  it('keeps the existing refresh_token when the IdP omits it', async () => {
    const now = vi.fn(() => 1_000_000);
    const initial = { accessToken: 'OLD', refreshToken: 'KEEP', expiresAt: 0 };
    const refresher = vi.fn(async () =>
      tokenSetFromResponse(baseRes({ access_token: 'X', expires_in: 60 }), now()),
    );
    const store = new TokenStore(initial, { refresher, now });
    await store.getAccessToken();
    expect(store.current().refreshToken).toBe('KEEP');
  });
});

describe('tokenSetFromResponse', () => {
  it('converts seconds-from-now to absolute expiresAt', () => {
    const set = tokenSetFromResponse({ access_token: 'A', expires_in: 60 } as TokenResponse, 1_000_000);
    expect(set.expiresAt).toBe(1_000_000 + 60_000);
  });

  it('omits expiresAt when expires_in is missing', () => {
    const set = tokenSetFromResponse({ access_token: 'A' } as TokenResponse, 1_000_000);
    expect(set.expiresAt).toBeUndefined();
  });
});
