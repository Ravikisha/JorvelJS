/**
 * In-memory token-bucket rate limiter.
 *
 * One bucket per key (client IP, API key, user id). Each `consume(key)` call
 * refills the bucket according to elapsed time and deducts one token; if no
 * token is available the call returns `{ ok: false, retryAfterMs }`.
 *
 * The default store is an in-process `Map` with insertion-order eviction. For
 * multi-instance deployments pass `store: redisStore(client)`.
 */

export interface RateLimitOptions {
  /** Maximum tokens in the bucket. Default: 10. */
  capacity?: number;
  /** Tokens refilled per second. Default: 5. */
  refillPerSec?: number;
  /** Maximum tracked keys (in-memory store only). Default: 10000. */
  maxKeys?: number;
  /** Pluggable storage. Default: in-memory `Map`. */
  store?: RateLimitStore;
  /** Time source for tests. Default: `Date.now`. */
  now?: () => number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Remaining tokens immediately after this call (0 when `ok` is false). */
  remaining: number;
  /** Capacity for the bucket — useful for `X-RateLimit-Limit` headers. */
  limit: number;
  /** Milliseconds the caller should wait before retrying. 0 when `ok`. */
  retryAfterMs: number;
}

export interface BucketState {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitStore {
  get(key: string): BucketState | undefined;
  set(key: string, value: BucketState): void;
  delete(key: string): void;
}

class BoundedMapStore implements RateLimitStore {
  private readonly map = new Map<string, BucketState>();
  constructor(private readonly max: number) {}
  get(key: string): BucketState | undefined {
    const v = this.map.get(key);
    if (!v) return undefined;
    // Touch for LRU.
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key: string, value: BucketState): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

export class RateLimiter {
  readonly capacity: number;
  readonly refillPerSec: number;
  private readonly store: RateLimitStore;
  private readonly now: () => number;

  constructor(opts: RateLimitOptions = {}) {
    this.capacity = Math.max(1, opts.capacity ?? 10);
    this.refillPerSec = Math.max(0, opts.refillPerSec ?? 5);
    this.store = opts.store ?? new BoundedMapStore(opts.maxKeys ?? 10_000);
    this.now = opts.now ?? Date.now;
  }

  /** Consume one token. Returns `ok:false` with `retryAfterMs` when starved. */
  consume(key: string): RateLimitResult {
    return this.consumeN(key, 1);
  }

  /** Consume `n` tokens at once (e.g. weighted ops). */
  consumeN(key: string, n: number): RateLimitResult {
    if (n <= 0) throw new Error('[jorvel/security] consumeN requires n >= 1');
    const now = this.now();
    const prev = this.store.get(key);
    let tokens = prev ? prev.tokens : this.capacity;
    if (prev && this.refillPerSec > 0) {
      const elapsedSec = Math.max(0, (now - prev.updatedAt) / 1000);
      tokens = Math.min(this.capacity, tokens + elapsedSec * this.refillPerSec);
    }

    if (tokens >= n) {
      tokens -= n;
      this.store.set(key, { tokens, updatedAt: now });
      return {
        ok: true,
        remaining: Math.floor(tokens),
        limit: this.capacity,
        retryAfterMs: 0,
      };
    }

    const missing = n - tokens;
    const retryAfterMs =
      this.refillPerSec > 0 ? Math.ceil((missing / this.refillPerSec) * 1000) : Number.POSITIVE_INFINITY;
    // Still persist the refill so subsequent calls see the updated clock.
    this.store.set(key, { tokens, updatedAt: now });
    return {
      ok: false,
      remaining: 0,
      limit: this.capacity,
      retryAfterMs,
    };
  }

  /** Reset a single key (admin override). */
  reset(key: string): void {
    this.store.delete(key);
  }
}

// ── Adapter: edge-style request → rate-limit headers ──────────────────────

export interface EdgeLikeRequest {
  url: string;
  headers?: Record<string, string>;
}

export interface EdgeLikeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface RateLimitMiddlewareOptions extends RateLimitOptions {
  /** Build the bucket key from a request. Default: `x-forwarded-for` then `'global'`. */
  keyFor?: (req: EdgeLikeRequest) => string;
  /** Rejection status code. Default: 429. */
  status?: number;
  /** Body for rejected requests. Default: `'Too Many Requests'`. */
  body?: string | ((retryAfterSec: number) => string);
}

/**
 * Builds an edge-style guard: returns `null` when the request is allowed (with
 * `X-RateLimit-*` headers attached), or an `EdgeLikeResponse` (429) when the
 * bucket is empty. Drop into `createEdgeAdapter` as a custom pre-route filter.
 */
export function createRateLimitGuard(opts: RateLimitMiddlewareOptions = {}) {
  const limiter = new RateLimiter(opts);
  // Default key = the FIRST hop of x-forwarded-for (the client the nearest
  // trusted proxy saw), not the whole comma-list — using the full chain gives
  // every distinct proxy path its own bucket, and a client can append fake hops.
  // NOTE: x-forwarded-for is client-spoofable unless you sit behind a trusted
  // proxy that overwrites it. For untrusted ingress, pass `keyFor` using a
  // platform-provided client IP (e.g. cf-connecting-ip).
  const keyFor =
    opts.keyFor ??
    ((req) => {
      const xff = req.headers?.['x-forwarded-for'];
      if (!xff) return 'global';
      const first = xff.split(',')[0]?.trim();
      return first || 'global';
    });
  const status = opts.status ?? 429;
  const bodyOpt = opts.body ?? 'Too Many Requests';

  function rateHeaders(r: RateLimitResult): Record<string, string> {
    const h: Record<string, string> = {
      'x-ratelimit-limit': String(r.limit),
      'x-ratelimit-remaining': String(r.remaining),
    };
    if (!r.ok) h['retry-after'] = String(Math.max(1, Math.ceil(r.retryAfterMs / 1000)));
    return h;
  }

  return function check(req: EdgeLikeRequest): {
    allowed: boolean;
    headers: Record<string, string>;
    response?: EdgeLikeResponse;
  } {
    const key = keyFor(req);
    const r = limiter.consume(key);
    const headers = rateHeaders(r);
    if (r.ok) return { allowed: true, headers };

    const retryAfterSec = Math.max(1, Math.ceil(r.retryAfterMs / 1000));
    const body = typeof bodyOpt === 'function' ? bodyOpt(retryAfterSec) : bodyOpt;
    return {
      allowed: false,
      headers,
      response: {
        status,
        headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
        body,
      },
    };
  };
}
