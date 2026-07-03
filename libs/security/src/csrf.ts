/**
 * CSRF protection — signed double-submit cookie pattern.
 *
 * Flow:
 *   1. On a safe request (GET), issue a token: set a cookie AND expose the token
 *      to the page (hidden form field / meta tag).
 *   2. On an unsafe request (POST/PUT/PATCH/DELETE), the client echoes the token
 *      in a header or form field. We verify it equals the cookie value (and,
 *      when a `secret` is given, that it carries a valid HMAC so an attacker who
 *      can only set cookies — not read the signed token — can't forge a pair).
 *
 * Stateless: no server-side token store. Runtime-agnostic (Web Crypto).
 */

import {
  randomToken,
  hmacSign,
  hmacVerify,
  timingSafeEqual,
  serializeCookie,
  readCookie,
  type CookieOptions,
} from './cookies.js';

export interface CsrfOptions {
  /** Cookie name. Default `jorvel_csrf`. */
  cookieName?: string;
  /** Request header the client echoes the token in. Default `x-csrf-token`. */
  headerName?: string;
  /** Form field name (multipart/urlencoded fallback). Default `_csrf`. */
  fieldName?: string;
  /**
   * Optional HMAC secret. When set, tokens are `<random>.<hmac>` (signed
   * double-submit) so a cookie-only attacker can't mint a matching pair.
   */
  secret?: string;
  /** Methods that REQUIRE a valid token. Default POST/PUT/PATCH/DELETE. */
  protectedMethods?: string[];
  cookie?: CookieOptions;
}

const DEFAULTS = {
  cookieName: 'jorvel_csrf',
  headerName: 'x-csrf-token',
  fieldName: '_csrf',
  protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
};

function resolve(opts: CsrfOptions = {}) {
  return {
    cookieName: opts.cookieName ?? DEFAULTS.cookieName,
    headerName: (opts.headerName ?? DEFAULTS.headerName).toLowerCase(),
    fieldName: opts.fieldName ?? DEFAULTS.fieldName,
    secret: opts.secret,
    protectedMethods: (opts.protectedMethods ?? DEFAULTS.protectedMethods).map((m) => m.toUpperCase()),
    cookie: opts.cookie,
  };
}

/**
 * Issue a fresh CSRF token. When `secret` is set the token is signed. The
 * cookie is NOT `httpOnly` by design — the page must read the value to echo it.
 */
export async function issueCsrfToken(opts: CsrfOptions = {}): Promise<{ token: string; setCookie: string }> {
  const r = resolve(opts);
  const raw = randomToken(32);
  const token = r.secret ? `${raw}.${await hmacSign(raw, r.secret)}` : raw;
  const setCookie = serializeCookie(r.cookieName, token, {
    sameSite: 'Lax',
    secure: true,
    path: '/',
    ...(r.cookie ?? {}),
    // httpOnly intentionally omitted/forced false: double-submit needs JS read.
    httpOnly: false,
  });
  return { token, setCookie };
}

async function tokenIsAuthentic(token: string, secret: string | undefined): Promise<boolean> {
  if (!secret) return true; // unsigned mode — equality check below is the only gate
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  return hmacVerify(token.slice(0, dot), token.slice(dot + 1), secret);
}

export type CsrfResult =
  | { ok: true }
  | { ok: false; reason: 'missing-cookie' | 'missing-token' | 'mismatch' | 'bad-signature' };

/**
 * Verify a request against the double-submit pattern. Safe methods always pass.
 * `submittedToken` is the value the client echoed (read it from the header, or
 * from a parsed form field for `multipart`/`urlencoded` posts).
 */
export async function verifyCsrf(
  req: { method: string; headers: { get(name: string): string | null } },
  opts: CsrfOptions = {},
  submittedToken?: string | null,
): Promise<CsrfResult> {
  const r = resolve(opts);
  if (!r.protectedMethods.includes(req.method.toUpperCase())) return { ok: true };

  const cookieToken = readCookie(req.headers.get('cookie'), r.cookieName);
  if (!cookieToken) return { ok: false, reason: 'missing-cookie' };

  const sent = submittedToken ?? req.headers.get(r.headerName);
  if (!sent) return { ok: false, reason: 'missing-token' };

  if (!timingSafeEqual(cookieToken, sent)) return { ok: false, reason: 'mismatch' };
  if (!(await tokenIsAuthentic(cookieToken, r.secret))) return { ok: false, reason: 'bad-signature' };

  return { ok: true };
}

/** The form field name to render a hidden `<input>` under. */
export function csrfFieldName(opts: CsrfOptions = {}): string {
  return resolve(opts).fieldName;
}
