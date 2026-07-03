/**
 * @jorvel/runtime — server-side router utilities
 *
 * The browser router (`router.ts`) uses `window` / `history`. This module
 * provides a minimal request-scoped router safe for SSR. **Do not** rely on a
 * process-level singleton in concurrent SSR — create one router per request
 * with `createServerRouter(path)` (or `withServerRouter(path, fn)` for
 * AsyncLocalStorage scoping when available).
 */

import type { Router, NavigateDetail, RouterOptions } from './router.js';

export type { Router, RouterOptions };

export function createServerRouter(path: string, _opts: RouterOptions = {}): Router {
  const subs = new Set<(p: string) => void>();
  let currentPath = path;

  return {
    getPath() {
      return currentPath;
    },
    subscribe(cb) {
      subs.add(cb);
      cb(currentPath);
      return () => subs.delete(cb);
    },
    navigate(detail: NavigateDetail) {
      currentPath = detail.to;
      for (const cb of [...subs]) cb(currentPath);
    },
    destroy() {
      subs.clear();
    },
  };
}

// ── AsyncLocalStorage-backed request scope ─────────────────────────────────

type RouterStorage = {
  getStore(): Router | undefined;
  run<T>(router: Router, fn: () => T): T;
};

let als: RouterStorage | null = null;
// Cache the in-flight load PROMISE, not just a boolean. The previous version set
// an `attempted` flag synchronously but assigned `als` only after the async
// import resolved — so a second withServerRouter() racing the first got `als ===
// null` back and ran OUTSIDE the AsyncLocalStorage scope, breaking per-request
// isolation (concurrent SSR requests bled into the fallback router). Sharing one
// promise makes every concurrent caller await the same load.
let alsPromise: Promise<RouterStorage | null> | null = null;

function loadAls(): Promise<RouterStorage | null> {
  if (alsPromise) return alsPromise;
  alsPromise = loadAlsOnce();
  return alsPromise;
}

async function loadAlsOnce(): Promise<RouterStorage | null> {
  // Guard for non-Node runtimes (browser, edge) so bundlers can DCE this branch
  // when `process` is statically replaced (rspack DefinePlugin, vite define).
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  if (!proc?.versions?.node) {
    als = null;
    return als;
  }
  try {
    // Indirect import: `new Function('s', 'return import(s)')` hides the
    // `'node:async_hooks'` specifier from rspack/webpack/vite static analyzers
    // so it is never traced into browser bundles. The function is created
    // once per call site; cost is negligible.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function('s', 'return import(s);') as (
      s: string,
    ) => Promise<{ AsyncLocalStorage: unknown }>;
    const spec = ['node', 'async_hooks'].join(':');
    const mod = await dynamicImport(spec);
    type AlsCtor = new () => {
      getStore(): Router | undefined;
      run<T>(router: Router, fn: () => T): T;
    };
    const Ctor = mod.AsyncLocalStorage as AlsCtor;
    const store = new Ctor();
    als = {
      getStore: () => store.getStore(),
      run: (router, fn) => store.run(router, fn),
    };
  } catch {
    als = null;
  }
  return als;
}

/**
 * Run `fn` with a per-request router available via `getServerRouter()`.
 * Falls back to passing the router to `fn` directly when AsyncLocalStorage
 * is unavailable (edge runtimes).
 */
export async function withServerRouter<T>(
  path: string,
  fn: (router: Router) => T | Promise<T>,
): Promise<T> {
  const router = createServerRouter(path);
  try {
    const storage = await loadAls();
    if (storage) {
      return await storage.run(router, () => fn(router));
    }
    return await fn(router);
  } finally {
    router.destroy();
  }
}

/**
 * Get the current request-scoped server router, or fall back to a process
 * singleton when no scope is active.
 *
 * ⚠️ Concurrent SSR without `withServerRouter` will mix requests in the
 * fallback singleton. Always prefer `withServerRouter`.
 */
let _fallbackRouter: Router | null = null;

export function getServerRouter(path = '/'): Router {
  const scoped = als?.getStore();
  if (scoped) return scoped;
  if (!_fallbackRouter) _fallbackRouter = createServerRouter(path);
  return _fallbackRouter;
}

/** Replace the fallback singleton. Tests / single-threaded environments only. */
export function setServerPath(path: string): void {
  _fallbackRouter?.destroy();
  _fallbackRouter = createServerRouter(path);
}

/** @internal */
export function _resetServerRouter(): void {
  _fallbackRouter?.destroy();
  _fallbackRouter = null;
}
