import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearHandlers, reportError, reportMetric, reportRemoteLoad, startRum, type RumBatch } from '../src/index.js';

afterEach(() => clearHandlers());

const collector = (extra: Partial<Parameters<typeof startRum>[0]> = {}) => {
  const batches: RumBatch[] = [];
  const rum = startRum({
    transport: async (b) => { batches.push(b); },
    flushIntervalMs: 0,
    session: 'sess-1',
    now: () => 1700000000,
    ...extra,
  });
  return { rum, batches };
};

describe('startRum', () => {
  it('throws without transport or endpoint', () => {
    expect(() => startRum({})).toThrow(/transport.*endpoint/);
  });

  it('captures metric, error, and remote-load events via global hooks', async () => {
    const { rum, batches } = collector({ batchSize: 100 });
    reportMetric({ name: 'lcp', value: 1234 });
    reportError({ error: new Error('boom') });
    reportRemoteLoad({ remote: 'r1', url: '/r.js', phase: 'success', durationMs: 12 });
    expect(rum.queued).toBe(3);
    await rum.flush();
    expect(batches).toHaveLength(1);
    expect(batches[0]!.events.map((e) => e.type)).toEqual(['metric', 'error', 'remote-load']);
    rum.dispose();
  });

  it('auto-flushes when batchSize is reached', async () => {
    const { rum, batches } = collector({ batchSize: 3 });
    reportMetric({ name: 'a', value: 1 });
    reportMetric({ name: 'b', value: 2 });
    reportMetric({ name: 'c', value: 3 });
    await Promise.resolve(); await Promise.resolve();
    expect(batches).toHaveLength(1);
    expect(batches[0]!.events).toHaveLength(3);
    rum.dispose();
  });

  it('drops events past maxQueueSize and reports the drop count in next batch', async () => {
    const { rum, batches } = collector({ batchSize: 100, maxQueueSize: 2 });
    rum.enqueue({ type: 'metric', ts: 1, data: { name: 'a', value: 1 } });
    rum.enqueue({ type: 'metric', ts: 2, data: { name: 'b', value: 2 } });
    rum.enqueue({ type: 'metric', ts: 3, data: { name: 'c', value: 3 } }); // shifts 'a'
    rum.enqueue({ type: 'metric', ts: 4, data: { name: 'd', value: 4 } }); // shifts 'b'
    expect(rum.queued).toBe(2);
    await rum.flush();
    const events = batches[0]!.events;
    // First event is the synthetic drop counter
    expect(events[0]!.type).toBe('metric');
    expect((events[0]!.data as { name: string }).name).toBe('rum.dropped');
    expect((events[0]!.data as { value: number }).value).toBe(2);
    rum.dispose();
  });

  it('samples once per session: keeps ALL events when sampled in', async () => {
    // sampleRate is per-session, not per-event — a sampled-in session keeps
    // every event (so a trace can be reconstructed).
    const { rum, batches } = collector({
      batchSize: 100,
      sampleRate: 0.1,
      random: () => 0.05, // 0.05 < 0.1 → session sampled in
    });
    rum.enqueue({ type: 'metric', ts: 1, data: { name: 'a', value: 1 } });
    rum.enqueue({ type: 'metric', ts: 2, data: { name: 'b', value: 1 } });
    await rum.flush();
    expect(batches[0]!.events.map((e) => (e.data as { name: string }).name)).toEqual(['a', 'b']);
    rum.dispose();
  });

  it('samples once per session: drops the WHOLE session when sampled out', async () => {
    const { rum, batches } = collector({
      batchSize: 100,
      sampleRate: 0.1,
      random: () => 0.9, // 0.9 >= 0.1 → session sampled out
    });
    rum.enqueue({ type: 'metric', ts: 1, data: { name: 'a', value: 1 } });
    rum.enqueue({ type: 'metric', ts: 2, data: { name: 'b', value: 1 } });
    await rum.flush();
    expect(batches.length).toBe(0);
    rum.dispose();
  });

  it('flushes buffered events on dispose (does not drop them)', async () => {
    const { rum, batches } = collector({ batchSize: 100 });
    rum.enqueue({ type: 'metric', ts: 1, data: { name: 'a', value: 1 } });
    expect(rum.queued).toBe(1);
    rum.dispose();
    // dispose() triggers a final flush.
    await Promise.resolve();
    expect(batches.length).toBe(1);
    expect(batches[0]!.events).toHaveLength(1);
  });

  it('honors the filter to drop matching events', async () => {
    const { rum, batches } = collector({
      batchSize: 100,
      filter: (e) => !(e.type === 'metric' && (e.data as { name: string }).name === 'noise'),
    });
    rum.enqueue({ type: 'metric', ts: 1, data: { name: 'noise', value: 1 } });
    rum.enqueue({ type: 'metric', ts: 2, data: { name: 'real', value: 1 } });
    await rum.flush();
    expect(batches[0]!.events).toHaveLength(1);
    expect((batches[0]!.events[0]!.data as { name: string }).name).toBe('real');
    rum.dispose();
  });

  it('flush is a no-op when the queue is empty', async () => {
    const { rum, batches } = collector();
    await rum.flush();
    await rum.flush();
    expect(batches).toHaveLength(0);
    rum.dispose();
  });

  it('annotates the batch with session, app, release, sentAt', async () => {
    const { rum, batches } = collector({ batchSize: 100, app: 'shop', release: 'v1.2.3' });
    reportMetric({ name: 'x', value: 1 });
    await rum.flush();
    expect(batches[0]).toMatchObject({ session: 'sess-1', app: 'shop', release: 'v1.2.3', sentAt: 1700000000 });
    rum.dispose();
  });

  it('routes transport errors to onTransportError', async () => {
    const onTransportError = vi.fn();
    const rum = startRum({
      transport: async () => { throw new Error('net'); },
      onTransportError,
      flushIntervalMs: 0,
      session: 's',
    });
    rum.enqueue({ type: 'metric', ts: 1, data: { name: 'x', value: 1 } });
    await rum.flush();
    expect(onTransportError).toHaveBeenCalledOnce();
    rum.dispose();
  });

  it('dispose detaches global handlers — later reports are ignored', async () => {
    const { rum, batches } = collector({ batchSize: 100 });
    rum.dispose();
    reportMetric({ name: 'after-dispose', value: 1 });
    await rum.flush().catch(() => {});
    expect(batches).toHaveLength(0);
  });

  it('endpoint-form uses navigator.sendBeacon when present', async () => {
    const sendBeacon = vi.fn(() => true);
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon }, configurable: true, writable: true });
    try {
      const rum = startRum({ endpoint: 'https://rum.example.com/ingest', flushIntervalMs: 0, session: 's' });
      rum.enqueue({ type: 'metric', ts: 1, data: { name: 'x', value: 1 } });
      await rum.flush();
      expect(sendBeacon).toHaveBeenCalledOnce();
      expect(sendBeacon.mock.calls[0]![0]).toBe('https://rum.example.com/ingest');
      rum.dispose();
    } finally {
      if (originalDesc) Object.defineProperty(globalThis, 'navigator', originalDesc);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  it('falls back to fetch when sendBeacon is unavailable', async () => {
    const fetchSpy = vi.fn(async () => new Response('', { status: 204 }));
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
    try {
      const rum = startRum({ endpoint: 'https://rum.example.com/ingest', flushIntervalMs: 0, session: 's' });
      rum.enqueue({ type: 'metric', ts: 1, data: { name: 'x', value: 1 } });
      await rum.flush();
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy.mock.calls[0]![1]?.method).toBe('POST');
      rum.dispose();
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
      if (originalDesc) Object.defineProperty(globalThis, 'navigator', originalDesc);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
  });
});
