/**
 * Real User Monitoring (RUM) collector.
 *
 * Buffers metric / error / remote-load events and ships them to a beacon
 * endpoint in batches. Honors:
 *   - flush on `visibilitychange === 'hidden'` (page-unload safe via sendBeacon)
 *   - flush on buffer threshold (default 20)
 *   - periodic flush interval (default 10s)
 *   - sampling (rate 0..1, applied per event)
 *
 * The transport is pluggable so unit tests don't need `navigator.sendBeacon`.
 */

import { onError, onMetric, onRemoteLoad, type ErrorEvent, type MetricEvent, type RemoteLoadEvent } from './hooks.js';

export type RumEvent =
  | { type: 'metric'; ts: number; data: MetricEvent }
  | { type: 'error'; ts: number; data: ErrorEvent }
  | { type: 'remote-load'; ts: number; data: RemoteLoadEvent };

export interface RumBatch {
  session: string;
  release?: string | undefined;
  /** Build-time-injected app name / surface so server-side can split dashboards. */
  app?: string | undefined;
  /** Page URL at the moment the batch was assembled. */
  url?: string | undefined;
  /** Wall-clock ms when the batch was assembled. */
  sentAt: number;
  events: RumEvent[];
}

export type RumTransport = (batch: RumBatch) => void | Promise<void>;

export interface RumOptions {
  endpoint?: string;
  /** Custom transport — preferred over `endpoint` for tests + non-browser. */
  transport?: RumTransport;
  /** Max events queued before an automatic flush. Default: 20. */
  batchSize?: number;
  /** Flush cadence in ms (set 0 to disable periodic flushing). Default: 10000. */
  flushIntervalMs?: number;
  /** Drop events that overflow the queue past this size. Default: 200. */
  maxQueueSize?: number;
  /** Sampling probability in [0,1]. Default: 1. */
  sampleRate?: number;
  /** Override the RNG (testing). Returns 0..1. */
  random?: () => number;
  /** Identifier for the session — pinned for the lifetime of the collector. */
  session?: string;
  app?: string;
  release?: string;
  /** Override Date.now (testing). */
  now?: () => number;
  /** Filter — return false to drop the event. */
  filter?: (event: RumEvent) => boolean;
  /** Called when transport throws — defaults to swallow. */
  onTransportError?: (err: unknown) => void;
}

export interface RumCollector {
  flush(): Promise<void>;
  dispose(): void;
  /** Read-only — number of events currently queued. */
  readonly queued: number;
  /** Push an event directly (bypasses the global hook fan-out). */
  enqueue(event: RumEvent): void;
}

function defaultTransport(endpoint: string): RumTransport {
  return async (batch) => {
    const body = JSON.stringify(batch);
    if (typeof navigator !== 'undefined' && typeof (navigator as Navigator & { sendBeacon?: (u: string, b: string) => boolean }).sendBeacon === 'function') {
      try {
        const ok = (navigator as Navigator & { sendBeacon: (u: string, b: string) => boolean }).sendBeacon(endpoint, body);
        if (ok) return;
      } catch {
        // fall through to fetch
      }
    }
    if (typeof fetch === 'function') {
      await fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json' },
        keepalive: true,
      });
    }
  };
}

function makeSession(rng: () => number): string {
  const hex = Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0');
  const tail = Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0');
  return `${hex}${tail}`;
}

export function startRum(opts: RumOptions = {}): RumCollector {
  const transport = opts.transport ?? (opts.endpoint ? defaultTransport(opts.endpoint) : null);
  if (!transport) throw new Error('[jorvel/observability] startRum requires either `transport` or `endpoint`');

  const batchSize = Math.max(1, opts.batchSize ?? 20);
  const flushIntervalMs = opts.flushIntervalMs ?? 10_000;
  const maxQueueSize = Math.max(1, opts.maxQueueSize ?? Math.max(batchSize, 200));
  const sampleRate = opts.sampleRate ?? 1;
  const rng = opts.random ?? Math.random;
  const now = opts.now ?? Date.now;
  const session = opts.session ?? makeSession(rng);

  let queue: RumEvent[] = [];
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let droppedSinceLastFlush = 0;

  // Sample once per session, not per event — per-event sampling shreds a session
  // into a random subset of its own events (useless for reconstructing a trace).
  const sessionSampled = sampleRate >= 1 || rng() < sampleRate;

  const enqueue = (event: RumEvent) => {
    if (disposed) return;
    if (!sessionSampled) return;
    if (opts.filter && !opts.filter(event)) return;
    if (queue.length >= maxQueueSize) {
      queue.shift();
      droppedSinceLastFlush++;
    }
    queue.push(event);
    if (queue.length >= batchSize) {
      // Schedule async so the producer is never re-entered.
      void Promise.resolve().then(() => void flush());
    }
  };

  const flush = async (): Promise<void> => {
    if (queue.length === 0) return;
    const events = queue;
    queue = [];
    const batch: RumBatch = {
      session,
      release: opts.release,
      app: opts.app,
      url: typeof location !== 'undefined' ? location.href : undefined,
      sentAt: now(),
      events,
    };
    if (droppedSinceLastFlush > 0) {
      batch.events.unshift({
        type: 'metric',
        ts: now(),
        data: { name: 'rum.dropped', value: droppedSinceLastFlush, unit: 'count' },
      });
      droppedSinceLastFlush = 0;
    }
    try {
      await transport(batch);
    } catch (err) {
      opts.onTransportError?.(err);
    }
  };

  const offError = onError((data) => enqueue({ type: 'error', ts: now(), data }));
  const offMetric = onMetric((data) => enqueue({ type: 'metric', ts: now(), data }));
  const offRemote = onRemoteLoad((data) => enqueue({ type: 'remote-load', ts: now(), data }));

  if (flushIntervalMs > 0 && typeof setInterval === 'function') {
    timer = setInterval(() => void flush(), flushIntervalMs);
    // Prevent the interval from holding the event loop open in Node.
    const timerRef = timer as unknown as { unref?: () => void };
    if (timerRef && typeof timerRef.unref === 'function') {
      timerRef.unref();
    }
  }

  const onHidden = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') void flush();
  };
  // pagehide is more reliable than visibilitychange on iOS Safari (which may not
  // fire visibilitychange before the page is frozen/terminated).
  const onPageHide = () => void flush();
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', onHidden);
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', onPageHide);
  }

  return {
    enqueue,
    flush,
    get queued() {
      return queue.length;
    },
    dispose() {
      if (disposed) return;
      // Flush buffered events BEFORE marking disposed — otherwise teardown
      // silently drops everything still queued.
      void flush();
      disposed = true;
      offError();
      offMetric();
      offRemote();
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onHidden);
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('pagehide', onPageHide);
      }
    },
  };
}
