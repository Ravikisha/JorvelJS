export type EventMap = Record<string, unknown>;

export { connectBroadcast } from './broadcast.js';
export type {
  BroadcastConnection,
  ConnectBroadcastOptions,
} from './broadcast.js';

export { attachSchemaRegistry } from './schema.js';
export type {
  Validator,
  SchemaMap,
  AttachSchemaOptions,
  SchemaRegistryHandle,
} from './schema.js';

export type Handler<T> = (payload: T) => void;
export type WildcardHandler<Events extends EventMap> = <K extends keyof Events>(
  event: K,
  payload: Events[K],
) => void;
export type ErrorHandler = (err: unknown, event: string) => void;
export type Unsubscribe = () => void;

interface OnOptions {
  /** Replay the most recent event of this name to the new subscriber. */
  replay?: boolean;
}

export interface EventBusOptions {
  errorHandler?: ErrorHandler;
  /**
   * Maximum distinct event names retained in the replay buffer. When the count
   * exceeds this, the oldest-inserted name's last payload is evicted (LRU-ish:
   * insertion order, refreshed on each emit). Default: 64. Set `Infinity` to
   * keep the legacy unbounded behavior.
   */
  maxLastKeys?: number;
}

/**
 * Lightweight typed publish/subscribe event bus with wildcard support, optional
 * replay-on-subscribe, and per-bus error handlers so a single throwing
 * listener cannot abort iteration.
 */
export class EventBus<Events extends EventMap = EventMap> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};
  private wildcards = new Set<WildcardHandler<Events>>();
  private last = new Map<keyof Events, Events[keyof Events]>();
  private errorHandlers = new Set<ErrorHandler>();
  private maxLastKeys: number;

  constructor(opts: EventBusOptions = {}) {
    if (opts.errorHandler) this.errorHandlers.add(opts.errorHandler);
    this.maxLastKeys = opts.maxLastKeys ?? 64;
  }

  private emitError(err: unknown, event: string): void {
    if (this.errorHandlers.size === 0) {
      defaultErrorHandler(err, event);
      return;
    }
    for (const h of [...this.errorHandlers]) {
      try {
        h(err, event);
      } catch {
        /* never let error-handler throw escape */
      }
    }
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof Events>(
    event: K,
    handler: Handler<Events[K]>,
    opts?: OnOptions,
  ): Unsubscribe {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    if (opts?.replay && this.last.has(event)) {
      try {
        handler(this.last.get(event) as Events[K]);
      } catch (err) {
        this.emitError(err, String(event));
      }
    }
    return () => {
      set.delete(handler);
    };
  }

  /** Subscribe to ALL events — useful for logging / devtools. */
  onAny(handler: WildcardHandler<Events>): Unsubscribe {
    this.wildcards.add(handler);
    return () => {
      this.wildcards.delete(handler);
    };
  }

  /** Subscribe exactly once. Handler is removed before its first call. */
  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const wrapper: Handler<Events[K]> = (payload) => {
      try {
        handler(payload);
      } finally {
        unsub();
      }
    };
    // Tag the wrapper with its original so `off(event, handler)` can still
    // cancel a `once()` registration (the set holds the wrapper, not handler).
    (wrapper as { __jorvelOnceOf?: Handler<Events[K]> }).__jorvelOnceOf = handler;
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    const set = this.handlers[event];
    if (!set) return;
    set.delete(handler);
    // Also remove any once()-wrapper registered for this original handler.
    for (const h of [...set]) {
      if ((h as { __jorvelOnceOf?: Handler<Events[K]> }).__jorvelOnceOf === handler) {
        set.delete(h);
      }
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    // Refresh insertion order so most-recently-emitted survives eviction.
    if (this.last.has(event)) this.last.delete(event);
    this.last.set(event, payload as Events[keyof Events]);
    while (this.last.size > this.maxLastKeys) {
      const oldest = this.last.keys().next().value;
      if (oldest === undefined) break;
      this.last.delete(oldest);
    }
    const set = this.handlers[event];
    if (set) {
      for (const handler of [...set]) {
        try {
          handler(payload);
        } catch (err) {
          this.emitError(err, String(event));
        }
      }
    }
    if (this.wildcards.size) {
      for (const handler of [...this.wildcards]) {
        try {
          handler(event, payload);
        } catch (err) {
          this.emitError(err, String(event));
        }
      }
    }
  }

  /** Replay the most recent emission for `event` to a single handler synchronously. */
  replay<K extends keyof Events>(event: K, handler: Handler<Events[K]>): boolean {
    if (!this.last.has(event)) return false;
    try {
      handler(this.last.get(event) as Events[K]);
    } catch (err) {
      this.emitError(err, String(event));
    }
    return true;
  }

  /**
   * Register an error handler. Multiple handlers may coexist — all are
   * notified for each thrown listener. Returns an unsubscribe function.
   *
   * Note: prior API was last-writer-wins (a setter). Existing callers that
   * relied on overwriting can still call `bus.clearErrorHandlers()` first.
   */
  onError(handler: ErrorHandler): Unsubscribe {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /** Drop every registered error handler (defaults to `console.error`). */
  clearErrorHandlers(): void {
    this.errorHandlers.clear();
  }

  clear<K extends keyof Events>(event?: K): void {
    if (event !== undefined) {
      delete this.handlers[event];
      this.last.delete(event);
    } else {
      this.handlers = {};
      this.last.clear();
      this.wildcards.clear();
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers[event]?.size ?? 0;
  }
}

function defaultErrorHandler(err: unknown, event: string): void {
  // eslint-disable-next-line no-console
  console.error(`[jorvel/event-bus] handler for "${event}" threw:`, err);
}

// ── globalThis-pinned singleton ────────────────────────────────────────────

const BUS_KEY = '__JORVEL_EVENT_BUS_SINGLETON__';
type GlobalWithBus = typeof globalThis & { [BUS_KEY]?: EventBus<EventMap> };

export function getEventBus<Events extends EventMap = EventMap>(): EventBus<Events> {
  const g = globalThis as GlobalWithBus;
  if (!g[BUS_KEY]) g[BUS_KEY] = new EventBus<EventMap>();
  return g[BUS_KEY] as unknown as EventBus<Events>;
}

/** @internal */
export function _resetEventBus(): void {
  const g = globalThis as GlobalWithBus;
  delete g[BUS_KEY];
}
