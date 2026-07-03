/**
 * @jorvel/runtime — `use(promise)` for React 18.
 *
 * React 19 ships `use()`; on 18 this is the same ergonomic: read a promise
 * during render — suspend while pending, return the value when resolved, throw
 * to the nearest error boundary on rejection. Results are memoized on the
 * promise object itself (via a WeakMap) so re-renders don't re-suspend.
 *
 * Pair with a `<Suspense>` boundary (and, ideally, a stable promise — create it
 * in a loader / cache, not inline in render).
 */

type Settled<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

const CACHE = new WeakMap<Promise<unknown>, Settled<unknown> | 'pending'>();

/**
 * Read a promise during render. Throws the promise while pending (Suspense),
 * returns the resolved value, or throws the rejection (ErrorBoundary).
 */
export function use<T>(promise: Promise<T>): T {
  const cached = CACHE.get(promise) as Settled<T> | 'pending' | undefined;
  if (cached && cached !== 'pending') {
    if (cached.status === 'fulfilled') return cached.value;
    throw cached.reason;
  }
  if (cached === 'pending') throw promise;

  CACHE.set(promise, 'pending');
  promise.then(
    (value) => CACHE.set(promise, { status: 'fulfilled', value }),
    (reason) => CACHE.set(promise, { status: 'rejected', reason }),
  );
  throw promise;
}

/** Alias for teams that prefer an explicit hook-ish name. */
export const usePromise = use;
