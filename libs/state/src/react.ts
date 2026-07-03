/**
 * @jorvel/state/react
 *
 * Minimal React 18+ bindings for `Store` and `SimpleStore`. Uses
 * `useSyncExternalStore` so concurrent rendering tearing is avoided.
 *
 * `react` is a peer dependency. This is a subpath export (`@jorvel/state/react`),
 * so projects that don't render React simply never import it and never load React.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { SimpleStore, Store } from './index.js';
import type { ReadableAtom, WritableAtom } from './atom.js';

type Cache<V> = { has: boolean; source: unknown; value: V };

/**
 * Build a referentially-stable getSnapshot. `useSyncExternalStore` requires the
 * snapshot to be stable while the underlying source is unchanged — otherwise a
 * selector that returns a fresh object/array each call triggers React's
 * "getSnapshot should be cached" infinite loop. We cache on the source's
 * identity (the store's state object) and, on a genuine change, keep the prior
 * value reference when an `equalityFn` reports it equal.
 */
function makeSnapshot<Source, V>(
  readSource: () => Source,
  select: (s: Source) => V,
  cache: { current: Cache<V> },
  equalityFn?: (a: V, b: V) => boolean,
): () => V {
  return () => {
    const source = readSource();
    const c = cache.current;
    // Source object unchanged → return the exact same selected value.
    if (c.has && Object.is(c.source, source)) return c.value;
    const value = select(source);
    if (c.has && equalityFn && equalityFn(c.value, value)) {
      c.source = source; // advance the source ref but keep the stable value ref
      return c.value;
    }
    cache.current = { has: true, source, value };
    return value;
  };
}

/** Subscribe to a Redux-style store and select a slice. */
export function useStore<S, A>(store: Store<S, A>): S;
export function useStore<S, A, T>(
  store: Store<S, A>,
  selector: (state: S) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T;
export function useStore<S, A, T>(
  store: Store<S, A>,
  selector?: (state: S) => T,
  equalityFn?: (a: T, b: T) => boolean,
): S | T {
  // Stable subscribe — keyed on the store, not recreated every render.
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const cache = useRef<Cache<S | T>>({ has: false, source: undefined, value: undefined as S | T });
  const getSnapshot = useCallback(
    makeSnapshot<S, S | T>(
      () => store.getState(),
      (s) => (selector ? selector(s) : s),
      cache,
      equalityFn as ((a: S | T, b: S | T) => boolean) | undefined,
    ),
    [store, selector, equalityFn],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to a `SimpleStore` value (or a derived selector). */
export function useSimpleStore<T>(store: SimpleStore<T>): T;
export function useSimpleStore<T, U>(
  store: SimpleStore<T>,
  selector: (value: T) => U,
  equalityFn?: (a: U, b: U) => boolean,
): U;
export function useSimpleStore<T, U>(
  store: SimpleStore<T>,
  selector?: (value: T) => U,
  equalityFn?: (a: U, b: U) => boolean,
): T | U {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const cache = useRef<Cache<T | U>>({ has: false, source: undefined, value: undefined as T | U });
  const getSnapshot = useCallback(
    makeSnapshot<T, T | U>(
      () => store.get(),
      (s) => (selector ? selector(s) : s),
      cache,
      equalityFn as ((a: T | U, b: T | U) => boolean) | undefined,
    ),
    [store, selector, equalityFn],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Convenience: returns `[state, dispatch]` like `useReducer`. The dispatch
 * reference is stable across renders.
 */
export function useStoreReducer<S, A>(store: Store<S, A>): [S, (action: A) => void] {
  const state = useStore(store);
  const dispatch = useCallback((action: A) => store.dispatch(action), [store]);
  return [state, dispatch];
}

/**
 * Stable dispatch bound to `store`. Skips the subscription so the caller does
 * not re-render on state change — useful inside event handlers.
 */
export function useDispatch<S, A>(store: Store<S, A>): (action: A) => void {
  return useCallback((action: A) => store.dispatch(action), [store]);
}

// ── Atom bindings ────────────────────────────────────────────────────────────

/** Subscribe to an atom's value (works for primitive and derived atoms). */
export function useAtomValue<T>(atom: ReadableAtom<T>): T {
  const subscribe = useCallback((cb: () => void) => atom.subscribe(cb), [atom]);
  const getSnapshot = useCallback(() => atom.get(), [atom]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Get a stable setter for a writable atom without subscribing to it. */
export function useSetAtom<T>(atom: WritableAtom<T>): (next: T | ((prev: T) => T)) => void {
  return useCallback((next: T | ((prev: T) => T)) => atom.set(next), [atom]);
}

/** `[value, setValue]` for a writable atom (subscribes + sets). */
export function useAtom<T>(atom: WritableAtom<T>): [T, (next: T | ((prev: T) => T)) => void] {
  return [useAtomValue(atom), useSetAtom(atom)];
}
