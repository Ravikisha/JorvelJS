import { afterEach, describe, expect, it } from 'vitest';
import { SimpleStore, createStore, type Reducer } from '../src/index.js';
import { syncStore, syncSimpleStore, type ChannelLike } from '../src/sync.js';

// In-memory BroadcastChannel hub: channels with the same name see each other's
// posts (but not their own), mimicking the real cross-tab behavior.
const hubs = new Map<string, Set<FakeChannel>>();
class FakeChannel implements ChannelLike {
  private handlers = new Set<(ev: { data: unknown }) => void>();
  constructor(public name: string) {
    if (!hubs.has(name)) hubs.set(name, new Set());
    hubs.get(name)!.add(this);
  }
  postMessage(data: unknown): void {
    for (const peer of hubs.get(this.name) ?? []) {
      if (peer === this) continue;
      for (const h of peer.handlers) h({ data });
    }
  }
  addEventListener(_t: 'message', handler: (ev: { data: unknown }) => void): void {
    this.handlers.add(handler);
  }
  removeEventListener(_t: 'message', handler: (ev: { data: unknown }) => void): void {
    this.handlers.delete(handler);
  }
  close(): void {
    hubs.get(this.name)?.delete(this);
  }
}
const factory = (name: string) => new FakeChannel(name);

afterEach(() => hubs.clear());

describe('syncSimpleStore', () => {
  it('mirrors a set() to a store on the same channel', () => {
    const a = new SimpleStore<number>(0);
    const b = new SimpleStore<number>(0);
    syncStoreCleanup(syncSimpleStore(a, { channel: 'c', channelFactory: factory }));
    syncStoreCleanup(syncSimpleStore(b, { channel: 'c', channelFactory: factory }));
    a.set(42);
    expect(b.get()).toBe(42);
  });

  it('does not echo (applying a remote update does not re-broadcast)', () => {
    const a = new SimpleStore<number>(0);
    const b = new SimpleStore<number>(0);
    let aSets = 0;
    syncStoreCleanup(syncSimpleStore(a, { channel: 'c2', channelFactory: factory }));
    syncStoreCleanup(syncSimpleStore(b, { channel: 'c2', channelFactory: factory }));
    a.subscribe(() => aSets++);
    b.set(7);
    expect(a.get()).toBe(7);
    expect(aSets).toBe(1); // applied once, no echo storm
  });

  it('detach stops syncing', () => {
    const a = new SimpleStore<number>(0);
    const b = new SimpleStore<number>(0);
    const detachA = syncSimpleStore(a, { channel: 'c3', channelFactory: factory });
    syncSimpleStore(b, { channel: 'c3', channelFactory: factory });
    detachA();
    b.set(9);
    expect(a.get()).toBe(0);
  });
});

describe('syncStore', () => {
  type S = { n: number };
  const reducer: Reducer<S, { type: 'inc' }> = (s, act) => (act.type === 'inc' ? { n: s.n + 1 } : s);

  it('mirrors replaceState across tabs', () => {
    const a = createStore<S, { type: 'inc' }>({ n: 0 }, reducer);
    const b = createStore<S, { type: 'inc' }>({ n: 0 }, reducer);
    syncStore(a, { channel: 's', channelFactory: factory });
    syncStore(b, { channel: 's', channelFactory: factory });
    a.dispatch({ type: 'inc' });
    expect(b.getState()).toEqual({ n: 1 });
  });
});

// helper to silence unused-return lint without keeping refs
function syncStoreCleanup(_detach: () => void): void {
  /* noop */
}
