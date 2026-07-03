export interface CacheControlOptions {
  /** Public vs private caches. */
  scope?: 'public' | 'private';
  /** max-age (seconds). */
  maxAge?: number;
  /** s-maxage (seconds) — shared (CDN) cache. */
  sMaxAge?: number;
  /** stale-while-revalidate (seconds). Requires `maxAge` or `sMaxAge`. */
  staleWhileRevalidate?: number;
  /** stale-if-error (seconds). */
  staleIfError?: number;
  /** no-store short-circuits. */
  noStore?: boolean;
  /** no-cache short-circuits. */
  noCache?: boolean;
  /** immutable (fingerprinted assets). */
  immutable?: boolean;
  mustRevalidate?: boolean;
}

export function cacheControl(opts: CacheControlOptions): string {
  if (opts.noStore) return 'no-store';
  if (
    opts.staleWhileRevalidate !== undefined &&
    opts.maxAge === undefined &&
    opts.sMaxAge === undefined
  ) {
    throw new Error(
      'cacheControl: stale-while-revalidate requires max-age or s-maxage to define freshness.',
    );
  }
  const parts: string[] = [];
  parts.push(opts.scope ?? 'public');
  if (opts.noCache) {
    parts.push('no-cache');
    // no-cache forces revalidation; emitting max-age is misleading — drop it.
  } else {
    if (opts.maxAge !== undefined) parts.push(`max-age=${opts.maxAge}`);
    if (opts.sMaxAge !== undefined) parts.push(`s-maxage=${opts.sMaxAge}`);
  }
  if (opts.staleWhileRevalidate !== undefined)
    parts.push(`stale-while-revalidate=${opts.staleWhileRevalidate}`);
  if (opts.staleIfError !== undefined) parts.push(`stale-if-error=${opts.staleIfError}`);
  if (opts.immutable) parts.push('immutable');
  if (opts.mustRevalidate) parts.push('must-revalidate');
  return parts.join(', ');
}

/**
 * Compute a weak ETag using FNV-1a 64-bit (much lower collision risk than DJB2).
 * Returned as `W/"<hex>-<len>"`.
 */
export function buildWeakEtag(body: string): string {
  // FNV-1a 64-bit over two 32-bit halves (avoids BigInt in this hot path).
  //
  // The prime 0x100000001B3 splits across 32-bit words as high=0x100, low=0x1B3.
  // So {hi,lo} * prime (mod 2^64) is:
  //   lo' = (lo * 0x1B3) mod 2^32
  //   hi' = (hi * 0x1B3 + lo * 0x100 + carry(lo * 0x1B3)) mod 2^32
  // The previous implementation computed the carry from an already-32-bit-
  // truncated product (always 0) and dropped the `lo * 0x100` term entirely,
  // leaving two weakly-coupled 32-bit streams → far higher collision odds and
  // false 304s. lo * 0x1B3 ≤ 2^32·435 < 2^53, so these products are exact in a
  // double.
  let hi = 0xcbf2_9ce4 >>> 0;
  let lo = 0x8422_2325 >>> 0;
  const mulPrime = () => {
    const oldLo = lo;
    const loProd = oldLo * 0x1b3;
    const carry = Math.floor(loProd / 0x1_0000_0000);
    lo = loProd >>> 0;
    hi = (hi * 0x1b3 + oldLo * 0x100 + carry) >>> 0;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    lo = (lo ^ (c & 0xff)) >>> 0;
    mulPrime();
    if (c > 0xff) {
      lo = (lo ^ ((c >>> 8) & 0xff)) >>> 0;
      mulPrime();
    }
  }
  const hex = hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
  return `W/"${hex}-${body.length}"`;
}

export function ifNoneMatchHit(etag: string, requestHeader?: string): boolean {
  if (!requestHeader) return false;
  return requestHeader.split(',').some((v) => v.trim() === etag);
}
