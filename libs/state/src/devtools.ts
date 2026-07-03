/**
 * @jorvel/state/devtools
 *
 * Bridge to the Redux DevTools browser extension. Falls back to a no-op when
 * the extension is not installed (or in non-browser environments).
 */

import type { Store } from './index.js';

export interface DevtoolsOptions {
  /** Instance name shown in the devtools UI. Default: `'jorvel-state'`. */
  name?: string;
  /** Optional features payload forwarded to the extension. */
  features?: Record<string, boolean>;
}

interface DevtoolsConnection {
  init(state: unknown): void;
  send(action: unknown, state: unknown): void;
  subscribe(listener: (msg: unknown) => void): () => void;
  unsubscribe(): void;
  error?(msg: string): void;
}

interface DevtoolsExtension {
  connect(options?: { name?: string; features?: Record<string, boolean> }): DevtoolsConnection;
}

interface ExtensionWindow {
  __REDUX_DEVTOOLS_EXTENSION__?: DevtoolsExtension;
  __JORVEL_STATE_DEVTOOLS__?: DevtoolsExtension;
}

function getExtension(): DevtoolsExtension | undefined {
  const w = globalThis as unknown as ExtensionWindow;
  return w.__JORVEL_STATE_DEVTOOLS__ ?? w.__REDUX_DEVTOOLS_EXTENSION__;
}

/**
 * Connect a `Store` to Redux DevTools. Returns a detach function. When the
 * extension is not present, this is a no-op.
 */
const DEVTOOLS_MARK = Symbol.for('jorvel.state.devtools.connected');

export function connectDevtools<S, A>(store: Store<S, A>, opts: DevtoolsOptions = {}): () => void {
  const ext = getExtension();
  if (!ext) return () => {};

  // Re-entrancy guard: connecting the same store twice would double-wrap
  // dispatch (every action sent twice) and, with out-of-order detach, resurrect
  // a stale wrapper. Refuse the second connect until the first detaches.
  const marked = store as unknown as { [DEVTOOLS_MARK]?: boolean };
  if (marked[DEVTOOLS_MARK]) {
    // eslint-disable-next-line no-console
    console.warn('[jorvel/state] connectDevtools: store already connected; ignoring duplicate.');
    return () => {};
  }
  marked[DEVTOOLS_MARK] = true;

  const conn = ext.connect({ name: opts.name ?? 'jorvel-state', features: opts.features ?? {} });
  conn.init(store.getState());

  // Wrap dispatch so each action is forwarded to the panel.
  const originalDispatch = store.dispatch;
  const wrapped = (action: A) => {
    originalDispatch.call(store, action);
    try {
      conn.send(action ?? { type: '@@anonymous' }, store.getState());
    } catch {
      /* extension may close mid-session */
    }
  };
  (store as unknown as { dispatch: (a: A) => void }).dispatch = wrapped;

  // Time-travel: when the panel sends DISPATCH messages, replace state.
  const unsubExt = conn.subscribe((msg) => {
    const m = msg as { type?: string; state?: string; payload?: { type?: string } };
    if (m.type === 'DISPATCH' && m.payload?.type === 'JUMP_TO_ACTION' && typeof m.state === 'string') {
      try {
        store.replaceState(JSON.parse(m.state) as S);
      } catch {
        /* ignore corrupt payloads */
      }
    }
  });

  return () => {
    (store as unknown as { dispatch: (a: A) => void }).dispatch = originalDispatch;
    delete marked[DEVTOOLS_MARK];
    unsubExt();
    conn.unsubscribe();
  };
}
