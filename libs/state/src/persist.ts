/**
 * @jorvel/state/persist
 *
 * Persistence middleware for `Store` and `SimpleStore`. Reads the saved value
 * on attach (synchronously when storage is sync) and writes back on every
 * change, optionally debounced.
 */

import type { SimpleStore, Store } from './index.js';

export interface PersistStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface PersistOptions<T> {
  /** Storage key. */
  key: string;
  /** Storage implementation. Defaults to `globalThis.localStorage` when present. */
  storage?: PersistStorage;
  /** Custom serializer (default JSON.stringify). */
  serialize?: (value: T) => string;
  /** Custom deserializer (default JSON.parse). */
  deserialize?: (raw: string) => T;
  /** Debounce write interval in ms. Default 100. */
  debounceMs?: number;
  /**
   * Optional schema version. When `migrate` is provided, persisted values from
   * lower versions are passed through it before being applied.
   */
  version?: number;
  migrate?: (raw: unknown, fromVersion: number) => T;
  /** Called when read or write errors occur. Default: console.warn. */
  onError?: (err: unknown, phase: 'read' | 'write') => void;
}

/**
 * On-disk envelope. `state` is the value run through the (possibly custom)
 * serializer — a STRING, not the raw value — so non-JSON serializers
 * (superjson, Map/Date codecs) round-trip correctly. The envelope itself is
 * always plain JSON so the version can be read without invoking deserialize.
 */
interface Envelope {
  v: number;
  state: string;
}

function isEnvelope(v: unknown): v is Envelope {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as { v?: unknown }).v === 'number' &&
    typeof (v as { state?: unknown }).state === 'string'
  );
}

function getDefaultStorage(): PersistStorage | undefined {
  const g = globalThis as { localStorage?: PersistStorage };
  return typeof g.localStorage !== 'undefined' ? g.localStorage : undefined;
}

function noop(): void {}

function defaultOnError(err: unknown, phase: 'read' | 'write'): void {
  // eslint-disable-next-line no-console
  console.warn(`[jorvel/state/persist] ${phase} failed:`, err);
}

interface Persistable<T> {
  read(): T;
  apply(value: T): void;
  subscribe(cb: () => void): () => void;
}

function attach<T>(p: Persistable<T>, opts: PersistOptions<T>): () => void {
  const storage = opts.storage ?? getDefaultStorage();
  if (!storage) return noop;
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = opts.deserialize ?? ((raw: string) => JSON.parse(raw) as T);
  const onError = opts.onError ?? defaultOnError;
  const debounceMs = opts.debounceMs ?? 100;
  const version = opts.version ?? 0;

  // ── Write on change ───────────────────────────────────────────────────────
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Suppresses the write that the store's own hydration (p.apply) would
  // otherwise trigger, and lets the async read detect a genuine user change.
  let hydrating = false;
  let userChanged = false;

  const flush = (): void => {
    pending = false;
    timer = null;
    try {
      const wrapped = JSON.stringify({ v: version, state: serialize(p.read()) } satisfies Envelope);
      const result = storage.setItem(opts.key, wrapped);
      if (result instanceof Promise) result.catch((err) => onError(err, 'write'));
    } catch (err) {
      onError(err, 'write');
    }
  };

  const scheduleWrite = (): void => {
    if (debounceMs <= 0) {
      flush();
      return;
    }
    if (pending) return;
    pending = true;
    timer = setTimeout(flush, debounceMs);
  };

  const unsub = p.subscribe(() => {
    // Ignore notifications caused by our own hydration apply — re-persisting the
    // value we just read is pointless churn, and it must not flip userChanged.
    if (hydrating) return;
    userChanged = true;
    scheduleWrite();
  });

  const applyValue = (value: T): void => {
    hydrating = true;
    try {
      p.apply(value);
    } finally {
      hydrating = false;
    }
  };

  // ── Initial read (handles both sync and async storage) ────────────────────
  const applyRead = (raw: string | null, isAsync: boolean): void => {
    if (raw === null) return;
    // If the user already mutated state before an async getItem resolved, the
    // persisted (stale) value must not clobber the newer in-memory state.
    if (isAsync && userChanged) return;
    try {
      let parsed: unknown;
      let hasValue = true;
      let migrated = false;
      try {
        const env: unknown = JSON.parse(raw);
        if (isEnvelope(env)) {
          if (env.v === version) {
            parsed = deserialize(env.state);
          } else if (env.v < version && opts.migrate) {
            // migrate receives the prior value (deserialized) + its version.
            parsed = opts.migrate(deserialize(env.state), env.v);
            migrated = true;
          } else if (env.v < version) {
            // Older payload, no migrate provided → drop rather than apply a
            // shape the current code doesn't understand.
            hasValue = false;
          } else {
            // env.v > version: written by NEWER code (e.g. after a rollback).
            // Don't trust a future shape — surface it and drop.
            onError(
              new Error(`persisted version ${env.v} is newer than ${version}; ignoring`),
              'read',
            );
            hasValue = false;
          }
        } else {
          // Non-enveloped / legacy payload — deserialize the whole string.
          parsed = deserialize(raw);
        }
      } catch {
        parsed = deserialize(raw);
      }
      if (!hasValue) return;
      applyValue(parsed as T);
      // Persist the migrated value at the current version so a crash before the
      // next change doesn't force the migration to run again.
      if (migrated) flush();
    } catch (err) {
      onError(err, 'read');
    }
  };

  const readResult = (() => {
    try {
      return storage.getItem(opts.key);
    } catch (err) {
      onError(err, 'read');
      return null;
    }
  })();

  if (readResult instanceof Promise) {
    readResult.then((r) => applyRead(r, true)).catch((err) => onError(err, 'read'));
  } else {
    applyRead(readResult, false);
  }

  return () => {
    unsub();
    // Flush a pending debounced write so unmount/teardown doesn't lose the last
    // change.
    if (timer) {
      clearTimeout(timer);
      timer = null;
      if (pending) flush();
    }
  };
}

/** Attach persistence to a `Store`. Returns a detach function. */
export function persistStore<S, A>(store: Store<S, A>, opts: PersistOptions<S>): () => void {
  return attach(
    {
      read: () => store.getState(),
      apply: (value: S) => store.replaceState(value),
      subscribe: (cb) => store.subscribe(cb),
    },
    opts,
  );
}

/** Attach persistence to a `SimpleStore`. Returns a detach function. */
export function persistSimpleStore<T>(store: SimpleStore<T>, opts: PersistOptions<T>): () => void {
  return attach(
    {
      read: () => store.get(),
      apply: (value: T) => store.set(value),
      subscribe: (cb) => store.subscribe(cb),
    },
    opts,
  );
}
