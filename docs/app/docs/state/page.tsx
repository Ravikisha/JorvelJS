import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'State & event bus',
  description:
    'Typed event bus, simple stores, Redux-style stores, memoized selectors, schema-validated events, cross-tab broadcast.',
};

export default function StateDoc() {
  return (
    <>
      <h1>State &amp; event bus</h1>
      <p>
        Two primitives cover almost every cross-remote communication pattern: a typed event bus
        (<code>@jorvel/event-bus</code>) and a singleton store registry (<code>@jorvel/state</code>).
        Both are pinned to <code>globalThis</code> so duplicate bundles still observe the same
        instance — the federation share-scope is the fast path, <code>globalThis</code> is the
        safety net.
      </p>

      <Callout variant="info" title="Picking the right primitive">
        <ul className="m-0">
          <li>
            <strong>Event bus</strong> — fire-and-forget cross-remote signals (analytics ping,
            cart updated, user logged in).
          </li>
          <li>
            <strong>SimpleStore</strong> — a single value with subscribers (current theme, locale,
            feature flags).
          </li>
          <li>
            <strong>Store + reducer</strong> — non-trivial state machines with auditable actions
            (cart, multi-step forms).
          </li>
          <li>
            <strong>Selectors</strong> — derive view-models from any store without recomputing.
          </li>
        </ul>
      </Callout>

      <h2 id="event-bus">Event bus</h2>
      <CodeBlock
        language="ts"
        code={`import { getEventBus } from '@jorvel/event-bus';

interface Events {
  'user:login':    { userId: string };
  'cart:updated':  { count: number };
  'theme:changed': 'light' | 'dark';
}

const bus = getEventBus<Events>();

// Subscribe (returns unsubscribe)
const off = bus.on('cart:updated', (p) => console.log(p.count));

// Subscribe + replay last value (great for late-mounting subscribers)
bus.on('theme:changed', applyTheme, { replay: true });

// Listen exactly once
bus.once('user:login', (p) => audit.track('first-login', p));

// Wildcard — every event (logging / devtools)
const offAny = bus.onAny((event, payload) => devtools.push({ event, payload }));

// Fire
bus.emit('cart:updated', { count: 3 });

// Tear down
off();
offAny();
bus.clear('cart:updated');     // wipe one event
bus.clear();                   // wipe everything (tests)`}
      />

      <p>
        <code>bus</code> is a singleton — any remote that imports <code>@jorvel/event-bus</code>{' '}
        shares the same instance because the package is declared as a singleton in federation
        config. A handler that throws is caught (<code>errorHandler</code>) so a single bad
        subscriber cannot abort delivery to the rest.
      </p>

      <h2>Simple store</h2>
      <CodeBlock
        language="ts"
        code={`import { getSimpleStore } from '@jorvel/state';

const auth = getSimpleStore<{ user: User | null }>('auth', { user: null });
auth.subscribe((s) => render(s));
auth.set({ user: { id: '1', email: 'x@y.z' } });`}
      />

      <h2>Redux-style store</h2>
      <CodeBlock
        language="ts"
        code={`import { getStore } from '@jorvel/state';

type State = { count: number };
type Action = { type: 'inc' } | { type: 'set'; value: number };

const store = getStore<State, Action>('counter', {
  initial: { count: 0 },
  reducer: (s, a) => {
    switch (a.type) {
      case 'inc': return { count: s.count + 1 };
      case 'set': return { count: a.value };
    }
  },
});
store.dispatch({ type: 'inc' });`}
      />

      <h2 id="atoms">Atoms (Jotai-style)</h2>
      <p>
        For fine-grained, bottom-up state, use <code>atom</code> + <code>derivedAtom</code>. Atoms
        are module-scoped values you import; React bindings (<code>useAtom</code> /{' '}
        <code>useAtomValue</code> / <code>useSetAtom</code>) live in <code>@jorvel/state/react</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import { atom, derivedAtom } from '@jorvel/state';

export const count = atom(0);
export const doubled = derivedAtom([count], ([c]) => c * 2);  // recomputes on count change

count.set(5);          // or count.set((p) => p + 1)
doubled.get();         // 10`}
      />
      <CodeBlock
        language="tsx"
        code={`import { useAtom, useAtomValue, useSetAtom } from '@jorvel/state/react';
import { count, doubled } from './atoms.js';

function Counter() {
  const [n, setN] = useAtom(count);
  const d = useAtomValue(doubled);          // re-renders only when doubled changes
  return <button onClick={() => setN((p) => p + 1)}>{n} → {d}</button>;
}

function ResetButton() {
  const setN = useSetAtom(count);           // setter only — does NOT re-render on change
  return <button onClick={() => setN(0)}>reset</button>;
}`}
      />
      <p>
        <code>derivedAtom</code> takes explicit dependencies — the graph stays static and
        predictable, and dep subscriptions attach only while something is listening.
      </p>

      <h2>Memoized selectors</h2>
      <p>
        <code>createSelector</code> composes input selectors and caches the last result. Use it to
        derive view models that should only recompute when their dependencies change.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createSelector, createStructuredSelector, shallowEqual, createSelectorWith } from '@jorvel/state';

const selectUser = (s: AppState) => s.user;
const selectCart = (s: AppState) => s.cart;

const selectCartSummary = createSelector(
  selectCart,
  (cart) => ({ count: cart.items.length, total: cart.items.reduce((a, b) => a + b.price, 0) }),
);

// Custom equality (shallow) — useful when a selector returns a fresh object.
const selectDashboard = createSelectorWith(
  { equalityFn: shallowEqual },
  selectUser,
  selectCart,
  (u, c) => ({ name: u.name, count: c.items.length }),
);

// Structured selectors return an object with the named results.
const selectHeader = createStructuredSelector({
  user: selectUser,
  cartCount: (s) => s.cart.items.length,
});`}
      />

      <h2>Store middleware</h2>
      <p>
        Compose middleware around the store to log, throttle, persist, or defer async work.{' '}
        <code>thunkMiddleware</code> turns function actions into{' '}
        <code>(dispatch, getState)</code> callbacks; <code>loggerMiddleware</code> prints every
        dispatch; <code>persistenceMiddleware</code> writes the latest state to your storage
        adapter with optional throttling.
      </p>
      <CodeBlock
        language="ts"
        code={`import {
  createStoreWithMiddleware,
  thunkMiddleware,
  loggerMiddleware,
  persistenceMiddleware,
} from '@jorvel/state';

const store = createStoreWithMiddleware(
  { user: null, count: 0 },
  reducer,
  [
    thunkMiddleware(),
    loggerMiddleware({ label: 'shell', printState: true }),
    persistenceMiddleware({
      save: (s) => localStorage.setItem('app', JSON.stringify(s)),
      throttleMs: 250,
    }),
  ],
);

// Thunk
store.dispatch(({ dispatch }) => {
  fetch('/me')
    .then((r) => r.json())
    .then((user) => dispatch({ type: 'user.set', user }));
});`}
      />

      <Callout variant="info" title="Persistence round-trips custom serializers">
        <code>persistStore</code> / <code>persistSimpleStore</code> write an envelope of{' '}
        <code>{`{ v, state }`}</code> where <code>state</code> is the <em>serialized payload string</em>,
        so a custom <code>serialize</code>/<code>deserialize</code> pair (superjson, Map, Date)
        round-trips exactly. On detach they flush any pending debounced write, and they dedupe the
        hydration echo so rehydrating doesn&apos;t re-trigger a save. <code>migrate</code> runs only
        when the stored version is <em>below</em> the current one — never on a downgrade.
      </Callout>

      <h2 id="cross-tab-sync">Cross-tab sync</h2>
      <p>
        <code>syncStore</code> / <code>syncSimpleStore</code> (from{' '}
        <code>@jorvel/state/sync</code>) mirror state across same-origin tabs over a{' '}
        <code>BroadcastChannel</code>. Each local change is broadcast; incoming updates are applied
        without re-broadcast (origin-tagged to avoid echo loops). It is a no-op where{' '}
        <code>BroadcastChannel</code> is unavailable (SSR), and pairs with persistence — persist
        rehydrates a fresh tab, sync keeps open tabs in step.
      </p>
      <CodeBlock
        language="ts"
        code={`import { getSimpleStore } from '@jorvel/state';
import { syncSimpleStore } from '@jorvel/state/sync';

const cart = getSimpleStore('cart', { items: [] });
const stop = syncSimpleStore(cart, { channel: 'cart' }); // returns a detach fn

// cart.set(...) in one tab now updates every other tab on the 'cart' channel.`}
      />

      <h2>Schema-validated events</h2>
      <p>
        Attach validators to the event bus to reject malformed payloads at the source. Any object
        with a <code>parse(input)</code> method works (Zod, Valibot, ArkType, custom).
      </p>
      <CodeBlock
        language="ts"
        code={`import { getEventBus, attachSchemaRegistry } from '@jorvel/event-bus';
import { z } from 'zod';

interface Events {
  'cart:add': { sku: string; qty: number };
}

const bus = getEventBus<Events>();
attachSchemaRegistry(bus, {
  'cart:add': z.object({ sku: z.string().min(1), qty: z.number().int().positive() }),
}, { onInvalid: 'throw', log: (event, err) => console.warn(event, err) });

bus.emit('cart:add', { sku: 'A', qty: 2 });       // ok
bus.emit('cart:add', { qty: 1 } as never);        // throws — sku missing`}
      />

      <h2>Feature flags</h2>
      <p>
        <code>InMemoryFlags</code> is a built-in provider for local dev / tests.{' '}
        <code>fromVendor()</code> wraps any duck-typed SDK (LaunchDarkly, Flagsmith, Statsig, …)
        into the common <code>FeatureFlagAdapter</code> interface. Register once at boot, then read
        from anywhere with <code>isFeatureEnabled()</code> / <code>featureVariation()</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import {
  InMemoryFlags,
  setFeatureFlags,
  isFeatureEnabled,
  featureVariation,
  fromVendor,
} from '@jorvel/runtime';

// Local / tests
setFeatureFlags(new InMemoryFlags({
  flags: { newOnboarding: true, theme: 'dark' },
  overrides: { 'u-vip': { newOnboarding: true } },
}));

// Vendor (LaunchDarkly example — duck-typed, no LD dep needed)
// const client = LD.init(process.env.LD_KEY!);
// setFeatureFlags(fromVendor(client, {
//   toClientContext: (ctx) => ({ kind: 'user', key: ctx?.userId ?? 'anon' }),
// }));

if (isFeatureEnabled('newOnboarding', { userId: user.id })) renderOnboarding();
const theme = featureVariation('theme', 'light', { userId: user.id });`}
      />

      <h2>Cross-tab sync</h2>
      <p>
        Mirror emissions across same-origin tabs with a <code>BroadcastChannel</code> adapter.
        Echoes from the originating tab are suppressed automatically.
      </p>
      <CodeBlock
        language="ts"
        code={`import { connectBroadcast } from '@jorvel/event-bus';

const conn = connectBroadcast(bus, {
  channelName: 'jorvel:cart',
  filter: (event) => event !== 'cart:internal',   // keep some events tab-local
});

// later
conn.disconnect();`}
      />

      <h2 id="ssr-hydration">SSR hydration</h2>
      <p>
        Serialize state on the server, rehydrate on the client. The serialization helper escapes{' '}
        <code>&lt;/script&gt;</code> sequences and accepts a CSP nonce so a strict policy still
        admits the payload.
      </p>
      <CodeBlock
        language="ts"
        code={`// server.ts
import { serializeState } from '@jorvel/ssr';
import { buildCsp, generateNonce } from '@jorvel/security';

const nonce = generateNonce();
const initial = await loadInitialState(request);
const head = serializeState(initial, { key: 'app', nonce });

response.setHeader('Content-Security-Policy', buildCsp({ nonce }));
const html = baseHtml.replace('</head>', head + '</head>');

// bootstrap.tsx
import { hydrateState, clearHydratedState } from '@jorvel/ssr';

const state = hydrateState<InitialState>('app');
if (state) primeStore(state);
clearHydratedState('app');   // free the <script> tag once consumed`}
      />

      <h2 id="recipes">Recipes</h2>

      <h3>Sharing auth between host and remote</h3>
      <CodeBlock
        language="ts"
        filename="libs/auth-store/src/index.ts"
        code={`import { getSimpleStore } from '@jorvel/state';
import { getEventBus } from '@jorvel/event-bus';

export interface Session { userId: string; roles: string[] }

export const sessionStore = getSimpleStore<Session | null>('session', null);

// Mirror state to the bus so latecomers can pick it up.
const bus = getEventBus<{ 'auth:session': Session | null }>();
sessionStore.subscribe((s) => bus.emit('auth:session', s));`}
      />

      <h3>Time-travel debugging in dev</h3>
      <CodeBlock
        language="ts"
        code={`import { getStore } from '@jorvel/state';

const counter = getStore('counter', { count: 0 }, reducer);

if (process.env.NODE_ENV !== 'production') {
  const history: unknown[] = [counter.getState()];
  counter.subscribe((s) => history.push(structuredClone(s)));
  (window as any).__store = { counter, history, rewind: (i: number) => counter.replaceState(history[i] as never) };
}`}
      />

      <h3>Resetting between tests</h3>
      <CodeBlock
        language="ts"
        code={`import { _resetStore, _resetSimpleStore } from '@jorvel/state';
import { _resetEventBus } from '@jorvel/event-bus';

afterEach(() => {
  _resetStore();
  _resetSimpleStore();
  _resetEventBus();
});`}
      />

      <h2 id="server-store">RSC-compatible server store</h2>
      <p>
        Populate a store on the server, <code>dehydrate()</code> it into the HTML, and{' '}
        <code>hydrate()</code> on the client so the first render matches — no refetch, no flash.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createServerStore, dehydrateAll, serializeState, createHydratedStore } from '@jorvel/state';

// server
const cart = createServerStore({ items: [] });
const html = \`<script>window.__JORVEL_STATE__ = \${serializeState(dehydrateAll({ cart }))}</script>\`;

// client (seeds from the embedded snapshot, else the fallback)
const cart = createHydratedStore('cart', { items: [] });`}
      />
      <p>
        The server side is hook-free (safe in RSC / edge handlers); the client gets{' '}
        <code>get/set/subscribe</code>. <code>serializeState</code> escapes <code>&lt;/script&gt;</code>.
      </p>
    </>
  );
}
