const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape text for safe insertion into HTML body or attribute. Does NOT escape
 * `/` — `/` is not unsafe in HTML and over-escaping breaks URL attributes.
 * Use `escapeHtml` for both attribute and text contexts; the only difference
 * is that attributes must already be quoted (we cover that via `"` and `'`).
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

const LS_CHAR = String.fromCharCode(0x2028);
const PS_CHAR = String.fromCharCode(0x2029);

export function safeJsonForScript(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch (err) {
    throw new Error(
      `[jorvel/security] safeJsonForScript: failed to serialize value (${
        err instanceof Error ? err.message : String(err)
      }). Avoid circular references in SSR state.`,
    );
  }
  if (json === undefined) return 'undefined';
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .split(LS_CHAR)
    .join('\\u2028')
    .split(PS_CHAR)
    .join('\\u2029');
}

const SAFE_PATHNAME = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%?#]*$/;

export function isSafePathname(p: string): boolean {
  if (!SAFE_PATHNAME.test(p)) return false;
  // Reject traversal in BOTH raw and (repeatedly) decoded forms — `%2e%2e` (and
  // double-encoded `%252e%252e`) decode to `..` and would otherwise slip past a
  // literal `!p.includes('..')` check.
  let cur = p;
  for (let i = 0; i < 3; i++) {
    if (cur.includes('..')) return false;
    let next: string;
    try {
      next = decodeURIComponent(cur);
    } catch {
      return false; // malformed escape — treat as unsafe
    }
    if (next === cur) break;
    cur = next;
  }
  return !cur.includes('..');
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Recursively strip prototype-pollution keys (`__proto__`, `prototype`,
 * `constructor`) from an arbitrary object. Returns a structurally cloned
 * sanitized copy — the input is never mutated. Non-plain values (Dates,
 * Maps, Sets, etc.) are returned by reference.
 */
export function pruneProtoKeys<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => pruneProtoKeys(v)) as unknown as T;
  }
  // Only plain objects need pruning.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = pruneProtoKeys((value as Record<string, unknown>)[k]);
  }
  return out as unknown as T;
}

/**
 * Object.assign that refuses to copy `__proto__`/`prototype`/`constructor`
 * from sources. Use when merging untrusted config into a target object.
 */
export function safeObjectAssign<T extends object>(
  target: T,
  ...sources: Array<Partial<T> | undefined | null>
): T {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of Object.keys(src)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      (target as Record<string, unknown>)[k] = (src as Record<string, unknown>)[k];
    }
  }
  return target;
}
