/**
 * @jorvel/state — atom primitives (Jotai-style).
 *
 * A lightweight atom model on top of the same pub/sub the package already uses.
 * Primitive atoms hold a value; derived atoms recompute from explicit
 * dependencies. React bindings live in `@jorvel/state/react`
 * (`useAtom` / `useAtomValue` / `useSetAtom`).
 *
 * Atom registries are NOT globalThis-pinned — atoms are module-scoped values
 * you import, so identity is shared the same way any module export is.
 */

import type { Unsubscribe } from './index.js';

export interface ReadableAtom<T> {
  /** Read the current value. */
  get(): T;
  /** Subscribe to changes; fires with the new value. */
  subscribe(listener: (value: T) => void): Unsubscribe;
  /** Brand for type-narrowing writable vs readonly. */
  readonly isWritable: boolean;
}

export interface WritableAtom<T> extends ReadableAtom<T> {
  readonly isWritable: true;
  /** Set a new value, or derive it from the previous one. */
  set(next: T | ((prev: T) => T)): void;
}

function isUpdater<T>(v: T | ((prev: T) => T)): v is (prev: T) => T {
  return typeof v === 'function';
}

/** Create a writable primitive atom. */
export function atom<T>(initial: T): WritableAtom<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();

  return {
    isWritable: true,
    get: () => value,
    set(next) {
      const resolved = isUpdater(next) ? next(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      for (const l of [...listeners]) l(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/**
 * Create a read-only derived atom. Recomputes (and notifies) whenever any of
 * its `deps` change. Pass deps explicitly — keeps the model simple and the
 * dependency graph static/predictable.
 *
 * ```ts
 * const count = atom(1);
 * const doubled = derivedAtom([count], ([c]) => c * 2);
 * ```
 */
export function derivedAtom<Deps extends ReadableAtom<unknown>[], T>(
  deps: [...Deps],
  compute: (values: { [K in keyof Deps]: Deps[K] extends ReadableAtom<infer V> ? V : never }) => T,
): ReadableAtom<T> {
  type Values = { [K in keyof Deps]: Deps[K] extends ReadableAtom<infer V> ? V : never };
  const read = (): T => compute(deps.map((d) => d.get()) as Values);

  let value = read();
  const listeners = new Set<(v: T) => void>();
  let depUnsubs: Unsubscribe[] = [];

  const recompute = () => {
    const next = read();
    if (Object.is(next, value)) return;
    value = next;
    for (const l of [...listeners]) l(value);
  };

  return {
    isWritable: false,
    get: () => value,
    subscribe(listener) {
      // Lazily wire dep subscriptions only while someone is listening.
      if (listeners.size === 0) {
        // Recompute on (re)attach in case deps changed while detached.
        value = read();
        depUnsubs = deps.map((d) => d.subscribe(recompute));
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          for (const u of depUnsubs) u();
          depUnsubs = [];
        }
      };
    },
  };
}

/** Type guard: true when an atom can be written. */
export function isWritableAtom<T>(a: ReadableAtom<T>): a is WritableAtom<T> {
  return a.isWritable === true;
}
