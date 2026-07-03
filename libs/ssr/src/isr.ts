/**
 * @jorvel/ssr — request-time ISR (Incremental Static Regeneration).
 *
 * Stale-while-revalidate for SSR HTML: serve a cached page instantly; when it's
 * older than `revalidateMs`, serve the stale copy AND re-render in the
 * background so the next request is fresh. Complements build-time
 * `revalidateStaticPages` and the `LruHtmlCache`.
 *
 * Bring any {@link HtmlCache} (in-memory default, or a Redis/KV-backed one for
 * multi-instance). Deduplicates concurrent background regenerations per key.
 */

import type { HtmlCache, HtmlCacheEntry } from './html-cache.js';

export interface IsrRenderResult {
  html: string;
  status?: number;
  etag?: string;
}

export interface ServeIsrOptions {
  cache: HtmlCache;
  key: string;
  /** Produce a fresh page. Called on miss and (in the background) when stale. */
  render: () => Promise<IsrRenderResult> | IsrRenderResult;
  /** Serve cached HTML younger than this without regenerating (ms). */
  revalidateMs: number;
  /** Clock (testable). */
  now?: () => number;
}

export interface ServeIsrResult {
  html: string;
  status: number;
  etag: string;
  /** true when served from cache (fresh OR stale). */
  cached: boolean;
  /** true when served stale + a background revalidation was kicked off. */
  stale: boolean;
}

// Per-key in-flight background regenerations, so a burst of stale hits triggers
// exactly one re-render. Pinned to globalThis to survive duplicate bundles.
const INFLIGHT_KEY = '__JORVEL_ISR_INFLIGHT__';
function inflight(): Map<string, Promise<void>> {
  const g = globalThis as Record<string, unknown>;
  if (!g[INFLIGHT_KEY]) g[INFLIGHT_KEY] = new Map<string, Promise<void>>();
  return g[INFLIGHT_KEY] as Map<string, Promise<void>>;
}

function weakEtag(html: string): string {
  // Small FNV-1a — cheap, stable, not cryptographic.
  let h = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) {
    h ^= html.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `W/"${(h >>> 0).toString(16)}"`;
}

async function regenerate(opts: ServeIsrOptions, now: number): Promise<HtmlCacheEntry> {
  const r = await opts.render();
  const entry: HtmlCacheEntry = {
    html: r.html,
    status: r.status ?? 200,
    etag: r.etag ?? weakEtag(r.html),
    storedAt: now,
  };
  await opts.cache.set(opts.key, entry);
  return entry;
}

/**
 * Serve `key` with ISR semantics. Fresh → cache hit; stale → serve stale +
 * background regenerate; miss → render synchronously and cache.
 */
export async function serveWithISR(opts: ServeIsrOptions): Promise<ServeIsrResult> {
  const now = (opts.now ?? Date.now)();
  const existing = await opts.cache.get(opts.key);

  if (existing) {
    const age = now - existing.storedAt;
    if (age < opts.revalidateMs) {
      return { html: existing.html, status: existing.status, etag: existing.etag, cached: true, stale: false };
    }
    // Stale: serve now, regenerate in the background (deduped per key).
    const map = inflight();
    if (!map.has(opts.key)) {
      const p = regenerate(opts, now)
        .then(() => {}, () => { /* keep stale entry on failure */ })
        .finally(() => { map.delete(opts.key); });
      map.set(opts.key, p);
    }
    return { html: existing.html, status: existing.status, etag: existing.etag, cached: true, stale: true };
  }

  // Miss: render synchronously.
  const fresh = await regenerate(opts, now);
  return { html: fresh.html, status: fresh.status, etag: fresh.etag, cached: false, stale: false };
}

/** Await any in-flight background regeneration for a key (tests / graceful shutdown). */
export function awaitIsrRevalidation(key: string): Promise<void> {
  return inflight().get(key) ?? Promise.resolve();
}
