import { emitRemoteLoad } from './telemetry.js';
import { devtoolsRecordRemote, devtoolsRecordTiming } from './devtools.js';

export type FederationRemote = {
  name: string;
  entryUrl: string;
  /** Optional Subresource Integrity hash, e.g. `sha384-...`. */
  integrity?: string;
};

export type LoadRemoteEntryOptions = {
  /** Max time (ms) to wait for the remote container global to appear after script load. */
  containerGlobalTimeoutMs?: number;
  /** How frequently (ms) to poll for the container global. */
  containerGlobalPollMs?: number;
  /**
   * Optional cache used to record successful remoteEntry loads. Cache stores
   * metadata only and never persists actual JS bytes — for true offline use a
   * service worker cache on `entryUrl`.
   */
  cache?: boolean | RemoteEntryCache;
  /** TTL (ms) for cache entries. Default: 24h. */
  cacheTtlMs?: number;
  /**
   * Allowed origins. When set, the loader rejects entryUrls whose origin is
   * not on the list. `*` matches a single subdomain label; `**` matches
   * multiple.
   */
  allowedOrigins?: string[];
  /**
   * `crossorigin` attribute on the injected `<script>`. Default: `'anonymous'`.
   * Required for `error` reporting to surface the actual error from a
   * cross-origin remote, and for SRI to work with non-CORS-default servers.
   */
  crossOrigin?: 'anonymous' | 'use-credentials' | 'none';
  /**
   * Fail closed when a remote has no `integrity` hash. With this on, a remote
   * that ships without an SRI hash is refused BEFORE any `<script>` is injected
   * — so a compromised/typo'd entryUrl can't run unverified code. Pair with a
   * build-time SRI manifest (`@jorvel/security` `computeSriForManifest`) that
   * stamps `remote.integrity`. Default: false.
   */
  requireIntegrity?: boolean;
};

export type RemoteEntryCacheKey = {
  name: string;
  entryUrl: string;
};

export type RemoteEntryCacheValue = {
  loadedAt: number;
};

export type RemoteEntryCache = {
  get: (key: RemoteEntryCacheKey) => RemoteEntryCacheValue | null;
  set: (key: RemoteEntryCacheKey, value: RemoteEntryCacheValue) => void;
};

function getDefaultRemoteEntryCache(): RemoteEntryCache {
  const storageKey = (k: RemoteEntryCacheKey) => `jorvel.remoteEntry:${k.name}:${k.entryUrl}`;

  return {
    get(key) {
      try {
        const raw = globalThis?.localStorage?.getItem(storageKey(key));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RemoteEntryCacheValue;
        if (typeof parsed?.loadedAt !== 'number') return null;
        return parsed;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        globalThis?.localStorage?.setItem(storageKey(key), JSON.stringify(value));
      } catch {
        /* storage unavailable */
      }
    },
  };
}

export type LoadRemoteModuleOptions = {
  getTimeoutMs?: number;
  factoryTimeoutMs?: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __webpack_init_sharing__: undefined | ((scope: string) => Promise<void>);
  // eslint-disable-next-line no-var
  var __webpack_share_scopes__: undefined | Record<string, unknown>;
  // eslint-disable-next-line no-var
  var __federation_shared__: undefined | Record<string, unknown>;
  // eslint-disable-next-line no-var
  var __federation_init_sharing__: undefined | ((scope: string) => Promise<void>);
}

type Container = {
  init: (shareScope: unknown) => Promise<void>;
  get: (module: string) => Promise<() => unknown>;
};

function getGlobal(): Record<string, unknown> {
  if (typeof globalThis !== 'undefined') return globalThis as unknown as Record<string, unknown>;
  if (typeof window !== 'undefined') return window as unknown as Record<string, unknown>;
  if (typeof self !== 'undefined') return self as unknown as Record<string, unknown>;
  return {};
}

function scriptId(remoteName: string) {
  return `jorvel-remote-${remoteName}`;
}

/**
 * Tracks the entryUrl each loaded container global was registered from, so a
 * later request for a DIFFERENT url under the same name (blue-green promote,
 * weighted canary re-pick, resilience fallback) can tear the old container down
 * and load the new one instead of silently reusing the stale global.
 */
function loadedRemoteUrls(g: Record<string, unknown>): Record<string, string> {
  const KEY = '__JORVEL_REMOTE_URLS__';
  if (!g[KEY]) g[KEY] = {};
  return g[KEY] as Record<string, string>;
}

function isBrowserEnv() {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function compileOriginPattern(origin: string): RegExp | string {
  const lower = origin.replace(/\/$/, '').toLowerCase();
  if (!lower.includes('*')) return lower;
  const placeholder = 'MULTI';
  let working = lower.replace(/\*\*/g, placeholder);
  working = working
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.]+')
    .replace(new RegExp(placeholder, 'g'), '.+');
  return new RegExp(`^${working}$`);
}

function originAllowed(entryUrl: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  let parsed: URL;
  try {
    parsed = new URL(entryUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
  return patterns.map(compileOriginPattern).some((m) => (typeof m === 'string' ? m === origin : m.test(origin)));
}

// In-flight dedupe: concurrent callers see the same Promise; resolved Promises
// stay cached so cache-hit short-circuits still emit `success` telemetry.
const inFlight: Map<string, Promise<void>> = (() => {
  const KEY = '__JORVEL_REMOTE_INFLIGHT__';
  type GlobalWithFlights = typeof globalThis & { [KEY]?: Map<string, Promise<void>> };
  const g = globalThis as GlobalWithFlights;
  if (!g[KEY]) g[KEY] = new Map<string, Promise<void>>();
  return g[KEY];
})();

function flightKey(remote: FederationRemote): string {
  return `${remote.name}|${remote.entryUrl}`;
}

export async function loadRemoteEntry(
  remote: FederationRemote,
  options?: LoadRemoteEntryOptions,
): Promise<void> {
  if (!isBrowserEnv()) {
    throw new Error(
      `loadRemoteEntry("${remote.name}") requires a browser environment (document/window). ` +
        `If you're calling this from SSR, only load remotes on the client.`,
    );
  }

  if (!originAllowed(remote.entryUrl, options?.allowedOrigins)) {
    const err = new Error(
      `[jorvel/runtime] loadRemoteEntry: origin not in allowedOrigins for "${remote.name}" (${remote.entryUrl})`,
    );
    emitRemoteLoad({ remote: remote.name, url: remote.entryUrl, phase: 'error', durationMs: 0, error: err });
    throw err;
  }

  // SRI policy — checked before any DOM work or dedupe so a misconfig fails
  // loud and identically every call.
  if (options?.requireIntegrity && !remote.integrity) {
    const err = new Error(
      `[jorvel/runtime] loadRemoteEntry: requireIntegrity is on but "${remote.name}" has no integrity hash (${remote.entryUrl}). ` +
        `Stamp remote.integrity (e.g. via @jorvel/security computeSriForManifest) or disable requireIntegrity.`,
    );
    emitRemoteLoad({ remote: remote.name, url: remote.entryUrl, phase: 'error', durationMs: 0, error: err });
    throw err;
  }
  // SRI without CORS never enforces — the browser skips integrity checks on
  // no-CORS scripts and runs the bytes anyway. Refuse the silent downgrade.
  if (remote.integrity && options?.crossOrigin === 'none') {
    const err = new Error(
      `[jorvel/runtime] loadRemoteEntry: "${remote.name}" sets integrity but crossOrigin:'none' — SRI is NOT enforced without CORS. ` +
        `Use crossOrigin:'anonymous' (default) or drop the integrity hash.`,
    );
    emitRemoteLoad({ remote: remote.name, url: remote.entryUrl, phase: 'error', durationMs: 0, error: err });
    throw err;
  }

  const key = flightKey(remote);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const g = getGlobal();
    const id = scriptId(remote.name);
    const startedAt = Date.now();
    emitRemoteLoad({ remote: remote.name, url: remote.entryUrl, phase: 'start' });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const timeoutMs = options?.containerGlobalTimeoutMs ?? 500;
    const pollMs = options?.containerGlobalPollMs ?? 25;
    const cacheTtlMs = options?.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    const cache: RemoteEntryCache | null =
      options?.cache === true
        ? getDefaultRemoteEntryCache()
        : typeof options?.cache === 'object'
          ? options.cache
          : null;

    const urls = loadedRemoteUrls(g);

    // URL-change teardown: if WE loaded this name from a DIFFERENT entryUrl,
    // drop the stale container + its <script> so the requested entry can register
    // fresh. Without this the short-circuits below would reuse the old container
    // and the URL switch (blue-green/canary/fallback) would no-op.
    //
    // Only act when we have a RECORDED url that differs. A container present with
    // no recorded url (a test mock, or an SSR-injected/3rd-party global) is left
    // alone — we don't know its url, so we must not assume it's stale.
    if (g[remote.name] && urls[remote.name] !== undefined && urls[remote.name] !== remote.entryUrl) {
      (globalThis.document?.getElementById(id) as HTMLScriptElement | null)?.remove();
      delete g[remote.name];
      delete urls[remote.name];
    }

    if (cache) {
      const cached = cache.get({ name: remote.name, entryUrl: remote.entryUrl });
      if (cached && Date.now() - cached.loadedAt < cacheTtlMs && g[remote.name]) {
        emitRemoteLoad({
          remote: remote.name,
          url: remote.entryUrl,
          phase: 'success',
          durationMs: 0,
        });
        return;
      }
    }

    if (g[remote.name]) {
      emitRemoteLoad({
        remote: remote.name,
        url: remote.entryUrl,
        phase: 'success',
        durationMs: 0,
      });
      return;
    }

    const doc = globalThis.document;
    const existingScript = doc.getElementById(id) as HTMLScriptElement | null;
    if (existingScript) {
      const loaded = existingScript.dataset['jorvelLoaded'] === '1';
      if (loaded && g[remote.name]) {
        emitRemoteLoad({
          remote: remote.name,
          url: remote.entryUrl,
          phase: 'success',
          durationMs: 0,
        });
        return;
      }
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          existingScript.removeEventListener('load', onLoad);
          existingScript.removeEventListener('error', onError);
        };
        const succeed = () => {
          if (settled) return;
          settled = true;
          cleanup();
          existingScript.dataset['jorvelLoaded'] = '1';
          urls[remote.name] = remote.entryUrl;
          emitRemoteLoad({
            remote: remote.name,
            url: remote.entryUrl,
            phase: 'success',
            durationMs: Date.now() - startedAt,
          });
          resolve();
        };
        const fail = (phase: 'error' | 'timeout', err: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          // Remove the failed/stale script so a later retry creates a fresh one
          // instead of re-attaching listeners to a node whose load/error event
          // already fired (which would hang forever).
          existingScript.remove();
          emitRemoteLoad({
            remote: remote.name,
            url: remote.entryUrl,
            phase,
            durationMs: Date.now() - startedAt,
            error: err,
          });
          reject(err);
        };
        const onLoad = () => {
          // The script load fired, but the container global may attach a tick
          // later — poll a short while before declaring success.
          if (g[remote.name]) return succeed();
        };
        const onError = () => fail('error', new Error(`Failed to load remoteEntry: ${remote.entryUrl}`));
        existingScript.addEventListener('load', onLoad, { once: true });
        existingScript.addEventListener('error', onError, { once: true });
        // Poll for the container global with a timeout. This is the authoritative
        // signal: it handles the case where the script's `load` already fired
        // before we attached listeners (SSR-injected tag, duplicate runtime copy),
        // which the event-only wait could never recover from.
        void (async () => {
          const started = Date.now();
          while (!settled) {
            if (g[remote.name]) return succeed();
            if (Date.now() - started >= timeoutMs) {
              return fail(
                'timeout',
                new Error(
                  `Remote container "${remote.name}" not found after waiting ${timeoutMs}ms for existing <script id="${id}">`,
                ),
              );
            }
            await sleep(pollMs);
          }
        })();
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = doc.createElement('script');
      script.id = id;
      script.src = remote.entryUrl;
      script.type = 'text/javascript';
      script.async = true;
      const co = options?.crossOrigin ?? 'anonymous';
      if (co !== 'none') script.crossOrigin = co;
      if (remote.integrity) script.integrity = remote.integrity;

      let settled = false;

      const onLoad = () => {
        if (settled) return;
        settled = true;
        (async () => {
          if (!g[remote.name]) {
            const started = Date.now();
            while (!g[remote.name] && Date.now() - started < timeoutMs) await sleep(pollMs);
          }
          if (!g[remote.name]) {
            // Drop the script so a retry starts clean (see onError).
            script.remove();
            const err = new Error(
              `Remote container "${remote.name}" not found after loading ${remote.entryUrl} (waited ${timeoutMs}ms)`,
            );
            emitRemoteLoad({
              remote: remote.name,
              url: remote.entryUrl,
              phase: 'timeout',
              durationMs: Date.now() - startedAt,
              error: err,
            });
            reject(err);
            return;
          }
          if (cache) cache.set({ name: remote.name, entryUrl: remote.entryUrl }, { loadedAt: Date.now() });
          urls[remote.name] = remote.entryUrl;
          script.dataset['jorvelLoaded'] = '1';
          const dur = Date.now() - startedAt;
          emitRemoteLoad({
            remote: remote.name,
            url: remote.entryUrl,
            phase: 'success',
            durationMs: dur,
          });
          devtoolsRecordRemote(remote.name, remote.entryUrl, {
            ...(remote.integrity ? { integrity: remote.integrity } : {}),
          });
          devtoolsRecordTiming(remote.name, dur);
          resolve();
        })().catch(reject);
      };

      const onError = () => {
        if (settled) return;
        settled = true;
        // Remove the failed <script> from the DOM. Otherwise a retry finds it via
        // getElementById, attaches load/error listeners to a node whose error
        // event already fired, and hangs forever waiting for an event that never
        // comes again.
        script.remove();
        const err = new Error(`Failed to load remoteEntry: ${remote.entryUrl}`);
        emitRemoteLoad({
          remote: remote.name,
          url: remote.entryUrl,
          phase: 'error',
          durationMs: Date.now() - startedAt,
          error: err,
        });
        reject(err);
      };

      // Assign as properties (so direct .onload() calls in tests work) AND
      // listen via addEventListener (so multiple in-flight callers each get
      // notified, not just the last one to set .onload).
      script.onload = onLoad;
      script.onerror = onError;
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      doc.head.appendChild(script);
    });
  })();

  inFlight.set(key, promise);
  // Always drop the cached promise once it settles. Concurrent callers within
  // the same tick still share this promise (that's the dedupe). Callers after
  // settlement are short-circuited by the `g[remote.name]` early return at
  // the top of the body, not by the cache.
  promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }).catch(() => undefined);
  return promise;
}

export async function initRemoteContainer(remoteName: string): Promise<Container> {
  const g = getGlobal();
  const container = g[remoteName] as Container | undefined;

  if (!container) {
    throw new Error(`Remote container not found on global: ${remoteName}`);
  }

  const safeInit = async (shareScope: unknown) => {
    try {
      await container.init(shareScope);
    } catch (err) {
      // Only swallow the expected "container already initialized" case. Other
      // errors (share-scope mismatches, peer dep version conflicts) must
      // surface so they can be debugged.
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /already initiali[sz]ed/i.test(msg) ||
        /init\(\) called twice/i.test(msg) ||
        /Container already loaded/i.test(msg)
      ) {
        return;
      }
      throw err;
    }
  };

  type GlobalsWithMF = typeof g & {
    __federation_init_sharing__?: (scope: string) => Promise<void>;
    __federation_shared__?: Record<string, unknown>;
    __webpack_init_sharing__?: (scope: string) => Promise<void>;
    __webpack_share_scopes__?: Record<string, unknown>;
  };
  const G = g as GlobalsWithMF;

  if (typeof G.__federation_init_sharing__ === 'function') {
    await G.__federation_init_sharing__('default');
    await safeInit(G.__federation_shared__);
    return container;
  }

  if (typeof G.__webpack_init_sharing__ === 'function') {
    await G.__webpack_init_sharing__('default');
    const scopes = G.__webpack_share_scopes__;
    await safeInit(scopes && typeof scopes === 'object' && 'default' in scopes ? (scopes as { default: unknown }).default : scopes);
    return container;
  }

  await safeInit({});
  return container;
}

export async function loadRemoteModule<TModule = unknown>(
  remote: FederationRemote,
  exposedModule: string,
  options?: LoadRemoteModuleOptions & LoadRemoteEntryOptions,
): Promise<TModule> {
  await loadRemoteEntry(remote, options);

  const container = await initRemoteContainer(remote.name);

  const withTimeout = async <T>(label: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> => {
    if (timeoutMs <= 0) return fn();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      // Promise.race ignores a late settle, so clearing the timer is all that's
      // needed; the loser of the race is harmlessly dropped.
      if (timer) clearTimeout(timer);
    }
  };

  const getTimeoutMs = options?.getTimeoutMs ?? 5000;
  const factoryTimeoutMs = options?.factoryTimeoutMs ?? 5000;

  const factory = await withTimeout(
    `container.get("${exposedModule}") from remote "${remote.name}"`,
    getTimeoutMs,
    () => container.get(exposedModule),
  );

  return await withTimeout(
    `factory() for "${remote.name}${exposedModule}"`,
    factoryTimeoutMs,
    async () => (await Promise.resolve(factory())) as TModule,
  );
}
