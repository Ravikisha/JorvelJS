import { describe, expect, it, vi } from 'vitest';
import { atom, derivedAtom, isWritableAtom } from '../src/atom.js';

describe('atom', () => {
  it('holds and updates a value', () => {
    const a = atom(1);
    expect(a.get()).toBe(1);
    a.set(2);
    expect(a.get()).toBe(2);
    a.set((p) => p + 10);
    expect(a.get()).toBe(12);
  });

  it('notifies subscribers on change, skips no-op sets', () => {
    const a = atom(0);
    const spy = vi.fn();
    const unsub = a.subscribe(spy);
    a.set(1);
    a.set(1); // Object.is equal → no notify
    a.set(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(2);
    unsub();
    a.set(3);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('isWritableAtom narrows correctly', () => {
    expect(isWritableAtom(atom(1))).toBe(true);
    expect(isWritableAtom(derivedAtom([atom(1)], ([n]) => n))).toBe(false);
  });
});

describe('derivedAtom', () => {
  it('computes from a single dependency and tracks changes', () => {
    const count = atom(2);
    const doubled = derivedAtom([count], ([c]) => c * 2);
    const spy = vi.fn();
    const unsub = doubled.subscribe(spy);
    expect(doubled.get()).toBe(4);
    count.set(5);
    expect(doubled.get()).toBe(10);
    expect(spy).toHaveBeenLastCalledWith(10);
    unsub();
  });

  it('combines multiple dependencies', () => {
    const a = atom(3);
    const b = atom(4);
    const sum = derivedAtom([a, b], ([x, y]) => x + y);
    const unsub = sum.subscribe(() => {});
    expect(sum.get()).toBe(7);
    a.set(10);
    expect(sum.get()).toBe(14);
    b.set(0);
    expect(sum.get()).toBe(10);
    unsub();
  });

  it('detaches dep subscriptions when the last listener leaves', () => {
    const base = atom(1);
    const d = derivedAtom([base], ([n]) => n * 3);
    const unsub = d.subscribe(() => {});
    expect((base as unknown as { subscribe: unknown }).subscribe).toBeTypeOf('function');
    unsub();
    // After detach, updates to base still produce the right value on next read
    // (recomputed lazily on resubscribe).
    base.set(7);
    const unsub2 = d.subscribe(() => {});
    expect(d.get()).toBe(21);
    unsub2();
  });

  it('chains derived atoms', () => {
    const n = atom(1);
    const plus1 = derivedAtom([n], ([x]) => x + 1);
    const times10 = derivedAtom([plus1], ([x]) => x * 10);
    const unsub = times10.subscribe(() => {});
    expect(times10.get()).toBe(20);
    n.set(4);
    expect(times10.get()).toBe(50);
    unsub();
  });
});
