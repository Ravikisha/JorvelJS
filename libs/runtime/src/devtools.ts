/**
 * Federation devtools — exposes a `window.__JORVEL__` namespace that surfaces
 * the live federation state for browser dev-extensions / DOM-inspectable
 * introspection.
 *
 * Read-only — never mutate the registry from outside the runtime.
 *
 * ```js
 * window.__JORVEL__.remotes        // { dashboard: { entryUrl, loadedAtMs, integrity? } }
 * window.__JORVEL__.shareScope     // current federation share scope
 * window.__JORVEL__.timings        // [{ name, durationMs, ts }, ...]
 * window.__JORVEL__.version        // runtime semver
 * ```
 */

const KEY = '__JORVEL__';
const VERSION = '0.2.0';

export interface FederationDevtoolsSnapshot {
  version: string;
  remotes: Record<string, RemoteSnapshot>;
  shareScope: Record<string, unknown> | null;
  timings: LoadTiming[];
}

export interface RemoteSnapshot {
  /** URL of the entryUrl actually loaded. */
  entryUrl: string;
  /** ms since epoch when the remote loaded. */
  loadedAtMs: number;
  /** SRI hash, if the loader enforced one. */
  integrity?: string;
}

export interface LoadTiming {
  /** Remote name. */
  name: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** ms since epoch when the timing was recorded. */
  ts: number;
}

type G = typeof globalThis & {
  __JORVEL__?: FederationDevtoolsSnapshot;
  __JORVEL_REMOTE_URLS__?: Record<string, string>;
  __federation_shared__?: Record<string, unknown>;
};

function root(): FederationDevtoolsSnapshot {
  const g = globalThis as G;
  if (!g.__JORVEL__) {
    g.__JORVEL__ = {
      version: VERSION,
      remotes: {},
      shareScope: null,
      timings: [],
    };
  }
  return g.__JORVEL__;
}

/** Record a successful remote load. Called by the loader. */
export function devtoolsRecordRemote(
  name: string,
  entryUrl: string,
  opts: { integrity?: string } = {},
): void {
  const r = root();
  const snap: RemoteSnapshot = { entryUrl, loadedAtMs: Date.now() };
  if (opts.integrity) snap.integrity = opts.integrity;
  r.remotes[name] = snap;
  const g = globalThis as G;
  r.shareScope = g.__federation_shared__ ?? null;
}

/** Record a load-timing sample. Bounded to 200 most-recent. */
export function devtoolsRecordTiming(name: string, durationMs: number): void {
  const r = root();
  r.timings.push({ name, durationMs, ts: Date.now() });
  if (r.timings.length > 200) r.timings.shift();
}

/** Read the current snapshot (for tests + the devtools panel). */
export function getDevtoolsSnapshot(): FederationDevtoolsSnapshot {
  return root();
}

/** Reset state — tests + hard navigations. */
export function _resetDevtools(): void {
  const g = globalThis as G;
  delete g.__JORVEL__;
}
