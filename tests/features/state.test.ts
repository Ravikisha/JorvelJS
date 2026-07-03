/**
 * Feature: @jorvel/state core + persist + devtools.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createStore, SimpleStore, getStore, _resetStore } from '../../libs/state/dist/index.js';
import { persistSimpleStore, type PersistStorage } from '../../libs/state/dist/persist.js';
import { connectDevtools } from '../../libs/state/dist/devtools.js';

class MemoryStorage implements PersistStorage {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

beforeEach(() => _resetStore());

describe('createStore', () => {
  it('updates state on dispatch and notifies subscribers', () => {
    type S = { n: number };
    type A = { type: 'inc' };
    const store = createStore<S, A>({ n: 0 }, (s, a) => (a.type === 'inc' ? { n: s.n + 1 } : s));
    const spy = vi.fn();
    store.subscribe(spy);
    store.dispatch({ type: 'inc' });
    expect(store.getState()).toEqual({ n: 1 });
    expect(spy).toHaveBeenCalledWith({ n: 1 });
  });

  it('replaceState seeds state and notifies', () => {
    const store = createStore<{ n: number }, { type: 'noop' }>({ n: 0 }, (s) => s);
    const spy = vi.fn();
    store.subscribe(spy);
    store.replaceState({ n: 99 });
    expect(store.getState()).toEqual({ n: 99 });
    expect(spy).toHaveBeenCalledWith({ n: 99 });
  });
});

describe('getStore singleton registry', () => {
  it('returns the same instance for the same key', () => {
    const a = getStore('app', { n: 0 }, (s) => s);
    const b = getStore('app', { n: 999 }, (s) => s);
    expect(a).toBe(b);
    expect(b.getState()).toEqual({ n: 0 });
  });
});

describe('persistSimpleStore', () => {
  it('seeds from storage on attach', () => {
    // Envelope `state` is the serialized payload (a string) so custom serializers
    // round-trip; the default serializer is JSON.stringify.
    const storage = new MemoryStorage();
    storage.setItem('k', JSON.stringify({ v: 0, state: JSON.stringify(42) }));
    const store = new SimpleStore<number>(0);
    persistSimpleStore(store, { key: 'k', storage, debounceMs: 0 });
    expect(store.get()).toBe(42);
  });

  it('writes back on change', () => {
    const storage = new MemoryStorage();
    const store = new SimpleStore<number>(0);
    persistSimpleStore(store, { key: 'k', storage, debounceMs: 0 });
    store.set(7);
    expect(JSON.parse(storage.getItem('k')!)).toEqual({ v: 0, state: JSON.stringify(7) });
  });
});

describe('connectDevtools', () => {
  it('returns a no-op when extension is absent', () => {
    delete (globalThis as { __JORVEL_STATE_DEVTOOLS__?: unknown }).__JORVEL_STATE_DEVTOOLS__;
    delete (globalThis as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__;
    const store = createStore<{ n: number }, { type: 'inc' }>({ n: 0 }, (s) => s);
    const detach = connectDevtools(store);
    expect(typeof detach).toBe('function');
    detach();
  });
});
