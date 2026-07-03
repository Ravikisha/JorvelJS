import { describe, expect, it, vi } from 'vitest';
import { SimpleStore, createStore, type Reducer } from '../src/index.js';
import {
  persistStore,
  persistSimpleStore,
  type PersistStorage,
} from '../src/persist.js';

class MemoryStorage implements PersistStorage {
  store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('persistSimpleStore', () => {
  // The on-disk envelope is { v, state } where `state` is the serialized value
  // (a string), so custom non-JSON serializers round-trip correctly.
  it('seeds the store from storage on attach', () => {
    const storage = new MemoryStorage();
    storage.setItem('count', JSON.stringify({ v: 0, state: JSON.stringify(99) }));
    const store = new SimpleStore<number>(0);
    persistSimpleStore(store, { key: 'count', storage, debounceMs: 0 });
    expect(store.get()).toBe(99);
  });

  it('persists changes back to storage', async () => {
    const storage = new MemoryStorage();
    const store = new SimpleStore<number>(0);
    persistSimpleStore(store, { key: 'count', storage, debounceMs: 0 });
    store.set(7);
    const raw = storage.getItem('count');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ v: 0, state: JSON.stringify(7) });
  });

  it('detach stops further writes', () => {
    const storage = new MemoryStorage();
    const store = new SimpleStore<number>(0);
    const detach = persistSimpleStore(store, { key: 'k', storage, debounceMs: 0 });
    store.set(1);
    detach();
    store.set(2);
    expect(JSON.parse(storage.getItem('k')!)).toEqual({ v: 0, state: JSON.stringify(1) });
  });

  it('migrates older versions when migrate is provided', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', JSON.stringify({ v: 0, state: JSON.stringify(1) }));
    const store = new SimpleStore<{ count: number }>({ count: 0 });
    const migrate = vi.fn((raw: unknown, _from: number) => ({ count: raw as number }));
    persistSimpleStore(store, {
      key: 'k',
      storage,
      version: 1,
      migrate,
      debounceMs: 0,
    });
    expect(migrate).toHaveBeenCalledWith(1, 0);
    expect(store.get()).toEqual({ count: 1 });
    // The migrated value is written back at the new version.
    expect(JSON.parse(storage.getItem('k')!)).toEqual({ v: 1, state: JSON.stringify({ count: 1 }) });
  });

  it('does NOT migrate (and drops) when persisted version is newer than code', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', JSON.stringify({ v: 5, state: JSON.stringify(123) }));
    const store = new SimpleStore<number>(0);
    const migrate = vi.fn((raw: unknown) => raw as number);
    const onError = vi.fn();
    persistSimpleStore(store, { key: 'k', storage, version: 1, migrate, onError, debounceMs: 0 });
    expect(migrate).not.toHaveBeenCalled();
    expect(store.get()).toBe(0);
    expect(onError).toHaveBeenCalled();
  });

  it('round-trips through a custom serializer/deserializer', () => {
    // A serializer that does not produce strict JSON for the *value* — proves
    // the value is run through serialize/deserialize, not JSON.parse'd raw.
    const storage = new MemoryStorage();
    const serialize = (v: Map<string, number>) => JSON.stringify([...v.entries()]);
    const deserialize = (raw: string) => new Map<string, number>(JSON.parse(raw));
    const store = new SimpleStore<Map<string, number>>(new Map());
    const detach = persistSimpleStore(store, { key: 'm', storage, serialize, deserialize, debounceMs: 0 });
    store.set(new Map([['a', 1]]));
    detach();

    const store2 = new SimpleStore<Map<string, number>>(new Map());
    persistSimpleStore(store2, { key: 'm', storage, serialize, deserialize, debounceMs: 0 });
    expect(store2.get()).toEqual(new Map([['a', 1]]));
  });

  it('flushes a pending debounced write on detach', () => {
    const storage = new MemoryStorage();
    const store = new SimpleStore<number>(0);
    const detach = persistSimpleStore(store, { key: 'k', storage, debounceMs: 1000 });
    store.set(42);
    // Pending (debounced) write not yet flushed.
    expect(storage.getItem('k')).toBeNull();
    detach();
    expect(JSON.parse(storage.getItem('k')!)).toEqual({ v: 0, state: JSON.stringify(42) });
  });
});

describe('persistStore', () => {
  type State = { count: number };
  type Action = { type: 'inc' };
  const reducer: Reducer<State, Action> = (s, a) => (a.type === 'inc' ? { count: s.count + 1 } : s);

  it('hydrates store state from storage on attach', () => {
    const storage = new MemoryStorage();
    storage.setItem('app', JSON.stringify({ v: 0, state: JSON.stringify({ count: 42 }) }));
    const store = createStore<State, Action>({ count: 0 }, reducer);
    persistStore(store, { key: 'app', storage, debounceMs: 0 });
    expect(store.getState()).toEqual({ count: 42 });
  });

  it('writes back on dispatch', () => {
    const storage = new MemoryStorage();
    const store = createStore<State, Action>({ count: 0 }, reducer);
    persistStore(store, { key: 'app', storage, debounceMs: 0 });
    store.dispatch({ type: 'inc' });
    const raw = JSON.parse(storage.getItem('app')!);
    expect(raw).toEqual({ v: 0, state: JSON.stringify({ count: 1 }) });
  });
});
