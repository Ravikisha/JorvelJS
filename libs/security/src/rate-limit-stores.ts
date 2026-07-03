/**
 * Distributed rate-limit store adapters.
 *
 * The default `BoundedMapStore` (rate-limit.ts) is in-memory and per-isolate.
 * On Vercel / Cloudflare / Lambda that means the bucket resets every time the
 * runtime cold-boots — effectively useless for tight per-IP limits.
 *
 * These adapters wrap an external KV-like service. They are deliberately
 * narrowed to the methods the limiter needs (`get` / `set`) so consumers can
 * adapt any backing store (Cloudflare KV, Durable Objects, Vercel KV / Upstash
 * Redis, ioredis, AWS DynamoDB, etc.).
 *
 * Note: the existing synchronous `RateLimitStore` cannot block on the network.
 * `AsyncRateLimitStore` is the new contract for distributed adapters; the
 * `RateLimiter` class still uses the sync store. Callers using a distributed
 * adapter should consult `consumeAsync()` (see below).
 */
import type { BucketState } from './rate-limit.js';

export interface AsyncRateLimitStore {
  get(key: string): Promise<BucketState | undefined>;
  set(key: string, value: BucketState, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare Workers KV adapter. Pass the binding (e.g. `env.RATE_LIMIT_KV`).
 * Bucket entries are stored as JSON; KV's expirationTtl handles eviction.
 */
export interface CloudflareKVNamespace {
  get(key: string, type?: 'text' | 'json'): Promise<string | null | Record<string, unknown>>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export function cloudflareKVStore(
  ns: CloudflareKVNamespace,
  opts: { prefix?: string } = {},
): AsyncRateLimitStore {
  const prefix = opts.prefix ?? 'rl:';
  return {
    async get(key) {
      const raw = await ns.get(prefix + key, 'text');
      if (!raw || typeof raw !== 'string') return undefined;
      try {
        return JSON.parse(raw) as BucketState;
      } catch {
        return undefined;
      }
    },
    async set(key, value, ttlSeconds) {
      await ns.put(prefix + key, JSON.stringify(value), {
        ...(ttlSeconds && ttlSeconds >= 60 ? { expirationTtl: ttlSeconds } : {}),
      });
    },
    async delete(key) {
      await ns.delete(prefix + key);
    },
  };
}

/**
 * Cloudflare Durable Objects adapter. Provide a function that returns the
 * DO storage interface for a given namespace; the limiter scopes by key.
 */
export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export function durableObjectStore(
  storage: DurableObjectStorage,
  opts: { prefix?: string } = {},
): AsyncRateLimitStore {
  const prefix = opts.prefix ?? 'rl:';
  return {
    async get(key) {
      const v = await storage.get<BucketState>(prefix + key);
      return v ?? undefined;
    },
    async set(key, value) {
      await storage.put(prefix + key, value);
    },
    async delete(key) {
      await storage.delete(prefix + key);
    },
  };
}

/**
 * Redis-like adapter — any client with GET/SETEX/DEL semantics. Compatible
 * with ioredis, @upstash/redis, node-redis (lower-cased command shape).
 */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export function redisStore(
  client: RedisLikeClient,
  opts: { prefix?: string } = {},
): AsyncRateLimitStore {
  const prefix = opts.prefix ?? 'rl:';
  return {
    async get(key) {
      const raw = await client.get(prefix + key);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as BucketState;
      } catch {
        return undefined;
      }
    },
    async set(key, value, ttlSeconds) {
      const v = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        // EX = seconds TTL — supported by all three clients above.
        await client.set(prefix + key, v, 'EX', ttlSeconds);
      } else {
        await client.set(prefix + key, v);
      }
    },
    async delete(key) {
      await client.del(prefix + key);
    },
  };
}

/**
 * Async token-bucket consumer. The signature mirrors `RateLimiter.consume`
 * but awaits a network round-trip to the backing store. Use this from edge
 * adapters before render to apply distributed limits.
 */
export interface AsyncRateLimitOptions {
  capacity: number;
  refillPerSec: number;
  /** TTL hint to the store (seconds). Default `Math.ceil(capacity / refillPerSec) + 60`. */
  ttlSeconds?: number;
  now?: () => number;
}

export interface AsyncRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  capacity: number;
}

export async function consumeAsync(
  store: AsyncRateLimitStore,
  key: string,
  opts: AsyncRateLimitOptions,
): Promise<AsyncRateLimitResult> {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlSeconds ?? Math.ceil(opts.capacity / opts.refillPerSec) + 60;
  const ts = now();
  const prev = await store.get(key);
  let tokens = opts.capacity;
  if (prev) {
    const elapsedSec = (ts - prev.updatedAt) / 1000;
    tokens = Math.min(opts.capacity, prev.tokens + elapsedSec * opts.refillPerSec);
  }
  if (tokens >= 1) {
    tokens -= 1;
    await store.set(key, { tokens, updatedAt: ts }, ttl);
    return {
      allowed: true,
      remaining: Math.floor(tokens),
      retryAfterMs: 0,
      capacity: opts.capacity,
    };
  }
  await store.set(key, { tokens, updatedAt: ts }, ttl);
  const deficit = 1 - tokens;
  const retryAfterMs = Math.ceil((deficit / opts.refillPerSec) * 1000);
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
    capacity: opts.capacity,
  };
}
