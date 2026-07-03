/**
 * Cookie + HMAC primitives shared by `session.ts` and `csrf.ts`.
 *
 * Runtime-agnostic: Web Crypto only (Workers / edge / Node 18+), no Buffer, no
 * `node:crypto`. Strings in/out so callers can wire to any Request/Response.
 */

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) throw new Error('[jorvel/security] cookie helpers require Web Crypto');
  return c;
}

// ── base64url ────────────────────────────────────────────────────────────────

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function base64UrlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin =
    typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64UrlEncode(value: string): string {
  return base64UrlFromBytes(ENC.encode(value));
}

export function base64UrlDecode(value: string): string {
  return DEC.decode(bytesFromBase64Url(value));
}

// ── Random tokens ──────────────────────────────────────────────────────────

/** Cryptographically-random base64url token. Default 32 bytes → 43 chars. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  getCrypto().getRandomValues(buf);
  return base64UrlFromBytes(buf);
}

// ── HMAC-SHA256 sign / verify ─────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Returns a base64url HMAC-SHA256 of `data` under `secret`. */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = new Uint8Array(await getCrypto().subtle.sign('HMAC', key, ENC.encode(data)));
  return base64UrlFromBytes(sig);
}

/** Constant-time comparison of two strings. Length leak is acceptable here. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a base64url HMAC produced by {@link hmacSign}. Constant-time. */
export async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  return timingSafeEqual(expected, signature);
}

// ── Set-Cookie serialization ─────────────────────────────────────────────

export interface CookieOptions {
  path?: string;
  domain?: string;
  /** Lifetime in seconds. Omit for a session cookie. */
  maxAge?: number;
  /** Absolute expiry. Mutually usable with maxAge. */
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/** Build a `Set-Cookie` header value. `value` is encoded with encodeURIComponent. */
export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  // SameSite=None is meaningless (and rejected by browsers) without Secure.
  if (opts.sameSite === 'None' && !opts.secure) parts.push('Secure');
  return parts.join('; ');
}

const COOKIE_RE = /([^=;\s]+)=([^;]*)/g;

/** Parse a `Cookie` request header into a name→value map. */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = COOKIE_RE.exec(header)) !== null) {
    const k = m[1]!.trim();
    if (k && !(k in out)) {
      try {
        out[k] = decodeURIComponent(m[2]!.trim());
      } catch {
        out[k] = m[2]!.trim();
      }
    }
  }
  return out;
}

/** Read one cookie value from a `Cookie` header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  return parseCookieHeader(header)[name];
}
