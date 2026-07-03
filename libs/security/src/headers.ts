/**
 * @jorvel/security — HTTP security headers preset.
 *
 * Returns a `Record<string, string>` you spread into any response — e.g.
 * `createEdgeAdapter({ headers: securityHeaders() })`, the node adapter's
 * `headers`, or a Worker `Response`. Pairs with `buildCsp()` (CSP is set
 * separately so it can carry a per-request nonce).
 *
 * MFE caveats (cross-origin remotes):
 *  - `Cross-Origin-Resource-Policy` defaults to `'cross-origin'` because a host
 *    fetches `remoteEntry.js` cross-origin; `'same-origin'` would block it.
 *  - `Cross-Origin-Embedder-Policy` defaults OFF — `require-corp` blocks
 *    cross-origin remotes unless every one sends CORP/CORS. Opt in deliberately.
 */

export interface HstsOptions {
  /** Seconds. Default 180 days. */
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export interface SecurityHeadersOptions {
  /** Strict-Transport-Security. `true` ⇒ defaults; browsers ignore it over http. Default true. */
  hsts?: boolean | HstsOptions;
  /** X-Content-Type-Options: nosniff. Default true. */
  noSniff?: boolean;
  /** X-Frame-Options. Default 'DENY'. `false` to omit (rely on CSP frame-ancestors). */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** Referrer-Policy. Default 'strict-origin-when-cross-origin'. `false` to omit. */
  referrerPolicy?: string | false;
  /**
   * Permissions-Policy. Pass a raw string, or a map of `feature → allowlist`
   * (`[]` = deny all). Default denies camera/microphone/geolocation. `false` to omit.
   */
  permissionsPolicy?: string | Record<string, string[]> | false;
  /** Cross-Origin-Opener-Policy. Default 'same-origin'. `false` to omit. */
  coop?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;
  /** Cross-Origin-Embedder-Policy. Default OFF (omit). Set 'require-corp'/'credentialless' to opt in. */
  coep?: 'require-corp' | 'credentialless' | false;
  /** Cross-Origin-Resource-Policy. Default 'cross-origin' (MFE-friendly). `false` to omit. */
  corp?: 'same-origin' | 'same-site' | 'cross-origin' | false;
}

function buildHsts(v: boolean | HstsOptions): string | null {
  if (v === false) return null;
  const o: HstsOptions = v === true ? {} : v;
  const maxAge = o.maxAge ?? 15_552_000; // 180 days
  let out = `max-age=${maxAge}`;
  if (o.includeSubDomains ?? true) out += '; includeSubDomains';
  if (o.preload) out += '; preload';
  return out;
}

function buildPermissionsPolicy(v: string | Record<string, string[]>): string {
  if (typeof v === 'string') return v;
  return Object.entries(v)
    .map(([feature, allow]) => `${feature}=(${allow.join(' ')})`)
    .join(', ');
}

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  camera: [],
  microphone: [],
  geolocation: [],
};

/** Build a secure-by-default set of HTTP security headers. */
export function securityHeaders(opts: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  const hsts = buildHsts(opts.hsts ?? true);
  if (hsts) headers['strict-transport-security'] = hsts;

  if (opts.noSniff ?? true) headers['x-content-type-options'] = 'nosniff';

  const frame = opts.frameOptions ?? 'DENY';
  if (frame) headers['x-frame-options'] = frame;

  const referrer = opts.referrerPolicy ?? 'strict-origin-when-cross-origin';
  if (referrer) headers['referrer-policy'] = referrer;

  const perms = opts.permissionsPolicy ?? DEFAULT_PERMISSIONS;
  if (perms) headers['permissions-policy'] = buildPermissionsPolicy(perms);

  const coop = opts.coop ?? 'same-origin';
  if (coop) headers['cross-origin-opener-policy'] = coop;

  if (opts.coep) headers['cross-origin-embedder-policy'] = opts.coep;

  const corp = opts.corp ?? 'cross-origin';
  if (corp) headers['cross-origin-resource-policy'] = corp;

  return headers;
}
