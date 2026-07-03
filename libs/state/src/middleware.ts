/**
 * Redux-style middleware for the `Store` returned by `createStore`.
 *
 * Each middleware sees `next` (the inner dispatch) and `state` (a getter for
 * the current state). It can defer, transform, or short-circuit actions. The
 * `applyMiddleware` helper composes a chain — earliest entry wraps the others.
 */

import type { Reducer, Store, StoreListener, Unsubscribe } from './index.js';
import { createStore } from './index.js';

export interface MiddlewareApi<S, A> {
  getState(): S;
  /**
   * Re-enters the chain (so a thunk can re-dispatch). Calling this from a
   * reducer is still forbidden — the inner store throws.
   */
  dispatch(action: A): A;
}

export type Middleware<S, A> = (api: MiddlewareApi<S, A>) => (next: (action: A) => A) => (action: A) => A;

/**
 * Compose middleware around an existing store. Returns the same store
 * reference but with `dispatch` wrapped — subscribers still see the same
 * post-reducer state.
 */
export function applyMiddleware<S, A>(
  store: Store<S, A>,
  middlewares: Array<Middleware<S, A>>,
): Store<S, A> {
  let dispatch: (action: A) => A = (action) => {
    store.dispatch(action);
    return action;
  };

  const api: MiddlewareApi<S, A> = {
    getState: () => store.getState(),
    // Note: re-entrant `dispatch` goes through the full chain again, not the
    // base store, so logger/thunk middleware see re-dispatches too.
    dispatch: (action) => dispatch(action),
  };

  const chain = middlewares.map((m) => m(api));
  dispatch = chain.reduceRight<(action: A) => A>(
    (acc, mw) => mw(acc),
    (action) => {
      store.dispatch(action);
      return action;
    },
  );

  return {
    getState: store.getState.bind(store),
    dispatch: ((action: A) => dispatch(action)) as Store<S, A>['dispatch'],
    subscribe: store.subscribe.bind(store) as (l: StoreListener<S>) => Unsubscribe,
    replaceReducer: store.replaceReducer.bind(store),
    replaceState: store.replaceState.bind(store),
    batch: store.batch.bind(store),
    get listenerCount() {
      return store.listenerCount;
    },
  };
}

/**
 * Convenience: `createStore` + `applyMiddleware` in one call.
 */
export function createStoreWithMiddleware<S, A>(
  initialState: S,
  reducer: Reducer<S, A>,
  middlewares: Array<Middleware<S, A>>,
): Store<S, A> {
  const base = createStore(initialState, reducer);
  return applyMiddleware(base, middlewares);
}

// ── Built-in presets ──────────────────────────────────────────────────────

/**
 * Thunk middleware — when an action is a function, call it with
 * `({ dispatch, getState })`. Use for async flows.
 *
 * The action type passed to `Store<S, A>` should be widened to include the
 * thunk signature, e.g. `A | ThunkAction<S, A>`.
 */
export type ThunkAction<S, A> = (api: MiddlewareApi<S, A>) => unknown;

export function thunkMiddleware<S, A>(): Middleware<S, A> {
  return (api) => (next) => (action) => {
    if (typeof action === 'function') {
      (action as unknown as ThunkAction<S, A>)(api);
      return action;
    }
    return next(action);
  };
}

/**
 * Logger middleware — `console.log` before/after with a label. The default
 * action-type printer is `JSON.stringify`; override via `format`.
 */
export interface LoggerOptions<A> {
  label?: string;
  log?: (...args: unknown[]) => void;
  format?: (action: A) => string;
  /** When true, prints the previous + next state. Default: false (noisy). */
  printState?: boolean;
}

export function loggerMiddleware<S, A>(opts: LoggerOptions<A> = {}): Middleware<S, A> {
  const label = opts.label ?? 'jorvel/state';
  // eslint-disable-next-line no-console
  const out = opts.log ?? console.log.bind(console);
  const fmt = opts.format ?? ((a: A) => {
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  });
  return (api) => (next) => (action) => {
    const before = opts.printState ? api.getState() : undefined;
    const result = next(action);
    if (opts.printState) {
      out(`[${label}]`, fmt(action), { prev: before, next: api.getState() });
    } else {
      out(`[${label}]`, fmt(action));
    }
    return result;
  };
}

/**
 * Persistence middleware — calls `save(state)` after every successful dispatch.
 * Pair with `libs/state/src/persist.ts` for storage adapters.
 */
export interface PersistenceMiddlewareOptions<S> {
  save: (state: S) => void | Promise<void>;
  /** Throttle window in ms — coalesces rapid writes. Default: 0 (every dispatch). */
  throttleMs?: number;
  /** Time source for tests. */
  now?: () => number;
  /** Pluggable timer. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  /** Clear function for the timer. */
  clearTimer?: (handle: unknown) => void;
}

export function persistenceMiddleware<S, A>(
  opts: PersistenceMiddlewareOptions<S>,
): Middleware<S, A> {
  const window = opts.throttleMs ?? 0;
  const now = opts.now ?? Date.now;
  const set = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clr = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  // -Infinity guarantees the first dispatch always writes immediately,
  // independent of `now()` returning 0 in tests.
  let lastWriteAt = -Infinity;
  let pending: unknown | null = null;

  const safeSave = (state: S) => {
    // Swallow both sync throws and async rejections — persistence failures
    // must never abort the dispatch chain.
    try {
      const r = opts.save(state);
      if (r && typeof (r as Promise<void>).catch === 'function') {
        (r as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  };

  return (api) => (next) => (action) => {
    const result = next(action);
    const t = now();
    const since = t - lastWriteAt;
    if (window === 0 || since >= window) {
      lastWriteAt = t;
      safeSave(api.getState());
    } else if (pending === null) {
      pending = set(() => {
        pending = null;
        lastWriteAt = now();
        safeSave(api.getState());
      }, window - since);
    }
    // Mark `clr` as referenced so the option is overridable.
    void clr;
    return result;
  };
}
