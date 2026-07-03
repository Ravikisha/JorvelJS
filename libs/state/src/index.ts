/**
 * @jorvel/state
 *
 * Lightweight shared-state primitives for JORVEL micro-frontends. Pinning the
 * registries to `globalThis` survives duplicate bundles when MF singleton
 * sharing fails — host/remote still see the same `Map` of stores.
 */

export {
  createSelector,
  createSelectorWith,
  createStructuredSelector,
  shallowEqual,
  type EqualityFn,
  type MemoizedSelector,
  type Selector,
} from './selectors.js';

export {
  applyMiddleware,
  createStoreWithMiddleware,
  thunkMiddleware,
  loggerMiddleware,
  persistenceMiddleware,
  type Middleware,
  type MiddlewareApi,
  type ThunkAction,
  type LoggerOptions,
  type PersistenceMiddlewareOptions,
} from './middleware.js';

export { connectDevtools, type DevtoolsOptions } from './devtools.js';

export {
  atom,
  derivedAtom,
  isWritableAtom,
  type ReadableAtom,
  type WritableAtom,
} from './atom.js';

export {
  createServerStore,
  createHydratedStore,
  dehydrateAll,
  serializeState,
  readHydratedState,
  type ServerStore,
  type DehydratedState,
} from './server-store.js';

export type StoreListener<T> = (value: T) => void;
export type Unsubscribe = () => void;
export type Reducer<S, A> = (state: S, action: A) => S;

// ── SimpleStore ────────────────────────────────────────────────────────────

export interface SimpleStoreOptions<T> {
  /** Optional equality fn — when next === prev (or eq returns true) `set` skips notification. */
  equalityFn?: (a: T, b: T) => boolean;
}

export class SimpleStore<T> {
  private value: T;
  private listeners = new Set<StoreListener<T>>();
  private eq: (a: T, b: T) => boolean;

  constructor(initial: T, opts: SimpleStoreOptions<T> = {}) {
    this.value = initial;
    this.eq = opts.equalityFn ?? Object.is;
  }

  get(): T {
    return this.value;
  }

  set(next: T): void {
    if (this.eq(next, this.value)) return;
    this.value = next;
    // Snapshot to keep iteration safe across set/subscribe/unsubscribe.
    for (const l of [...this.listeners]) l(this.value);
  }

  subscribe(listener: StoreListener<T>): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

// ── Redux-style store ──────────────────────────────────────────────────────

export interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: StoreListener<S>): Unsubscribe;
  replaceReducer(nextReducer: Reducer<S, A>): void;
  /**
   * Hydrate the store with an externally-supplied state (e.g. from a persistence
   * layer or SSR transfer). Notifies listeners. Throws if called inside a
   * reducer.
   */
  replaceState(next: S): void;
  /**
   * Coalesce multiple `dispatch` calls into a single subscriber notification.
   * Nesting is safe — only the outermost `batch` releases the queue.
   *
   * ```ts
   * store.batch(() => {
   *   store.dispatch({ type: 'a' });
   *   store.dispatch({ type: 'b' }); // only one notify after this returns
   * });
   * ```
   */
  batch<T>(fn: () => T): T;
  readonly listenerCount: number;
}

export function createStore<S, A>(initialState: S, reducer: Reducer<S, A>): Store<S, A> {
  let state = initialState;
  let currentReducer = reducer;
  let isDispatching = false;
  // batch() depth: while >0, dispatches mutate `state` without notifying.
  let batchDepth = 0;
  let batchDirty = false;
  const listeners = new Set<StoreListener<S>>();

  function notify(): void {
    for (const l of [...listeners]) l(state);
  }

  function getState(): S {
    return state;
  }

  function dispatch(action: A): void {
    if (isDispatching) {
      throw new Error(
        '[jorvel/state] Reducers may not dispatch actions. Defer the second dispatch with queueMicrotask or setTimeout.',
      );
    }
    let next: S;
    isDispatching = true;
    try {
      next = currentReducer(state, action);
    } finally {
      isDispatching = false;
    }
    if (next === state) return;
    state = next;
    if (batchDepth > 0) {
      batchDirty = true;
      return;
    }
    notify();
  }

  function batch<T>(fn: () => T): T {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && batchDirty) {
        batchDirty = false;
        notify();
      }
    }
  }

  function subscribe(listener: StoreListener<S>): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function replaceReducer(nextReducer: Reducer<S, A>): void {
    currentReducer = nextReducer;
  }

  function replaceState(next: S): void {
    if (isDispatching) {
      throw new Error('[jorvel/state] replaceState() may not be called inside a reducer.');
    }
    if (next === state) return;
    state = next;
    if (batchDepth > 0) {
      batchDirty = true;
      return;
    }
    notify();
  }

  return {
    getState,
    dispatch,
    subscribe,
    replaceReducer,
    replaceState,
    batch,
    get listenerCount() {
      return listeners.size;
    },
  };
}

// ── Singleton store factory ────────────────────────────────────────────────

const REGISTRY_KEY = '__JORVEL_STATE_REGISTRY__';
const SIMPLE_REGISTRY_KEY = '__JORVEL_STATE_SIMPLE_REGISTRY__';

type StoreRecord = { store: Store<unknown, unknown>; signature: string };
type SimpleRecord = { store: SimpleStore<unknown>; signature: string };

interface GlobalRegistries {
  [REGISTRY_KEY]?: Map<string, StoreRecord>;
  [SIMPLE_REGISTRY_KEY]?: Map<string, SimpleRecord>;
}

function getStoreRegistry(): Map<string, StoreRecord> {
  const g = globalThis as unknown as GlobalRegistries;
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Map<string, StoreRecord>();
  return g[REGISTRY_KEY];
}

function getSimpleRegistry(): Map<string, SimpleRecord> {
  const g = globalThis as unknown as GlobalRegistries;
  if (!g[SIMPLE_REGISTRY_KEY]) g[SIMPLE_REGISTRY_KEY] = new Map<string, SimpleRecord>();
  return g[SIMPLE_REGISTRY_KEY];
}

function makeSignature(parts: unknown[]): string {
  // Cheap fingerprint — just enough to detect that two callers asked for the
  // same key with mismatched semantics. We don't try to fingerprint reducers
  // by source; we hash their string representation.
  return parts
    .map((p) => (typeof p === 'function' ? p.toString().length + ':' + p.name : JSON.stringify(p)))
    .join('|');
}

function isProduction(): boolean {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.['NODE_ENV'] === 'production';
}

function warnIfDifferent(key: string, prev: string, next: string): void {
  if (prev === next) return;
  if (isProduction()) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[jorvel/state] getStore("${key}") called with different initialState/reducer than the existing instance. The first call wins; later args are ignored.`,
  );
}

export function getStore<S, A>(key: string, initialState: S, reducer: Reducer<S, A>): Store<S, A> {
  const reg = getStoreRegistry();
  const sig = makeSignature([initialState, reducer]);
  const existing = reg.get(key);
  if (existing) {
    warnIfDifferent(key, existing.signature, sig);
    return existing.store as Store<S, A>;
  }
  const store = createStore(initialState, reducer);
  reg.set(key, { store: store as Store<unknown, unknown>, signature: sig });
  return store;
}

/** @internal — testing only */
export function _resetStore(key?: string): void {
  const reg = getStoreRegistry();
  if (key !== undefined) reg.delete(key);
  else reg.clear();
}

export function getSimpleStore<T>(key: string, initial: T): SimpleStore<T> {
  const reg = getSimpleRegistry();
  const sig = makeSignature([initial]);
  const existing = reg.get(key);
  if (existing) {
    warnIfDifferent(key, existing.signature, sig);
    return existing.store as SimpleStore<T>;
  }
  const store = new SimpleStore<T>(initial);
  reg.set(key, { store: store as SimpleStore<unknown>, signature: sig });
  return store;
}

/** @internal — testing only */
export function _resetSimpleStore(key?: string): void {
  const reg = getSimpleRegistry();
  if (key !== undefined) reg.delete(key);
  else reg.clear();
}
