/**
 * @jorvel/state/sync
 *
 * Cross-tab state sync via BroadcastChannel. Every local state change is mirrored
 * to other same-origin tabs; incoming messages are applied without re-broadcast
 * (origin-tagged to prevent echo loops). Pairs with `@jorvel/state/persist` — the
 * persisted envelope already supports rehydration; this keeps live tabs in step.
 */

import type { SimpleStore, Store } from './index.js';

export interface ChannelLike {
  postMessage(data: unknown): void;
  addEventListener(type: 'message', handler: (ev: { data: unknown }) => void): void;
  removeEventListener(type: 'message', handler: (ev: { data: unknown }) => void): void;
  close(): void;
}

export interface SyncOptions<T> {
  /** Channel name. Default `'jorvel-state'`. Use distinct names per store. */
  channel?: string;
  /** Custom serializer (default JSON.stringify). */
  serialize?: (value: T) => string;
  /** Custom deserializer (default JSON.parse). */
  deserialize?: (raw: string) => T;
  /** Inject a channel (Node tests / polyfills). Default: global BroadcastChannel. */
  channelFactory?: (name: string) => ChannelLike;
}

const ORIGIN_KEY = '__jorvel_state_origin__';

interface SyncMessage {
  [ORIGIN_KEY]: string;
  state: string;
}

function defaultChannelFactory(name: string): ChannelLike {
  const Ctor = (globalThis as { BroadcastChannel?: new (n: string) => ChannelLike }).BroadcastChannel;
  if (!Ctor) {
    throw new Error(
      '[jorvel/state] BroadcastChannel is unavailable here. Pass `channelFactory` for non-browser runtimes.',
    );
  }
  return new Ctor(name);
}

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Syncable<T> {
  read(): T;
  apply(value: T): void;
  subscribe(cb: () => void): () => void;
}

function attachSync<T>(s: Syncable<T>, opts: SyncOptions<T>): () => void {
  let channel: ChannelLike;
  try {
    channel = (opts.channelFactory ?? defaultChannelFactory)(opts.channel ?? 'jorvel-state');
  } catch {
    return () => {}; // no BroadcastChannel (SSR/old runtime) → no-op
  }
  const originId = randomId();
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = opts.deserialize ?? ((raw: string) => JSON.parse(raw) as T);

  // True while applying a remote update, so the resulting local change isn't
  // re-broadcast back out (echo-loop guard).
  let applying = false;

  const unsub = s.subscribe(() => {
    if (applying) return;
    try {
      const message: SyncMessage = { [ORIGIN_KEY]: originId, state: serialize(s.read()) };
      channel.postMessage(message);
    } catch {
      // postMessage / serialize can throw on unclonable payloads — skip.
    }
  });

  const onMessage = (ev: { data: unknown }) => {
    const d = ev.data as Partial<SyncMessage> | null;
    if (!d || typeof d !== 'object') return;
    if (d[ORIGIN_KEY] === originId || typeof d.state !== 'string') return;
    applying = true;
    try {
      s.apply(deserialize(d.state));
    } catch {
      /* ignore bad payloads */
    } finally {
      applying = false;
    }
  };

  channel.addEventListener('message', onMessage);

  return () => {
    unsub();
    channel.removeEventListener('message', onMessage);
    try {
      channel.close();
    } catch {
      /* ignore */
    }
  };
}

/** Keep a `Store`'s state in sync across same-origin tabs. Returns a detach fn. */
export function syncStore<S, A>(store: Store<S, A>, opts: SyncOptions<S> = {}): () => void {
  return attachSync<S>(
    {
      read: () => store.getState(),
      apply: (v) => store.replaceState(v),
      subscribe: (cb) => store.subscribe(cb),
    },
    opts,
  );
}

/** Keep a `SimpleStore`'s value in sync across same-origin tabs. Returns a detach fn. */
export function syncSimpleStore<T>(store: SimpleStore<T>, opts: SyncOptions<T> = {}): () => void {
  return attachSync<T>(
    {
      read: () => store.get(),
      apply: (v) => store.set(v),
      subscribe: (cb) => store.subscribe(cb),
    },
    opts,
  );
}
