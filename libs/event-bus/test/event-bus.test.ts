import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventBus, getEventBus, _resetEventBus } from '../src/index.js';

type AppEvents = {
  ping: { n: number };
  ready: { appName: string };
  logout: undefined;
  count: number;
};

// ── on / emit ─────────────────────────────────────────────────────────────────

describe('EventBus — on / emit', () => {
  it('emits to a subscribed handler and delivers the correct payload', () => {
    const bus = new EventBus<AppEvents>();
    let last = 0;
    bus.on('ping', (p) => { last = p.n; });
    bus.emit('ping', { n: 42 });
    expect(last).toBe(42);
  });

  it('delivers payload to multiple handlers registered for the same event', () => {
    const bus = new EventBus<AppEvents>();
    const calls: number[] = [];
    bus.on('ping', (p) => calls.push(p.n));
    bus.on('ping', (p) => calls.push(p.n * 2));
    bus.emit('ping', { n: 5 });
    expect(calls).toEqual([5, 10]);
  });

  it('does not call handlers from a different event key', () => {
    const bus = new EventBus<AppEvents>();
    const pingFn = vi.fn();
    const readyFn = vi.fn();
    bus.on('ping', pingFn);
    bus.on('ready', readyFn);
    bus.emit('ping', { n: 7 });
    expect(pingFn).toHaveBeenCalledTimes(1);
    expect(readyFn).not.toHaveBeenCalled();
  });

  it('does not throw when emit is called with no handlers registered', () => {
    const bus = new EventBus<AppEvents>();
    expect(() => bus.emit('ping', { n: 0 })).not.toThrow();
  });

  it('emits the exact same payload reference to all handlers', () => {
    const bus = new EventBus<AppEvents>();
    const received: Array<{ appName: string }> = [];
    bus.on('ready', (p) => received.push(p));
    bus.on('ready', (p) => received.push(p));
    const payload = { appName: 'shell' };
    bus.emit('ready', payload);
    expect(received[0]).toBe(payload);
    expect(received[1]).toBe(payload);
  });

  it('handlers added during emit are NOT called in the same cycle', () => {
    const bus = new EventBus<AppEvents>();
    const callOrder: string[] = [];

    bus.on('ping', () => {
      callOrder.push('first');
      // Add a second handler mid-emit; it should not fire this cycle
      bus.on('ping', () => callOrder.push('added-during-emit'));
    });

    bus.emit('ping', { n: 1 });
    expect(callOrder).toEqual(['first']);

    // On the next emit, the newly added handler should fire
    bus.emit('ping', { n: 2 });
    expect(callOrder).toEqual(['first', 'first', 'added-during-emit']);
  });

  it('works with a primitive payload type', () => {
    const bus = new EventBus<AppEvents>();
    const values: number[] = [];
    bus.on('count', (n) => values.push(n));
    bus.emit('count', 10);
    bus.emit('count', 20);
    expect(values).toEqual([10, 20]);
  });

  it('works with an undefined payload', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    bus.on('logout', handler);
    bus.emit('logout', undefined);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(undefined);
  });
});

// ── unsubscribe (on return value) ─────────────────────────────────────────────

describe('EventBus — unsubscribe', () => {
  it('returned unsubscribe fn removes the handler', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    const unsub = bus.on('ping', handler);
    bus.emit('ping', { n: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
    bus.emit('ping', { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1); // not called again
  });

  it('calling unsubscribe twice is safe (idempotent)', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    const unsub = bus.on('ping', handler);
    unsub();
    expect(() => unsub()).not.toThrow();
    bus.emit('ping', { n: 3 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('can re-subscribe after unsubscribing', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    const unsub = bus.on('ready', handler);
    unsub();
    bus.on('ready', handler);
    bus.emit('ready', { appName: 'shell' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ appName: 'shell' });
  });

  it('unsubscribing one handler does not affect other handlers on the same event', () => {
    const bus = new EventBus<AppEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = bus.on('ping', h1);
    bus.on('ping', h2);
    unsub1();
    bus.emit('ping', { n: 9 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });
});

// ── off ───────────────────────────────────────────────────────────────────────

describe('EventBus — off', () => {
  it('off() removes a specific handler', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.off('ping', handler);
    bus.emit('ping', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() is a no-op when the handler was never registered', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    expect(() => bus.off('ping', handler)).not.toThrow();
  });

  it('off() is a no-op when the event has no handlers at all', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    expect(() => bus.off('ready', handler)).not.toThrow();
  });
});

// ── once ─────────────────────────────────────────────────────────────────────

describe('EventBus — once', () => {
  it('once() fires exactly once', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    bus.once('ping', handler);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    bus.emit('ping', { n: 3 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it('once() returns an unsubscribe fn that prevents the handler firing', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    const unsub = bus.once('ping', handler);
    unsub();
    bus.emit('ping', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() cancels a once() registration by the original handler', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    bus.once('ping', handler);
    bus.off('ping', handler);
    bus.emit('ping', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once() and on() can coexist on the same event', () => {
    const bus = new EventBus<AppEvents>();
    const onceFn = vi.fn();
    const onFn = vi.fn();
    bus.once('ping', onceFn);
    bus.on('ping', onFn);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(onceFn).toHaveBeenCalledTimes(1);
    expect(onFn).toHaveBeenCalledTimes(2);
  });

  it('once() delivers the correct payload', () => {
    const bus = new EventBus<AppEvents>();
    let received: { appName: string } | undefined;
    bus.once('ready', (p) => { received = p; });
    bus.emit('ready', { appName: 'dashboard' });
    expect(received).toEqual({ appName: 'dashboard' });
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────

describe('EventBus — clear', () => {
  it('clear(event) removes all handlers for that event only', () => {
    const bus = new EventBus<AppEvents>();
    const pingFn = vi.fn();
    const readyFn = vi.fn();
    bus.on('ping', pingFn);
    bus.on('ready', readyFn);
    bus.clear('ping');
    bus.emit('ping', { n: 1 });
    bus.emit('ready', { appName: 'shell' });
    expect(pingFn).not.toHaveBeenCalled();
    expect(readyFn).toHaveBeenCalledOnce();
  });

  it('clear() with no argument removes all handlers for all events', () => {
    const bus = new EventBus<AppEvents>();
    const pingFn = vi.fn();
    const readyFn = vi.fn();
    bus.on('ping', pingFn);
    bus.on('ready', readyFn);
    bus.clear();
    bus.emit('ping', { n: 1 });
    bus.emit('ready', { appName: 'shell' });
    expect(pingFn).not.toHaveBeenCalled();
    expect(readyFn).not.toHaveBeenCalled();
  });

  it('clear() on an event with no handlers is safe', () => {
    const bus = new EventBus<AppEvents>();
    expect(() => bus.clear('ping')).not.toThrow();
  });

  it('re-subscribing after clear() works correctly', () => {
    const bus = new EventBus<AppEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.clear('ping');
    bus.on('ping', handler);
    bus.emit('ping', { n: 99 });
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ── listenerCount ─────────────────────────────────────────────────────────────

describe('EventBus — listenerCount', () => {
  it('returns 0 when no handlers are registered', () => {
    const bus = new EventBus<AppEvents>();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('increments as handlers are added', () => {
    const bus = new EventBus<AppEvents>();
    bus.on('ping', vi.fn());
    bus.on('ping', vi.fn());
    expect(bus.listenerCount('ping')).toBe(2);
  });

  it('decrements after unsubscribe', () => {
    const bus = new EventBus<AppEvents>();
    const unsub = bus.on('ping', vi.fn());
    expect(bus.listenerCount('ping')).toBe(1);
    unsub();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('returns 0 after clear(event)', () => {
    const bus = new EventBus<AppEvents>();
    bus.on('ping', vi.fn());
    bus.on('ping', vi.fn());
    bus.clear('ping');
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('once() handler counts as 1 before firing, 0 after firing', () => {
    const bus = new EventBus<AppEvents>();
    bus.once('ping', vi.fn());
    expect(bus.listenerCount('ping')).toBe(1);
    bus.emit('ping', { n: 1 });
    expect(bus.listenerCount('ping')).toBe(0);
  });
});

// ── singleton isolation ───────────────────────────────────────────────────────

describe('EventBus — instance isolation', () => {
  it('two separate instances do NOT share events', () => {
    const busA = new EventBus<AppEvents>();
    const busB = new EventBus<AppEvents>();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    busA.on('ping', handlerA);
    busB.on('ping', handlerB);
    busA.emit('ping', { n: 1 });
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled(); // proves no shared state
  });

  it('clearing one bus does not affect the other', () => {
    const busA = new EventBus<AppEvents>();
    const busB = new EventBus<AppEvents>();
    const h = vi.fn();
    busA.on('ping', h);
    busB.on('ping', h);
    busA.clear();
    busB.emit('ping', { n: 7 });
    expect(h).toHaveBeenCalledOnce();
  });
});

// ── getEventBus singleton ─────────────────────────────────────────────────────

describe('getEventBus — process-level singleton', () => {
  beforeEach(() => {
    _resetEventBus();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getEventBus();
    const b = getEventBus();
    expect(a).toBe(b);
  });

  it('handler registered before getEventBus() call receives event emitted after', () => {
    const bus = getEventBus<AppEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);

    // Simulate a second "module" calling getEventBus() — same instance
    const bus2 = getEventBus<AppEvents>();
    bus2.emit('ping', { n: 100 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ n: 100 });
  });

  it('simulates cross-MFE communication: host emits, remote handler receives', () => {
    // In real MF, both sides import from the same singleton module instance.
    // Here we simulate that with getEventBus() on both sides.
    type MfeEvents = { 'user:login': { userId: string } };

    const hostBus = getEventBus<MfeEvents>();  // "host side"
    const remoteBus = getEventBus<MfeEvents>(); // "remote side" — same instance

    const remoteHandler = vi.fn();
    remoteBus.on('user:login', remoteHandler);

    hostBus.emit('user:login', { userId: '42' });

    expect(remoteHandler).toHaveBeenCalledOnce();
    expect(remoteHandler).toHaveBeenCalledWith({ userId: '42' });
  });

  it('_resetEventBus() causes next getEventBus() call to return a fresh instance', () => {
    const first = getEventBus();
    _resetEventBus();
    const second = getEventBus();
    expect(first).not.toBe(second);
  });

  it('handlers from a reset bus are NOT called after reset', () => {
    const bus = getEventBus<AppEvents>();
    const staleHandler = vi.fn();
    bus.on('ping', staleHandler);

    _resetEventBus();

    const freshBus = getEventBus<AppEvents>();
    freshBus.emit('ping', { n: 5 });
    expect(staleHandler).not.toHaveBeenCalled();
  });
});
