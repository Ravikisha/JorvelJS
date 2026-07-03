import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/state API',
  description:
    'Singleton store registry, simple stores, Redux-style reducer stores, memoized selectors, structured selectors, middleware, devtools.',
};

export default function StateApi() {
  return (
    <>
      <h1>@jorvel/state</h1>
      <p>
        Lightweight shared-state primitives for JORVEL micro-frontends. Pins registries to{' '}
        <code>globalThis</code> so host + remote still observe the same store when MF singleton
        sharing fails. Federation share-scope is the fast path; <code>globalThis</code> is the
        safety net.
      </p>

      <Callout variant="info" title="When to pick which">
        <strong>SimpleStore</strong> — one value, subscribers, optional equality. Theme, locale,
        feature flags.
        <br />
        <strong>Reducer store</strong> — non-trivial state machines, auditable actions, SSR
        hydration.
        <br />
        <strong>Selectors</strong> — derive view models without recomputing.
      </Callout>

      <h2 id="simple">SimpleStore</h2>
      <p>
        Single-value store with subscribe + set. Equality check prevents needless re-renders.
      </p>
      <CodeBlock
        language="ts"
        code={`getSimpleStore<T>(key: string, initial: T): SimpleStore<T>;

class SimpleStore<T> {
  constructor(initial: T, opts?: { equalityFn?: (a: T, b: T) => boolean });
  get(): T;
  set(next: T): void;                              // notifies if !eq(prev, next)
  subscribe(listener: (v: T) => void): () => void;
  readonly listenerCount: number;
}`}
      />

      <h3>Usage</h3>
      <CodeBlock
        language="ts"
        code={`import { getSimpleStore } from '@jorvel/state';

const theme = getSimpleStore<'light' | 'dark'>('theme', 'light');

theme.subscribe((next) => document.documentElement.dataset.theme = next);

theme.set('dark');           // notifies
theme.set('dark');           // skipped — value didn't change`}
      />

      <h2 id="store">Reducer store</h2>
      <p>
        Redux-shaped store: state + reducer + dispatch. Reducers cannot dispatch inside themselves
        (throws) — defer with <code>queueMicrotask</code> if you need a follow-up action.
      </p>
      <CodeBlock
        language="ts"
        code={`type Reducer<S, A> = (state: S, action: A) => S;

createStore<S, A>(initialState: S, reducer: Reducer<S, A>): Store<S, A>;
getStore<S, A>(key: string, initialState: S, reducer: Reducer<S, A>): Store<S, A>;

interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;                       // throws if called inside the reducer
  subscribe(listener: (s: S) => void): () => void;
  replaceReducer(next: Reducer<S, A>): void;
  replaceState(next: S): void;                     // throws inside a reducer
  readonly listenerCount: number;
}`}
      />

      <h3>Usage</h3>
      <CodeBlock
        language="ts"
        code={`import { getStore } from '@jorvel/state';

interface Cart { items: { sku: string; qty: number }[] }
type Action =
  | { type: 'add'; sku: string }
  | { type: 'remove'; sku: string }
  | { type: 'clear' };

const cart = getStore<Cart, Action>('cart', { items: [] }, (state, action) => {
  switch (action.type) {
    case 'add':    return { items: [...state.items, { sku: action.sku, qty: 1 }] };
    case 'remove': return { items: state.items.filter((i) => i.sku !== action.sku) };
    case 'clear':  return { items: [] };
    default:       return state;
  }
});

cart.dispatch({ type: 'add', sku: 'BOOK-42' });
cart.getState().items;       // [{ sku: 'BOOK-42', qty: 1 }]`}
      />

      <h2 id="middleware">Middleware</h2>
      <p>
        Standard Redux-shape middleware. <code>thunkMiddleware</code> lets you dispatch async
        functions; <code>loggerMiddleware</code> prints actions + state diffs;{' '}
        <code>persistenceMiddleware</code> serializes the store to <code>localStorage</code> or a
        custom sink.
      </p>
      <CodeBlock
        language="ts"
        code={`createStoreWithMiddleware<S, A>(
  initialState: S,
  reducer: Reducer<S, A>,
  middlewares: Middleware<S, A>[],
): Store<S, A>;

applyMiddleware<S, A>(store: Store<S, A>, ...middlewares: Middleware<S, A>[]): Store<S, A>;

thunkMiddleware<S, A>(): Middleware<S, A | ThunkAction<S, A>>;
loggerMiddleware<S, A>(opts?: LoggerOptions): Middleware<S, A>;
persistenceMiddleware<S, A>(opts: PersistenceMiddlewareOptions<S>): Middleware<S, A>;

type Middleware<S, A> =
  (api: MiddlewareApi<S, A>) => (next: (action: A) => void) => (action: A) => void;

interface MiddlewareApi<S, A> {
  getState(): S;
  dispatch(action: A): void;
}`}
      />

      <h3>Thunks</h3>
      <CodeBlock
        language="ts"
        code={`import { createStoreWithMiddleware, thunkMiddleware } from '@jorvel/state';

const cart = createStoreWithMiddleware<Cart, Action>(initial, reducer, [thunkMiddleware()]);

const fetchCart = (): ThunkAction<Cart, Action> => async (dispatch) => {
  const res = await fetch('/api/cart');
  const items = await res.json();
  dispatch({ type: 'replace', items });
};

cart.dispatch(fetchCart());`}
      />

      <h3>Persistence</h3>
      <CodeBlock
        language="ts"
        code={`import { persistenceMiddleware } from '@jorvel/state';

const persisted = persistenceMiddleware<Cart, Action>({
  key: 'jorvel:cart',
  storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  throttleMs: 100,
  filter: (state) => ({ items: state.items }),     // omit derived fields
});`}
      />

      <h2 id="atoms">Atoms</h2>
      <CodeBlock
        language="ts"
        code={`atom<T>(initial: T): WritableAtom<T>;          // { get(); set(next | (prev)=>next); subscribe(cb) }
derivedAtom<Deps, T>(deps: Deps, compute: (values) => T): ReadableAtom<T>;
isWritableAtom<T>(a: ReadableAtom<T>): a is WritableAtom<T>;

// @jorvel/state/react
useAtom<T>(atom: WritableAtom<T>): [T, (next: T | ((prev: T) => T)) => void];
useAtomValue<T>(atom: ReadableAtom<T>): T;       // subscribes
useSetAtom<T>(atom: WritableAtom<T>): (next) => void;  // setter only, no subscription`}
      />

      <h2 id="selectors">Selectors</h2>
      <p>
        Memoized derivation. <code>createSelector</code> uses reference equality across the input
        selectors; <code>createSelectorWith</code> takes a custom equality fn (e.g.{' '}
        <code>shallowEqual</code> for object-shaped derivations).
      </p>
      <CodeBlock
        language="ts"
        code={`type Selector<S, R> = (state: S) => R;
type EqualityFn<R> = (a: R, b: R) => boolean;

shallowEqual<T extends object>(a: T, b: T): boolean;

createSelector<S, A, R>(...inputs: Selector<S, A>[], result: (...inputs: A[]) => R): Selector<S, R>;

createSelectorWith<S, R>(
  opts: { equalityFn: EqualityFn<R> },
  ...inputs: Selector<S, any>[],
  result: (...inputs: any[]) => R,
): Selector<S, R>;

createStructuredSelector<S, M extends Record<string, Selector<S, any>>>(
  map: M,
): Selector<S, { [K in keyof M]: ReturnType<M[K]> }>;`}
      />

      <h3>Examples</h3>
      <CodeBlock
        language="ts"
        code={`import { createSelector, createStructuredSelector } from '@jorvel/state';

const items = (s: Cart) => s.items;
const total = createSelector(items, (xs) => xs.reduce((n, i) => n + i.qty, 0));
const view  = createStructuredSelector({
  count: total,
  items,
});

view(cart.getState());       // { count: 3, items: [...] }`}
      />

      <h2 id="devtools">Redux DevTools</h2>
      <p>
        <code>connectDevtools(store, opts?)</code> wires the store into the Redux DevTools browser
        extension. No-op when the extension is missing. Use in dev only; the connection has
        non-trivial CPU cost.
      </p>
      <CodeBlock
        language="ts"
        code={`connectDevtools<S, A>(store: Store<S, A>, opts?: DevtoolsOptions): () => void;

interface DevtoolsOptions {
  name?: string;             // shown in the dropdown
  trace?: boolean;           // capture action stack traces
  maxAge?: number;           // history depth
}

if (process.env.NODE_ENV !== 'production') {
  connectDevtools(cart, { name: 'cart' });
}`}
      />

      <h2 id="hydration">SSR hydration</h2>
      <p>
        Serialize on the server, hydrate on the client. Pair with <code>safeJsonForScript</code>{' '}
        for the inline script payload.
      </p>
      <CodeBlock
        language="ts"
        filename="server"
        code={`const store = getStore('cart', initial, reducer);
const state = store.getState();
template = template.replace('</head>', \`<script id="__CART__">window.__CART__=\${safeJsonForScript(state)}</script></head>\`);`}
      />
      <CodeBlock
        language="ts"
        filename="client"
        code={`const initial = (window as any).__CART__ ?? defaultInitial;
const store = getStore('cart', initial, reducer);   // first call wins — server state takes effect`}
      />

      <h2 id="federation">Federation singleton</h2>
      <p>
        <code>@jorvel/state</code> is declared as a singleton in the generated{' '}
        <code>jorvel.federation.json</code>. Combined with the <code>globalThis</code> registry,
        two bundles loading the package independently still write to the same store map.
      </p>

      <h2 id="warnings">Mismatch warnings</h2>
      <p>
        <code>getStore(key, initial, reducer)</code> compares the signature of subsequent calls
        against the first call. Different signatures log a warning in development — typically
        signals two bundles disagreeing on the store shape.
      </p>

      <h2 id="testing">Testing helpers</h2>
      <CodeBlock
        language="ts"
        code={`// @internal — useful in test setup
_resetStore(key?: string): void;
_resetSimpleStore(key?: string): void;

import { _resetStore } from '@jorvel/state';

beforeEach(() => { _resetStore(); });`}
      />
    </>
  );
}
