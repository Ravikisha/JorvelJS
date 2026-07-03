/**
 * @jorvel/runtime — a small TanStack-Query-style data layer.
 *
 * A `QueryClient` holds a keyed cache; `useQuery` reads it with
 * stale-while-revalidate semantics (return cached data instantly, refetch in the
 * background when stale); `useMutation` runs writes and can invalidate queries.
 *
 * Deliberately tiny — no infinite queries, no suspense mode — but real: dedupes
 * in-flight fetches, tracks fetching/stale state, supports optimistic
 * `setQueryData`, and cross-component cache sharing via `useSyncExternalStore`.
 * MF-singleton-safe: the default client is pinned to `globalThis`.
 */

import React from 'react';

export type QueryKey = readonly unknown[];
export type QueryStatus = 'pending' | 'success' | 'error';

interface QueryEntry<T = unknown> {
  data?: T;
  error?: unknown;
  status: QueryStatus;
  updatedAt: number;
  /** In-flight fetch promise (for dedupe). */
  promise?: Promise<T>;
  listeners: Set<() => void>;
  /** True while a (re)fetch is running, independent of whether data exists. */
  fetching: boolean;
  /** Bumped on every change so `useSyncExternalStore` sees a new snapshot. */
  version: number;
}

export interface QueryClientOptions {
  /** Default staleness window (ms). Cached data older than this refetches on use. Default 0. */
  staleTime?: number;
  /** Testable clock. */
  now?: () => number;
}

function hashKey(key: QueryKey): string {
  return JSON.stringify(key);
}

export class QueryClient {
  private cache = new Map<string, QueryEntry>();
  private readonly staleTime: number;
  private readonly now: () => number;

  constructor(opts: QueryClientOptions = {}) {
    this.staleTime = opts.staleTime ?? 0;
    this.now = opts.now ?? (() => Date.now());
  }

  private entry(hash: string): QueryEntry {
    let e = this.cache.get(hash);
    if (!e) {
      e = { status: 'pending', updatedAt: 0, listeners: new Set(), fetching: false, version: 0 };
      this.cache.set(hash, e);
    }
    return e;
  }

  private emit(e: QueryEntry): void {
    e.version++;
    for (const l of [...e.listeners]) l();
  }

  subscribe(key: QueryKey, cb: () => void): () => void {
    const e = this.entry(hashKey(key));
    e.listeners.add(cb);
    return () => { e.listeners.delete(cb); };
  }

  getEntry<T>(key: QueryKey): Readonly<QueryEntry<T>> {
    return this.entry(hashKey(key)) as QueryEntry<T>;
  }

  isStale(key: QueryKey, staleTime = this.staleTime): boolean {
    const e = this.cache.get(hashKey(key));
    if (!e || e.status !== 'success') return true;
    return this.now() - e.updatedAt >= staleTime;
  }

  /** Imperatively seed/replace a query's data (optimistic updates, SSR hydration). */
  setQueryData<T>(key: QueryKey, updater: T | ((prev: T | undefined) => T)): void {
    const e = this.entry(hashKey(key)) as QueryEntry<T>;
    const next = typeof updater === 'function'
      ? (updater as (p: T | undefined) => T)(e.data)
      : updater;
    e.data = next;
    e.status = 'success';
    e.error = undefined;
    e.updatedAt = this.now();
    this.emit(e);
  }

  /**
   * Fetch (or dedupe onto an in-flight fetch). Resolves with the data; updates
   * the cache + notifies subscribers. `force` bypasses the in-flight dedupe only
   * when nothing is running.
   */
  fetchQuery<T>(key: QueryKey, queryFn: () => Promise<T>): Promise<T> {
    const e = this.entry(hashKey(key)) as QueryEntry<T>;
    if (e.promise) return e.promise;
    e.fetching = true;
    this.emit(e); // notify fetching=true
    const p = Promise.resolve()
      .then(queryFn)
      .then((data) => {
        e.data = data;
        e.status = 'success';
        e.error = undefined;
        e.updatedAt = this.now();
        return data;
      })
      .catch((err) => {
        e.error = err;
        e.status = 'error';
        throw err;
      })
      .finally(() => {
        e.fetching = false;
        delete e.promise;
        this.emit(e);
      });
    e.promise = p;
    return p;
  }

  /** Invalidate matching queries. String/array = exact-prefix; fn = predicate. */
  invalidate(matcher: QueryKey | ((key: unknown[]) => boolean)): void {
    for (const [hash, e] of this.cache) {
      const parsed = JSON.parse(hash) as unknown[];
      const hit = typeof matcher === 'function'
        ? matcher(parsed)
        : matchesPrefix(parsed, matcher as unknown[]);
      if (hit) {
        e.updatedAt = 0; // mark stale
        this.emit(e);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

function matchesPrefix(key: unknown[], prefix: unknown[]): boolean {
  if (prefix.length > key.length) return false;
  return prefix.every((p, i) => JSON.stringify(p) === JSON.stringify(key[i]));
}

// ── Default client (globalThis-pinned) + provider ──────────────────────────

const CLIENT_KEY = '__JORVEL_QUERY_CLIENT__';
type GlobalWithClient = typeof globalThis & { [CLIENT_KEY]?: QueryClient };

export function getDefaultQueryClient(): QueryClient {
  const g = globalThis as GlobalWithClient;
  if (!g[CLIENT_KEY]) g[CLIENT_KEY] = new QueryClient();
  return g[CLIENT_KEY];
}

const QueryClientContext = React.createContext<QueryClient | null>(null);

export function QueryClientProvider({
  client,
  children,
}: {
  client?: QueryClient;
  children: React.ReactNode;
}) {
  const value = client ?? getDefaultQueryClient();
  return <QueryClientContext.Provider value={value}>{children}</QueryClientContext.Provider>;
}

export function useQueryClient(): QueryClient {
  return React.useContext(QueryClientContext) ?? getDefaultQueryClient();
}

// ── useQuery ────────────────────────────────────────────────────────────────

export interface UseQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  /** Staleness window (ms). Cached data older than this refetches on mount/use. */
  staleTime?: number;
  /** Skip fetching until true. Default true. */
  enabled?: boolean;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  /** True on the first load with no cached data. */
  isLoading: boolean;
  /** True whenever a fetch is in flight (incl. background revalidation). */
  isFetching: boolean;
  isStale: boolean;
  refetch: () => Promise<T | undefined>;
}

export function useQuery<T>(options: UseQueryOptions<T>): UseQueryResult<T> {
  const { queryKey, queryFn, staleTime, enabled = true } = options;
  const client = useQueryClient();
  const hash = hashKey(queryKey);

  const queryFnRef = React.useRef(queryFn);
  React.useEffect(() => { queryFnRef.current = queryFn; }, [queryFn]);

  const subscribe = React.useCallback(
    (cb: () => void) => client.subscribe(queryKey, cb),
    // hash captures queryKey identity without depending on a fresh array each render
    [client, hash], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Snapshot must change identity when the entry changes — track its version int.
  const getVersion = React.useCallback(() => client.getEntry<T>(queryKey).version, [client, hash]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useSyncExternalStore(subscribe, getVersion, getVersion);
  const entry = client.getEntry<T>(queryKey);

  const refetch = React.useCallback(
    () => client.fetchQuery<T>(queryKey, () => queryFnRef.current()),
    [client, hash], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Fetch on mount / key change when enabled and data is missing or stale.
  React.useEffect(() => {
    if (!enabled) return;
    if (entry.status !== 'success' || client.isStale(queryKey, staleTime)) {
      void refetch().catch(() => { /* surfaced via entry.error */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hash, staleTime]);

  return {
    data: entry.data,
    error: entry.error,
    status: entry.status,
    isLoading: entry.status === 'pending' && entry.data === undefined,
    isFetching: entry.fetching,
    isStale: client.isStale(queryKey, staleTime),
    refetch,
  };
}

// ── useMutation ────────────────────────────────────────────────────────────

export interface UseMutationOptions<Input, Output> {
  mutationFn: (input: Input) => Promise<Output>;
  onSuccess?: (data: Output, input: Input) => void | Promise<void>;
  onError?: (error: unknown, input: Input) => void;
}

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseMutationResult<Input, Output> {
  mutate: (input: Input) => void;
  mutateAsync: (input: Input) => Promise<Output>;
  data: Output | undefined;
  error: unknown;
  status: MutationStatus;
  isPending: boolean;
  reset: () => void;
}

export function useMutation<Input, Output>(
  options: UseMutationOptions<Input, Output>,
): UseMutationResult<Input, Output> {
  const [state, setState] = React.useState<{ status: MutationStatus; data?: Output; error?: unknown }>({
    status: 'idle',
  });
  const optsRef = React.useRef(options);
  React.useEffect(() => { optsRef.current = options; }, [options]);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const mutateAsync = React.useCallback(async (input: Input): Promise<Output> => {
    if (mounted.current) setState({ status: 'pending' });
    try {
      const data = await optsRef.current.mutationFn(input);
      await optsRef.current.onSuccess?.(data, input);
      if (mounted.current) setState({ status: 'success', data });
      return data;
    } catch (error) {
      optsRef.current.onError?.(error, input);
      if (mounted.current) setState({ status: 'error', error });
      throw error;
    }
  }, []);

  const mutate = React.useCallback((input: Input) => {
    void mutateAsync(input).catch(() => { /* captured in state.error */ });
  }, [mutateAsync]);

  const reset = React.useCallback(() => {
    if (mounted.current) setState({ status: 'idle' });
  }, []);

  return {
    mutate,
    mutateAsync,
    data: state.data,
    error: state.error,
    status: state.status,
    isPending: state.status === 'pending',
    reset,
  };
}
