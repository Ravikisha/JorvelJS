/**
 * Per-event payload validators. Any object with `parse(input): T` works (Zod,
 * Valibot, ArkType, custom). Failing payloads are routed to the bus's error
 * handler; you can configure the registry to throw inline instead.
 */

import type { EventBus, EventMap } from './index.js';

export interface Validator<T = unknown> {
  parse(input: unknown): T;
  /** Optional safe variant. Returns `{ success, data }` or `{ success: false, error }`. */
  safeParse?(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
}

export type SchemaMap<Events extends EventMap> = {
  [K in keyof Events]?: Validator<Events[K]>;
};

export interface AttachSchemaOptions {
  /**
   * What to do when an emitted payload fails validation. Default: `'warn'`
   * routes the error through the bus's error handler and lets the emit proceed.
   * `'throw'` re-raises synchronously from `emit`. `'drop'` swallows the event
   * without invoking listeners.
   */
  onInvalid?: 'warn' | 'throw' | 'drop';
  /**
   * Optional logger called whenever a payload is rejected. Receives the event
   * name and the underlying parser error.
   */
  log?: (event: string, error: unknown) => void;
}

export interface SchemaRegistryHandle {
  detach(): void;
}

/**
 * Wrap an EventBus so every `emit` consults the schema map. Returns a handle
 * with a `detach()` to restore the original `emit`.
 */
const SCHEMA_MARK = Symbol.for('jorvel.event-bus.schema.attached');

export function attachSchemaRegistry<Events extends EventMap>(
  bus: EventBus<Events>,
  schemas: SchemaMap<Events>,
  opts: AttachSchemaOptions = {},
): SchemaRegistryHandle {
  const mode = opts.onInvalid ?? 'warn';
  const log = opts.log;

  // Re-entrancy guard: attaching twice would double-wrap emit, and an
  // out-of-order detach would restore a stale wrapper (silently dropping or
  // resurrecting validators). Refuse the second attach until the first detaches.
  const marked = bus as unknown as { [SCHEMA_MARK]?: boolean };
  if (marked[SCHEMA_MARK]) {
    // eslint-disable-next-line no-console
    console.warn('[jorvel/event-bus] attachSchemaRegistry: bus already has a registry; ignoring duplicate.');
    return { detach() {} };
  }
  marked[SCHEMA_MARK] = true;

  const original = bus.emit.bind(bus);

  (bus as { emit: EventBus<Events>['emit'] }).emit = function patched<
    K extends keyof Events,
  >(event: K, payload: Events[K]): void {
    const v = schemas[event];
    if (v) {
      let error: unknown;
      let validatedPayload: Events[K] = payload;
      if (typeof v.safeParse === 'function') {
        const r = v.safeParse(payload);
        if (!r.success) error = r.error;
        else validatedPayload = r.data as Events[K];
      } else {
        try {
          validatedPayload = v.parse(payload) as Events[K];
        } catch (e) {
          error = e;
        }
      }
      if (error) {
        log?.(String(event), error);
        if (mode === 'throw') throw error;
        if (mode === 'drop') return;
        // 'warn' — continue the emit so listeners still see the original payload.
      } else {
        payload = validatedPayload;
      }
    }
    return original(event, payload);
  };

  return {
    detach() {
      (bus as { emit: EventBus<Events>['emit'] }).emit = original;
      delete marked[SCHEMA_MARK];
    },
  };
}
