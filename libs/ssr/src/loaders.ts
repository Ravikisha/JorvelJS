/**
 * Per-route data loaders — getServerSideProps-style data fetching for JORVEL SSR.
 *
 * Each route can register a `defineLoader` that runs before render. The loader
 * receives a `LoaderContext` (URL, params, request, request-context) and may
 * return data, throw `redirect` / `json` / `notFound`, or set headers via the
 * provided helpers. Loaded data is exposed to components via{' '}
 * `useLoaderData<T>()` when the same key is read on the client.
 *
 * Loaders aren't a router replacement — they're a single resolution slot per
 * SSR render, so the data is hydration-ready without a second client fetch.
 */

import type { EdgeRequest } from './types.js';
import type { RequestContext } from './request-context.js';
import { getRequestContext } from './request-context.js';

export interface LoaderContext<P extends Record<string, string> = Record<string, string>> {
  request: EdgeRequest;
  url: URL;
  params: P;
  ctx: RequestContext | undefined;
  /** Set response headers from inside a loader (e.g. `Set-Cookie`). */
  setHeader(name: string, value: string): void;
}

export type LoaderFn<T = unknown, P extends Record<string, string> = Record<string, string>> = (
  c: LoaderContext<P>,
) => Promise<T> | T;

export interface LoaderDescriptor<T> {
  /** Stable key used to read the loaded data on the client. */
  key: string;
  /** The loader function. */
  load: LoaderFn<T>;
  /** Optional `cache-control` for the response when this loader resolves. */
  cacheControl?: string;
}

/** Type-narrowing helper that preserves the loader's return type. */
export function defineLoader<T, P extends Record<string, string> = Record<string, string>>(
  spec: { key: string; load: LoaderFn<T, P>; cacheControl?: string },
): LoaderDescriptor<T> {
  return spec as LoaderDescriptor<T>;
}

// ── Runtime slot — set by the edge adapter, read by components ────────────
//
// CRITICAL: on the server the slot MUST be per-request. It used to be a single
// `globalThis` object, so concurrent Node SSR renders interleaved each other's
// loader data (a cross-request data/PII leak) and the slot accumulated forever.
// We now store it inside the active RequestContext's `locals` bag, which gives
// it exactly the same per-request isolation as the request context itself
// (sync-slot for single-threaded edge runtimes, AsyncLocalStorage opt-in for
// concurrent Node) and lets it be garbage-collected with the request.
//
// On the client (hydration) there is no request context — a single document-wide
// global is correct there, and `setLoaderData` seeds it from the serialized payload.

interface LoaderSlot {
  data: Record<string, unknown>;
  headers: Record<string, string>;
}

const SLOT_KEY = '__JORVEL_LOADER_SLOT__';

/**
 * Resolve the loader slot for the current execution: the active request
 * context's `locals` on the server, or a document-wide global on the client.
 * Pass `create: true` to allocate one if absent.
 */
function activeSlot(create: true): LoaderSlot;
function activeSlot(create?: false): LoaderSlot | undefined;
function activeSlot(create = false): LoaderSlot | undefined {
  const ctx = getRequestContext();
  if (ctx) {
    let s = ctx.locals[SLOT_KEY] as LoaderSlot | undefined;
    if (!s && create) {
      s = { data: {}, headers: {} };
      ctx.locals[SLOT_KEY] = s;
    }
    return s;
  }
  const g = globalThis as Record<string, unknown>;
  if (!g[SLOT_KEY] && create) g[SLOT_KEY] = { data: {}, headers: {} } satisfies LoaderSlot;
  return g[SLOT_KEY] as LoaderSlot | undefined;
}

function slot(): LoaderSlot | undefined {
  return activeSlot(false);
}

function ensureSlot(): LoaderSlot {
  return activeSlot(true);
}

export function _clearLoaderSlot(): void {
  const ctx = getRequestContext();
  if (ctx) {
    delete ctx.locals[SLOT_KEY];
    return;
  }
  delete (globalThis as Record<string, unknown>)[SLOT_KEY];
}

/** Read loaded data by key from inside a component. Returns `undefined` when missing. */
export function useLoaderData<T>(key: string): T | undefined {
  return slot()?.data[key] as T | undefined;
}

/** Same as `useLoaderData` but throws when the slot is missing — for routes that require it. */
export function requireLoaderData<T>(key: string): T {
  const v = slot()?.data[key];
  if (v === undefined) {
    throw new Error(`[jorvel/ssr] No loader data for key "${key}". Did the route register one?`);
  }
  return v as T;
}

/** SSR boot helper to seed the slot from a serialized payload (hydration). */
export function setLoaderData(data: Record<string, unknown>): void {
  const s = ensureSlot();
  s.data = { ...s.data, ...data };
}

// ── Runner used by the edge adapter ───────────────────────────────────────

export interface RunLoadersOptions {
  loaders: LoaderDescriptor<unknown>[];
  request: EdgeRequest;
  params?: Record<string, string>;
}

export interface RunLoadersResult {
  data: Record<string, unknown>;
  headers: Record<string, string>;
  cacheControl?: string;
}

/**
 * Run a list of loaders concurrently and aggregate their data + headers.
 * Throws propagate (a loader can throw `redirect` / `json` / `notFound`).
 */
export async function runLoaders(opts: RunLoadersOptions): Promise<RunLoadersResult> {
  // Resolve the target slot synchronously, while the request context is still
  // active on the (sync) store. The write-back below happens after `await`, by
  // which point a sync-slot store would have restored `current` — re-resolving
  // then would leak the data to the global slot. Capturing it here pins the
  // write to THIS request's slot.
  const targetSlot = ensureSlot();
  const url = new URL(opts.request.url);
  const ctx = getRequestContext();
  const collected: RunLoadersResult = { data: {}, headers: {} };

  const setHeader = (name: string, value: string) => {
    collected.headers[name.toLowerCase()] = value;
  };

  // Run concurrently; the first thrown control-flow error wins.
  const results = await Promise.all(
    opts.loaders.map(async (loader) => {
      const data = await loader.load({
        request: opts.request,
        url,
        params: opts.params ?? {},
        ctx,
        setHeader,
      });
      return { loader, data };
    }),
  );
  for (const { loader, data } of results) {
    collected.data[loader.key] = data;
    if (loader.cacheControl) {
      // Keep the most conservative cacheControl — later cache merging is
      // the adapter's responsibility.
      collected.cacheControl = collected.cacheControl ?? loader.cacheControl;
    }
  }
  targetSlot.data = { ...targetSlot.data, ...collected.data };
  targetSlot.headers = { ...targetSlot.headers, ...collected.headers };
  return collected;
}
