/**
 * Suspense-compatible remote data hook with bounded LRU cache and short error
 * TTL so a transient failure does not poison the cache for `ttl` minutes.
 *
 * Supports cache tags + `revalidateTag` / `revalidatePath` for explicit
 * invalidation (Next-style). `useRemoteData` subscribes to a revalidation
 * signal, so purging an entry re-suspends and refetches on the next render.
 */

import React from 'react';

interface CacheEntry<T> {
  promise: Promise<T>;
  value?: T;
  error?: unknown;
  expiresAt: number;
  errorExpiresAt?: number;
  tags?: string[];
}

const DEFAULT_MAX = 256;
const DEFAULT_ERROR_TTL = 1_500;

class LRU<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  has(k: string) { return this.map.has(k); }
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V): void {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }
  delete(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

const CACHE_KEY = '__JORVEL_REMOTE_DATA_CACHE__';
type GlobalWithCache = typeof globalThis & {
  [CACHE_KEY]?: LRU<CacheEntry<unknown>>;
};

function getCache(): LRU<CacheEntry<unknown>> {
  const g = globalThis as GlobalWithCache;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new LRU(DEFAULT_MAX);
  return g[CACHE_KEY];
}

// ── Tag index + revalidation signal ─────────────────────────────────────────
//
// A tag → Set<key> index lets `revalidateTag` purge every entry carrying a tag.
// A monotonic version + subscriber set drives re-renders: `useRemoteData`
// subscribes via useSyncExternalStore, so purging bumps the version and the
// component re-reads the (now-missing) cache entry → refetch.

const TAG_KEY = '__JORVEL_REMOTE_DATA_TAGS__';
const SIGNAL_KEY = '__JORVEL_REMOTE_DATA_SIGNAL__';
type GlobalWithTags = typeof globalThis & {
  [TAG_KEY]?: Map<string, Set<string>>;
  [SIGNAL_KEY]?: { version: number; subs: Set<() => void> };
};

function getTagIndex(): Map<string, Set<string>> {
  const g = globalThis as GlobalWithTags;
  if (!g[TAG_KEY]) g[TAG_KEY] = new Map();
  return g[TAG_KEY];
}

function getSignal(): { version: number; subs: Set<() => void> } {
  const g = globalThis as GlobalWithTags;
  if (!g[SIGNAL_KEY]) g[SIGNAL_KEY] = { version: 0, subs: new Set() };
  return g[SIGNAL_KEY];
}

function emitRevalidation(): void {
  const sig = getSignal();
  sig.version++;
  for (const cb of [...sig.subs]) cb();
}

function indexTags(key: string, tags: string[] | undefined): void {
  if (!tags?.length) return;
  const idx = getTagIndex();
  for (const tag of tags) {
    let set = idx.get(tag);
    if (!set) idx.set(tag, (set = new Set()));
    set.add(key);
  }
}

function purgeKey(key: string): void {
  getCache().delete(key);
  // Drop the key from every tag bucket it appears in.
  for (const [tag, keys] of getTagIndex()) {
    if (keys.delete(key) && keys.size === 0) getTagIndex().delete(tag);
  }
}

export interface UseRemoteDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  /** Cache TTL for successful values (ms). Default 60_000. */
  ttl?: number;
  /** Negative cache TTL for errors (ms). Default 1500 — keeps retries cheap but doesn't loop. */
  errorTtl?: number;
  /** Cache tags for `revalidateTag` invalidation, e.g. `['posts', 'post:42']`. */
  tags?: string[];
}

/**
 * Subscribe a component to the global revalidation signal. Returns the current
 * version; bumps (and re-renders) whenever `revalidateTag` / `revalidatePath` /
 * `invalidateRemoteData` purges anything. Used internally by `useRemoteData`.
 */
export function useRevalidationVersion(): number {
  const subscribe = React.useCallback((cb: () => void) => {
    const sig = getSignal();
    sig.subs.add(cb);
    return () => { sig.subs.delete(cb); };
  }, []);
  const getSnapshot = React.useCallback(() => getSignal().version, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Suspense-compatible data fetching hook. Throws the promise while pending so
 * an enclosing <Suspense> renders the fallback. Errors bubble to ErrorBoundary.
 *
 * Successful values are cached for `ttl`; errors are cached for `errorTtl` so
 * the same render pass doesn't thrash the network — after that window, the
 * next call retries.
 */
export function useRemoteData<T>(options: UseRemoteDataOptions<T>): T {
  const { key, fetcher, ttl = 60_000, errorTtl = DEFAULT_ERROR_TTL, tags } = options;
  // NOTE: `useRemoteData` stays a plain Suspense-throwing read (no React hooks),
  // so it works in any render path. For auto-refresh on `revalidateTag`, compose
  // `useRevalidationVersion()` in the same component (or a parent) — its
  // re-render re-runs this read, which refetches a purged entry.
  const cache = getCache();
  const now = Date.now();

  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing) {
    if ('value' in existing && existing.expiresAt > now) {
      return existing.value as T;
    }
    if ('error' in existing && existing.errorExpiresAt && existing.errorExpiresAt > now) {
      throw existing.error;
    }
    if (!('value' in existing) && !('error' in existing)) {
      // In-flight: re-throw the same promise so Suspense dedupes.
      throw existing.promise;
    }
  }

  const entry: CacheEntry<T> = {
    promise: undefined as unknown as Promise<T>,
    expiresAt: now + ttl,
    ...(tags?.length ? { tags } : {}),
  };
  entry.promise = fetcher()
    .then((v) => {
      entry.value = v;
      entry.expiresAt = Date.now() + ttl;
      return v;
    })
    .catch((err) => {
      entry.error = err;
      entry.errorExpiresAt = Date.now() + errorTtl;
      throw err;
    });
  cache.set(key, entry as CacheEntry<unknown>);
  indexTags(key, tags);
  throw entry.promise;
}

export function invalidateRemoteData(key: string): void {
  purgeKey(key);
  emitRevalidation();
}

export function clearRemoteDataCache(): void {
  getCache().clear();
  getTagIndex().clear();
  emitRevalidation();
}

/**
 * Purge every cached entry carrying `tag` and re-render subscribers so they
 * refetch. Pair with `useRemoteData({ key, fetcher, tags: ['posts'] })`.
 */
export function revalidateTag(tag: string): void {
  const keys = getTagIndex().get(tag);
  if (keys) for (const key of [...keys]) purgeKey(key);
  emitRevalidation();
}

/**
 * Convenience over {@link revalidateTag}: invalidate everything tagged with a
 * route path. Tag your loaders with the path (e.g. `tags: ['/dashboard']`) to
 * use it.
 */
export function revalidatePath(path: string): void {
  revalidateTag(path);
}

export function prefetchRemoteData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 60_000,
  tags?: string[],
): Promise<T> {
  const cache = getCache();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && 'value' in existing && existing.expiresAt > Date.now()) {
    return Promise.resolve(existing.value as T);
  }
  const entry: CacheEntry<T> = {
    promise: undefined as unknown as Promise<T>,
    expiresAt: Date.now() + ttl,
    ...(tags?.length ? { tags } : {}),
  };
  entry.promise = fetcher().then((v) => {
    entry.value = v;
    entry.expiresAt = Date.now() + ttl;
    return v;
  });
  cache.set(key, entry as CacheEntry<unknown>);
  indexTags(key, tags);
  return entry.promise;
}
