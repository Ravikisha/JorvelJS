/**
 * Stateless signed-cookie sessions — `getSession()` / `requireUser()`.
 *
 * The session payload is JSON, base64url-encoded, and signed with HMAC-SHA256:
 *
 *     <base64url(json)>.<base64url(hmac)>
 *
 * No server-side store needed — the cookie IS the session, tamper-evident via
 * the signature. Pair with a rotating `secret` (env var) and `httpOnly` +
 * `secure` + `SameSite=Lax` cookies. For revocation/large payloads use a DB
 * session id as the payload instead.
 *
 * Runtime-agnostic (Web Crypto). Works in middleware (`@jorvel/runtime`), edge
 * adapters, and Node.
 */

import {
  base64UrlEncode,
  base64UrlDecode,
  hmacSign,
  hmacVerify,
  serializeCookie,
  readCookie,
  type CookieOptions,
} from './cookies.js';

export interface SessionOptions {
  /** HMAC secret. Use a long random env var; rotate by listing old secrets in `verifySecrets`. */
  secret: string;
  /** Additional secrets accepted on verify only (key rotation). */
  verifySecrets?: string[];
  /** Cookie name. Default `jorvel_session`. */
  cookieName?: string;
  /** Lifetime in seconds. Default 7 days. Also embedded as `exp` for expiry checks. */
  maxAge?: number;
  cookie?: Omit<CookieOptions, 'maxAge'>;
  /** Wall-clock source (testable). */
  now?: () => number;
}

interface Envelope<T> {
  /** Issued-at (UNIX seconds). */
  iat: number;
  /** Expiry (UNIX seconds). */
  exp: number;
  data: T;
}

const DEFAULT_NAME = 'jorvel_session';
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60;

function resolved(opts: SessionOptions) {
  return {
    secret: opts.secret,
    verifySecrets: [opts.secret, ...(opts.verifySecrets ?? [])],
    cookieName: opts.cookieName ?? DEFAULT_NAME,
    maxAge: opts.maxAge ?? DEFAULT_MAX_AGE,
    now: opts.now ?? (() => Date.now()),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax' as const,
      path: '/',
      ...(opts.cookie ?? {}),
    },
  };
}

/**
 * A reusable session signer/verifier. Construct once with your secret, then
 * `seal()` to write and `read()` / `requireUser()` to consume.
 */
export class SessionManager<T = Record<string, unknown>> {
  private readonly r: ReturnType<typeof resolved>;
  constructor(opts: SessionOptions) {
    if (!opts.secret) throw new Error('[jorvel/security] SessionManager requires a non-empty secret');
    this.r = resolved(opts);
  }

  get cookieName(): string {
    return this.r.cookieName;
  }

  /** Sign `data` into a cookie token string (`payload.signature`). */
  async sign(data: T): Promise<string> {
    const iat = Math.floor(this.r.now() / 1000);
    const env: Envelope<T> = { iat, exp: iat + this.r.maxAge, data };
    const payload = base64UrlEncode(JSON.stringify(env));
    const sig = await hmacSign(payload, this.r.secret);
    return `${payload}.${sig}`;
  }

  /** Verify + parse a token. Returns the data, or null if invalid/expired/tampered. */
  async verify(token: string | null | undefined): Promise<T | null> {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    let ok = false;
    for (const secret of this.r.verifySecrets) {
      if (await hmacVerify(payload, sig, secret)) {
        ok = true;
        break;
      }
    }
    if (!ok) return null;

    let env: Envelope<T>;
    try {
      env = JSON.parse(base64UrlDecode(payload)) as Envelope<T>;
    } catch {
      return null;
    }
    if (typeof env?.exp !== 'number' || env.exp * 1000 <= this.r.now()) return null;
    return env.data;
  }

  /** Build the `Set-Cookie` header that persists `data`. */
  async seal(data: T): Promise<string> {
    const token = await this.sign(data);
    return serializeCookie(this.r.cookieName, token, { ...this.r.cookie, maxAge: this.r.maxAge });
  }

  /** Build the `Set-Cookie` header that clears the session. */
  destroy(): string {
    return serializeCookie(this.r.cookieName, '', { ...this.r.cookie, maxAge: 0 });
  }

  /** Read + verify the session from a Cookie header (or a Request). Null if absent/invalid. */
  async read(source: string | null | undefined | Request): Promise<T | null> {
    const header = headerFrom(source);
    return this.verify(readCookie(header, this.r.cookieName));
  }

  /**
   * Like {@link read} but throws {@link SessionRequiredError} when there is no
   * valid session — for routes/middleware that demand a logged-in user.
   */
  async requireUser(source: string | null | undefined | Request): Promise<T> {
    const data = await this.read(source);
    if (data == null) throw new SessionRequiredError();
    return data;
  }
}

function headerFrom(source: string | null | undefined | Request): string | null | undefined {
  if (source == null || typeof source === 'string') return source;
  return source.headers?.get('cookie');
}

/** Thrown by `requireUser` when no valid session exists. Carries a 401 hint. */
export class SessionRequiredError extends Error {
  readonly status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'SessionRequiredError';
  }
}

// ── Functional shorthands ───────────────────────────────────────────────────

/** One-shot: read + verify a session without holding a manager instance. */
export function getSession<T = Record<string, unknown>>(
  source: string | null | undefined | Request,
  opts: SessionOptions,
): Promise<T | null> {
  return new SessionManager<T>(opts).read(source);
}

/** One-shot `requireUser`. Throws {@link SessionRequiredError} when unauthenticated. */
export function requireUser<T = Record<string, unknown>>(
  source: string | null | undefined | Request,
  opts: SessionOptions,
): Promise<T> {
  return new SessionManager<T>(opts).requireUser(source);
}
