/**
 * @jorvel/state — RSC-compatible / SSR-transferable store.
 *
 * A store you can populate on the server (in a loader / RSC / edge handler),
 * `dehydrate()` into a plain serializable snapshot, embed in the HTML, and
 * `hydrate()` on the client so the first client render matches the server —
 * no refetch, no flash.
 *
 * The server side is read-mostly and hook-free (safe in RSC); the client gets
 * subscribe/set. Per-request isolation: create one store per request on the
 * server (do NOT share a module singleton across concurrent renders).
 */

export type Unsubscribe = () => void;

export interface ServerStore<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: (value: T) => void): Unsubscribe;
  /** Plain snapshot for embedding in HTML (must be JSON-serializable). */
  dehydrate(): T;
  /** Replace state from a snapshot (client boot). Notifies subscribers. */
  hydrate(snapshot: T): void;
}

export function createServerStore<T>(initial: T): ServerStore<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();
  const notify = () => { for (const l of [...listeners]) l(value); };
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dehydrate: () => value,
    hydrate(snapshot) { value = snapshot; notify(); },
  };
}

// ── Dehydration registry (collect many stores into one payload) ──────────────

export interface DehydratedState {
  [key: string]: unknown;
}

/**
 * Collect keyed stores into one snapshot object for embedding, e.g.
 * `<script>window.__JORVEL_STATE__ = {...}</script>`.
 */
export function dehydrateAll(stores: Record<string, { dehydrate(): unknown }>): DehydratedState {
  const out: DehydratedState = {};
  for (const [key, store] of Object.entries(stores)) out[key] = store.dehydrate();
  return out;
}

/** Serialize a dehydrated payload safely for inline `<script>` embedding. */
export function serializeState(state: DehydratedState): string {
  // Escape `<` so `</script>` in string data can't break out of the tag.
  return JSON.stringify(state).replace(/</g, '\\u003c');
}

const HYDRATION_KEY = '__JORVEL_STATE__';

/** Read the embedded snapshot for `key` on the client (or undefined on the server). */
export function readHydratedState<T>(key: string): T | undefined {
  const g = globalThis as Record<string, unknown>;
  const bag = g[HYDRATION_KEY] as DehydratedState | undefined;
  return bag ? (bag[key] as T | undefined) : undefined;
}

/**
 * Create a store seeded from the embedded server snapshot when present, else
 * from `fallback`. Use this on the client to avoid a first-render mismatch.
 */
export function createHydratedStore<T>(key: string, fallback: T): ServerStore<T> {
  const seed = readHydratedState<T>(key);
  return createServerStore<T>(seed === undefined ? fallback : seed);
}
