/**
 * @jorvel/observability — log-drain sinks (Datadog / Logtail / generic HTTP).
 *
 * Batches {@link LogEntry} records and POSTs them to a log platform via
 * `fetch` — no SDK dependency. Use as the `sink` for `createLogger`, or drive
 * it directly. Flushes on a size threshold and on an interval; call `flush()`
 * before shutdown.
 */

import type { LogEntry } from '../logger.js';

export type LogFetch = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;

export interface LogDrain {
  /** Queue a log entry (batched). */
  log(entry: LogEntry): void;
  /** Ship the current batch now. */
  flush(): Promise<void>;
  /** Number of buffered entries. */
  readonly pending: number;
}

interface BaseDrainOptions {
  /** Max entries before an automatic flush. Default 50. */
  batchSize?: number;
  /** Injected fetch (defaults to global). */
  fetch?: LogFetch;
  /** Called when a flush fails (default: swallow). */
  onError?: (err: unknown) => void;
}

function createDrain(
  send: (batch: LogEntry[], fetchImpl: LogFetch) => Promise<void>,
  opts: BaseDrainOptions,
): LogDrain {
  const batchSize = opts.batchSize ?? 50;
  const fetchImpl = opts.fetch ?? ((globalThis as { fetch?: LogFetch }).fetch as LogFetch);
  let buffer: LogEntry[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      await send(batch, fetchImpl);
    } catch (err) {
      opts.onError?.(err);
    }
  };

  return {
    get pending() { return buffer.length; },
    log(entry) {
      buffer.push(entry);
      if (buffer.length >= batchSize) void flush();
    },
    flush,
  };
}

export interface DatadogDrainOptions extends BaseDrainOptions {
  apiKey: string;
  /** DD site. Default `datadoghq.com`. EU: `datadoghq.eu`. */
  site?: string;
  service?: string;
  source?: string;
}

/** Ship logs to Datadog's HTTP intake (`/api/v2/logs`). */
export function datadogDrain(opts: DatadogDrainOptions): LogDrain {
  const site = opts.site ?? 'datadoghq.com';
  const endpoint = `https://http-intake.logs.${site}/api/v2/logs`;
  return createDrain(async (batch, fetchImpl) => {
    const body = batch.map((e) => ({
      ddsource: opts.source ?? 'jorvel',
      service: opts.service ?? 'jorvel',
      status: e.level,
      message: e.msg,
      ...e.ctx,
      timestamp: e.time,
    }));
    await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'DD-API-KEY': opts.apiKey },
      body: JSON.stringify(body),
    });
  }, opts);
}

export interface LogtailDrainOptions extends BaseDrainOptions {
  token: string;
  /** Ingest endpoint. Default Better Stack's `https://in.logs.betterstack.com`. */
  endpoint?: string;
}

/** Ship logs to Logtail / Better Stack. */
export function logtailDrain(opts: LogtailDrainOptions): LogDrain {
  const endpoint = opts.endpoint ?? 'https://in.logs.betterstack.com';
  return createDrain(async (batch, fetchImpl) => {
    const body = batch.map((e) => ({ dt: e.time, level: e.level, message: e.msg, ...e.ctx }));
    await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.token}` },
      body: JSON.stringify(body),
    });
  }, opts);
}

export interface HttpDrainOptions extends BaseDrainOptions {
  endpoint: string;
  headers?: Record<string, string>;
}

/** Ship logs to any HTTP endpoint as a JSON array. */
export function httpDrain(opts: HttpDrainOptions): LogDrain {
  return createDrain(async (batch, fetchImpl) => {
    await fetchImpl(opts.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
      body: JSON.stringify(batch),
    });
  }, opts);
}
