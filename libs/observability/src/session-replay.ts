/**
 * Tiny privacy-first session-replay sampler.
 *
 * NOT a full DOM-mutation recorder (use rrweb for that). This is a lightweight
 * interaction sampler: it listens for a small set of DOM events, captures a
 * privacy-scrubbed descriptor of each, buffers them in a bounded ring buffer,
 * and periodically (or on demand) flushes the buffer to a `sink` callback.
 *
 * Everything is guarded behind `typeof window` so importing this in SSR / Node
 * is inert. Inputs are masked by default — we never record typed values.
 */

export interface ReplayEvent {
  /** Event type, e.g. `'click'`, `'input'`, `'scroll'`. */
  type: string;
  /** Monotonic-ish timestamp (from the injected clock). */
  ts: number;
  /** CSS-ish selector path to the target, privacy-scrubbed. */
  target?: string;
  /** Coordinates for pointer events. */
  x?: number;
  y?: number;
  /**
   * Captured value for input-like targets. `null` when masked (the default),
   * a length-only hint otherwise — never the raw text unless `maskInputs:false`.
   */
  value?: string | null;
}

export type ReplaySink = (events: ReplayEvent[]) => void | Promise<void>;

/** The subset of an event target we read — keeps DOM typing minimal/portable. */
interface MinimalTarget {
  tagName?: string;
  id?: string;
  className?: unknown;
  getAttribute?(name: string): string | null;
  value?: unknown;
  nodeName?: string;
}

export interface SessionReplayOptions {
  /** Where flushed batches go. Required. */
  sink: ReplaySink;
  /** DOM event types to sample. Default: click, input, scroll, keydown. */
  events?: string[];
  /** Ring-buffer capacity; oldest events drop when full. Default: 100. */
  bufferSize?: number;
  /** Auto-flush cadence in ms (0 disables periodic flush). Default: 5000. */
  flushIntervalMs?: number;
  /** Mask input values (record only a length hint). Default: true. */
  maskInputs?: boolean;
  /** Inject the clock (testing). Default: `Date.now`. */
  now?: () => number;
  /**
   * Event target to attach listeners to (testing / shadow roots). Default:
   * the global `window`.
   */
  target?: {
    addEventListener(type: string, fn: (e: unknown) => void, opts?: unknown): void;
    removeEventListener(type: string, fn: (e: unknown) => void, opts?: unknown): void;
  };
}

export interface SessionReplay {
  /** Manually push an event (bypasses DOM listeners — handy for tests). */
  capture(event: ReplayEvent): void;
  /** Flush buffered events to the sink and clear the buffer. */
  flush(): Promise<void>;
  /** Stop listening, flush, and release the timer. */
  stop(): void;
  /** Number of events currently buffered. */
  readonly buffered: number;
}

const DEFAULT_EVENTS = ['click', 'input', 'scroll', 'keydown'];

function describeTarget(t: MinimalTarget | null | undefined): string | undefined {
  if (!t) return undefined;
  const tag = (t.tagName ?? t.nodeName ?? '').toLowerCase();
  if (!tag) return undefined;
  let sel = tag;
  if (t.id) sel += `#${t.id}`;
  else if (typeof t.className === 'string' && t.className.trim()) {
    const first = t.className.trim().split(/\s+/)[0];
    if (first) sel += `.${first}`;
  }
  return sel;
}

function maskedValue(t: MinimalTarget | null | undefined, mask: boolean): string | null | undefined {
  if (!t || t.value === undefined || t.value === null) return undefined;
  const raw = String(t.value);
  if (mask) {
    // Never leak typed content. Record only a length hint so playback can show
    // a masked field of roughly the right size.
    return raw.length > 0 ? `•[${raw.length}]` : '';
  }
  return raw;
}

/**
 * Create a session-replay sampler. In a non-browser environment (no `window`
 * and no injected `target`) it returns an inert no-op recorder.
 */
export function createSessionReplay(opts: SessionReplayOptions): SessionReplay {
  const bufferSize = Math.max(1, opts.bufferSize ?? 100);
  const flushIntervalMs = opts.flushIntervalMs ?? 5000;
  const maskInputs = opts.maskInputs ?? true;
  const now = opts.now ?? Date.now;
  const eventTypes = opts.events ?? DEFAULT_EVENTS;

  const win = opts.target ?? (typeof window !== 'undefined' ? (window as unknown as SessionReplayOptions['target']) : undefined);

  const buffer: ReplayEvent[] = [];
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const capture = (event: ReplayEvent): void => {
    if (stopped) return;
    if (buffer.length >= bufferSize) buffer.shift(); // ring buffer: drop oldest
    buffer.push(event);
  };

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    try {
      await opts.sink(batch);
    } catch {
      // A failing sink must never break the host page.
    }
  };

  const handler = (e: unknown): void => {
    const evt = e as { type?: string; target?: MinimalTarget; clientX?: number; clientY?: number };
    const type = evt.type ?? 'unknown';
    const target = evt.target;
    const replay: ReplayEvent = { type, ts: now() };
    const sel = describeTarget(target);
    if (sel !== undefined) replay.target = sel;
    if (typeof evt.clientX === 'number') replay.x = evt.clientX;
    if (typeof evt.clientY === 'number') replay.y = evt.clientY;
    if (type === 'input' || type === 'change') {
      const v = maskedValue(target, maskInputs);
      if (v !== undefined) replay.value = v;
    }
    capture(replay);
  };

  if (win) {
    for (const type of eventTypes) {
      win.addEventListener(type, handler, { passive: true, capture: true });
    }
    if (flushIntervalMs > 0 && typeof setInterval === 'function') {
      timer = setInterval(() => void flush(), flushIntervalMs);
      const ref = timer as unknown as { unref?: () => void };
      ref.unref?.();
    }
  }

  return {
    capture,
    flush,
    get buffered() {
      return buffer.length;
    },
    stop() {
      if (stopped) return;
      void flush();
      stopped = true;
      if (win) {
        for (const type of eventTypes) {
          win.removeEventListener(type, handler, { capture: true });
        }
      }
      if (timer) clearInterval(timer);
    },
  };
}
