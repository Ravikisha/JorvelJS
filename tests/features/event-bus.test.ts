/**
 * Feature: @jorvel/event-bus — onAny, replay, once, error handler.
 */
import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../libs/event-bus/dist/index.js';

interface Events {
  'shell:ready': { ts: number };
  'dashboard:action': { type: string };
}

describe('EventBus', () => {
  it('delivers events to typed handlers', () => {
    const bus = new EventBus<Events>();
    const spy = vi.fn();
    bus.on('shell:ready', spy);
    bus.emit('shell:ready', { ts: 1 });
    expect(spy).toHaveBeenCalledWith({ ts: 1 });
  });

  it('onAny receives all events', () => {
    const bus = new EventBus<Events>();
    const spy = vi.fn();
    bus.onAny(spy);
    bus.emit('shell:ready', { ts: 2 });
    bus.emit('dashboard:action', { type: 'click' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('shell:ready', { ts: 2 });
    expect(spy).toHaveBeenCalledWith('dashboard:action', { type: 'click' });
  });

  it('replays the last event to a late subscriber', () => {
    const bus = new EventBus<Events>();
    bus.emit('shell:ready', { ts: 5 });
    const spy = vi.fn();
    // replay is opted into per-subscription, not via a constructor option.
    bus.on('shell:ready', spy, { replay: true });
    expect(spy).toHaveBeenCalledWith({ ts: 5 });
  });

  it('once unsubscribes after the first delivery', () => {
    const bus = new EventBus<Events>();
    const spy = vi.fn();
    bus.once('shell:ready', spy);
    bus.emit('shell:ready', { ts: 1 });
    bus.emit('shell:ready', { ts: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('per-bus error handler catches handler exceptions', () => {
    const onError = vi.fn();
    const bus = new EventBus<Events>({ errorHandler: onError });
    bus.on('shell:ready', () => {
      throw new Error('boom');
    });
    bus.on('shell:ready', () => {
      // second subscriber must still fire
    });
    bus.emit('shell:ready', { ts: 1 });
    expect(onError).toHaveBeenCalled();
  });
});
