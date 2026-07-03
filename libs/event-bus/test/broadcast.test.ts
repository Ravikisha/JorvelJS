import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/index.js';
import { connectBroadcast } from '../src/broadcast.js';

// ── In-memory BroadcastChannel double ─────────────────────────────────────
// Real BroadcastChannel needs a browser. We model a per-name hub that fans
// messages out to every listener except the one that posted.

type Listener = {
  ref: { handler: (ev: { data: unknown }) => void };
  channel: FakeChannel;
}

class Hub {
  private listeners: Listener[] = [];
  attach(channel: FakeChannel, handler: (ev: { data: unknown }) => void) {
    this.listeners.push({ ref: { handler }, channel });
  }
  detach(channel: FakeChannel, handler: (ev: { data: unknown }) => void) {
    this.listeners = this.listeners.filter(
      (l) => !(l.channel === channel && l.ref.handler === handler),
    );
  }
  publish(from: FakeChannel, data: unknown) {
    for (const l of this.listeners) {
      if (l.channel === from) continue;
      l.ref.handler({ data });
    }
  }
}

const hubs = new Map<string, Hub>();
function getHub(name: string): Hub {
  let h = hubs.get(name);
  if (!h) {
    h = new Hub();
    hubs.set(name, h);
  }
  return h;
}

class FakeChannel {
  private hub: Hub;
  constructor(public name: string) {
    this.hub = getHub(name);
  }
  postMessage(data: unknown) {
    this.hub.publish(this, data);
  }
  addEventListener(_: 'message', handler: (ev: { data: unknown }) => void) {
    this.hub.attach(this, handler);
  }
  removeEventListener(_: 'message', handler: (ev: { data: unknown }) => void) {
    this.hub.detach(this, handler);
  }
  close() {
    /* no-op */
  }
}

const factory = (name: string) => new FakeChannel(name) as unknown as never;

afterEach(() => hubs.clear());

describe('connectBroadcast', () => {
  it('mirrors emissions to other buses on the same channel', () => {
    type E = { ping: { n: number } };
    const a = new EventBus<E>();
    const b = new EventBus<E>();
    connectBroadcast(a, { channelName: 'c1', channelFactory: factory });
    connectBroadcast(b, { channelName: 'c1', channelFactory: factory });

    const cb = vi.fn();
    b.on('ping', cb);
    a.emit('ping', { n: 1 });

    expect(cb).toHaveBeenCalledWith({ n: 1 });
  });

  it('does not echo back to the originating bus', () => {
    type E = { x: number };
    const a = new EventBus<E>();
    connectBroadcast(a, { channelName: 'c2', channelFactory: factory });

    const seen = vi.fn();
    a.on('x', seen);
    a.emit('x', 42);

    // Local emit fires once; remote echo must be suppressed.
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('isolates channels by name', () => {
    type E = { z: string };
    const a = new EventBus<E>();
    const b = new EventBus<E>();
    connectBroadcast(a, { channelName: 'ch-a', channelFactory: factory });
    connectBroadcast(b, { channelName: 'ch-b', channelFactory: factory });

    const cb = vi.fn();
    b.on('z', cb);
    a.emit('z', 'hi');

    expect(cb).not.toHaveBeenCalled();
  });

  it('filter:false skips an event from cross-tab sync', () => {
    type E = { keep: number; skip: number };
    const a = new EventBus<E>();
    const b = new EventBus<E>();
    connectBroadcast(a, {
      channelName: 'c3',
      channelFactory: factory,
      filter: (e) => e !== 'skip',
    });
    connectBroadcast(b, { channelName: 'c3', channelFactory: factory });

    const keep = vi.fn();
    const skip = vi.fn();
    b.on('keep', keep);
    b.on('skip', skip);

    a.emit('keep', 1);
    a.emit('skip', 2);

    expect(keep).toHaveBeenCalledTimes(1);
    expect(skip).not.toHaveBeenCalled();
  });

  it('disconnect stops further mirroring', () => {
    type E = { y: number };
    const a = new EventBus<E>();
    const b = new EventBus<E>();
    const conn = connectBroadcast(a, { channelName: 'c4', channelFactory: factory });
    connectBroadcast(b, { channelName: 'c4', channelFactory: factory });

    const cb = vi.fn();
    b.on('y', cb);

    a.emit('y', 1);
    conn.disconnect();
    a.emit('y', 2);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('throws when BroadcastChannel global missing and no factory passed', () => {
    const orig = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    try {
      const bus = new EventBus();
      expect(() => connectBroadcast(bus)).toThrow(/BroadcastChannel/);
    } finally {
      if (orig !== undefined) {
        (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = orig;
      }
    }
  });

  it('ignores malformed inbound messages', () => {
    type E = { ev: string };
    const a = new EventBus<E>();
    connectBroadcast(a, { channelName: 'c5', channelFactory: factory });
    const cb = vi.fn();
    a.on('ev', cb);

    // Inject garbage by posting to the channel directly.
    const hub = getHub('c5');
    // create a sibling channel to publish from
    const sibling = new FakeChannel('c5');
    hub.publish(sibling, { event: 42 }); // wrong type
    hub.publish(sibling, null);
    hub.publish(sibling, 'string-payload');

    expect(cb).not.toHaveBeenCalled();
  });

  it('exposes a stable originId', () => {
    const a = new EventBus();
    const conn = connectBroadcast(a, { channelName: 'c6', channelFactory: factory });
    expect(typeof conn.originId).toBe('string');
    expect(conn.originId.length).toBeGreaterThan(0);
  });
});
