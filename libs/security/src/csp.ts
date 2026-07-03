import { base64FromBytes } from './base64.js';

export type CspDirective =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'font-src'
  | 'connect-src'
  | 'media-src'
  | 'object-src'
  | 'frame-src'
  | 'worker-src'
  | 'manifest-src'
  | 'base-uri'
  | 'form-action'
  | 'frame-ancestors'
  | 'report-uri'
  | 'report-to'
  | 'upgrade-insecure-requests';

export type CspPolicy = Partial<Record<CspDirective, string[] | true>>;

export interface CspOptions {
  /** Adds every remote origin to `script-src` and `connect-src` automatically. */
  remotes?: string[];
  /** Include `'unsafe-inline'` for dev bootstraps. Never set true in prod. */
  allowInlineScripts?: boolean;
  /** Include `'unsafe-eval'` — required by some HMR stacks. Never in prod. */
  allowEval?: boolean;
  /** Per-request nonce (base64url). Included as `'nonce-<value>'` in `script-src`/`style-src`. */
  nonce?: string;
  /**
   * Add `'strict-dynamic'` to script-src when a nonce is provided. Recommended
   * for module-federation hosts so chunks loaded by a nonced script are also
   * trusted. Default: true when `nonce` is set.
   */
  strictDynamic?: boolean;
  /** Report endpoint (deprecated `report-uri`). */
  reportUri?: string;
  /** Report endpoint (preferred `report-to` group name). */
  reportTo?: string;
  /**
   * If true, the baseline drops `'unsafe-inline'` from `style-src`. Default false
   * to preserve existing behavior; set true for stricter policies.
   */
  strictStyles?: boolean;
}

const NONCE_RE = /^[A-Za-z0-9+/=_-]+$/;

const BASELINE: CspPolicy = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  // Default to self + data: only. A blanket `https:` lets ANY https origin be an
  // image source — a trivial pixel-beacon exfil channel under an otherwise
  // strict policy. Opt origins in explicitly via the `remotes`/policy options.
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
};

function deepClone(policy: CspPolicy): CspPolicy {
  const out: CspPolicy = {};
  for (const [k, v] of Object.entries(policy) as [CspDirective, string[] | true | undefined][]) {
    if (v === true) out[k] = true;
    else if (Array.isArray(v)) out[k] = v.slice();
  }
  return out;
}

export function buildCsp(policy: CspPolicy = {}, opts: CspOptions = {}): string {
  if (opts.nonce !== undefined && !NONCE_RE.test(opts.nonce)) {
    throw new Error(`[jorvel/security] Invalid nonce; must match /${NONCE_RE.source}/`);
  }
  if (opts.reportUri !== undefined && /[\s;]/.test(opts.reportUri)) {
    throw new Error('[jorvel/security] reportUri must not contain whitespace or `;`.');
  }

  const merged = deepClone(BASELINE);

  if (opts.strictStyles) {
    merged['style-src'] = ["'self'"];
  }

  for (const [k, v] of Object.entries(policy) as [CspDirective, string[] | true | undefined][]) {
    if (v === undefined) continue;
    merged[k] = Array.isArray(v) ? v.slice() : v;
  }

  const remoteOrigins = (opts.remotes ?? []).map(toOrigin).filter(Boolean) as string[];
  if (remoteOrigins.length) {
    pushUnique(merged, 'script-src', remoteOrigins);
    pushUnique(merged, 'connect-src', remoteOrigins);
  }

  if (opts.nonce) {
    const token = `'nonce-${opts.nonce}'`;
    pushUnique(merged, 'script-src', [token]);
    pushUnique(merged, 'style-src', [token]);
    if (opts.strictDynamic !== false) {
      pushUnique(merged, 'script-src', ["'strict-dynamic'"]);
    }
  }

  if (opts.allowInlineScripts) pushUnique(merged, 'script-src', ["'unsafe-inline'"]);
  if (opts.allowEval) pushUnique(merged, 'script-src', ["'unsafe-eval'"]);

  if (opts.reportUri) merged['report-uri'] = [opts.reportUri];
  if (opts.reportTo) merged['report-to'] = [opts.reportTo];

  return serialize(merged);
}

/**
 * Directives the browser ignores when CSP is delivered via <meta>. They only
 * apply via the `Content-Security-Policy` HTTP header. Strip them from the
 * meta-tag output so we don't ship dead policy fragments.
 *
 * Per the CSP spec, `frame-ancestors`, `report-uri`, `report-to`, and `sandbox`
 * are meta-ineligible. `sandbox` is not in our `CspDirective` union, so we
 * only need to filter the three that are.
 */
const META_INELIGIBLE: readonly CspDirective[] = [
  'frame-ancestors',
  'report-uri',
  'report-to',
];

export function cspMeta(policy: CspPolicy = {}, opts: CspOptions = {}): string {
  // Strip directives the spec excludes from meta-delivery.
  const filtered: CspPolicy = { ...policy };
  for (const k of META_INELIGIBLE) {
    delete filtered[k];
  }
  // Drop opts that produce ineligible directives (reportUri/reportTo).
  const filteredOpts: CspOptions = { ...opts };
  delete filteredOpts.reportUri;
  delete filteredOpts.reportTo;
  return `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(buildCsp(filtered, filteredOpts))}">`;
}

function pushUnique(p: CspPolicy, key: CspDirective, values: string[]): void {
  const list = Array.isArray(p[key]) ? (p[key] as string[]) : [];
  for (const v of values) if (!list.includes(v)) list.push(v);
  p[key] = list;
}

function serialize(p: CspPolicy): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p) as [CspDirective, string[] | true | undefined][]) {
    if (v === undefined) continue;
    if (v === true) parts.push(k);
    else if (v.length) parts.push(`${k} ${v.join(' ')}`);
  }
  return parts.join('; ');
}

function toOrigin(url: string): string | undefined {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return undefined;
  }
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


/**
 * Edge-runtime-safe nonce generator.
 *
 * Requires Web Crypto (`crypto.getRandomValues`), which exists on every runtime
 * JORVEL targets: Workers, Vercel Edge, Deno, browsers, and Node >=19. A CSP
 * nonce MUST be cryptographically unpredictable, so we throw rather than
 * silently degrade to `Math.random()` — a predictable nonce defeats the policy
 * entirely (an attacker can guess it and inline arbitrary scripts).
 *
 * The output uses the standard base64 alphabet, which is valid for a CSP nonce.
 */
export function generateNonce(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (!g.crypto?.getRandomValues) {
    throw new Error(
      'generateNonce requires crypto.getRandomValues (Web Crypto). A predictable ' +
        'nonce would defeat the CSP — refusing to fall back to Math.random().',
    );
  }
  g.crypto.getRandomValues(arr);
  return base64FromBytes(arr);
}
