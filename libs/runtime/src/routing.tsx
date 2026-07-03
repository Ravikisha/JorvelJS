/**
 * @jorvel/runtime — React routing components & hooks
 *
 * Provides:
 *   useRouter()     — access the singleton Router instance
 *   usePathname()   — reactive current pathname string
 *   NavLink         — navigation link with active highlighting
 *   RemoteOutlet    — renders the matched federated remote for the current pathname
 */

import React from 'react';
import { createRouter, dispatchJorvelNavigate, type Router, type RouterOptions } from './router.js';
import { getServerRouter } from './server-router.js';
import { resolveRoute, type RouteTarget, type ResolvedRoute } from './routes.js';
import { ErrorBoundary } from './error-boundary.js';
import { prefetchRoute } from './prefetch.js';
import { matchPath } from './route-matcher.js';
import type { FederationRemote } from './remote-loader.js';

// ── Singleton router (pinned to globalThis for MF-singleton survival) ──────

const ROUTER_KEY = '__JORVEL_ROUTER_SINGLETON__';
type GlobalWithRouter = typeof globalThis & { [ROUTER_KEY]?: Router };

export function getRouter(opts?: RouterOptions): Router {
  // SSR: never construct a browser router (createRouter asserts `window` and
  // would throw, taking down usePathname/RemoteOutlet/NestedRouter/useSearchParams
  // server-side). Use the request-scoped server router instead.
  if (typeof window === 'undefined') return getServerRouter();
  const g = globalThis as GlobalWithRouter;
  if (!g[ROUTER_KEY]) g[ROUTER_KEY] = createRouter(opts);
  return g[ROUTER_KEY];
}

/** @internal */
export function _resetRouter() {
  const g = globalThis as GlobalWithRouter;
  g[ROUTER_KEY]?.destroy();
  delete g[ROUTER_KEY];
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useRouter(): Router {
  return getRouter();
}

export function usePathname(): string {
  const router = getRouter();
  const [pathname, setPathname] = React.useState(() => {
    // router.getPath() is safe on both the browser router and the SSR server
    // router, so the SSR initial value matches the rendered request path
    // (avoids a hydration mismatch when the path isn't "/").
    try {
      return new URL(router.getPath(), 'http://jorvel.local').pathname;
    } catch {
      return '/';
    }
  });

  React.useEffect(() => {
    const unsub = router.subscribe((path) => {
      const p = new URL(path, 'http://jorvel.local').pathname;
      setPathname(p);
    });
    return unsub;
  }, [router]);

  return pathname;
}

// ── NavLink ────────────────────────────────────────────────────────────────

export type NavLinkProps = {
  to: string;
  label: string;
  currentPath?: string;
  className?: string;
  style?: React.CSSProperties;
  activeStyle?: React.CSSProperties;
  children?: React.ReactNode;
  prefetch?: boolean | NavLinkPrefetchConfig;
};

export interface NavLinkPrefetchConfig {
  routes: RouteTarget[];
  remotes: Record<string, FederationRemote>;
}

const PrefetchContext = React.createContext<NavLinkPrefetchConfig | null>(null);

export function NavLinkPrefetchProvider({
  config,
  children,
}: {
  config: NavLinkPrefetchConfig;
  children: React.ReactNode;
}) {
  return <PrefetchContext.Provider value={config}>{children}</PrefetchContext.Provider>;
}

const NAV_LINK_DEFAULT_STYLE: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  marginLeft: 8,
  cursor: 'pointer',
};

export function NavLink({
  to,
  label,
  currentPath: currentPathProp,
  className,
  style,
  activeStyle,
  children,
  prefetch,
}: NavLinkProps) {
  const pathname = usePathname();
  const currentPath = currentPathProp ?? pathname;
  const contextPrefetch = React.useContext(PrefetchContext);

  // Strip wildcard suffixes; reject mid-pattern stars by treating only `/*`
  // suffix as removable. Pattern like `/a/*/b` becomes `/a/*/b` literal which
  // won't startsWith-match the actual path — desired behavior.
  const cleanTo = to.endsWith('/*') ? to.slice(0, -2) || '/' : to;
  // Use a `+ '/'` boundary so `/foo` doesn't match `/foobar`.
  const isActive =
    cleanTo === '/'
      ? currentPath === '/'
      : currentPath === cleanTo || currentPath.startsWith(cleanTo + '/');

  const testId =
    'nav-' +
    (cleanTo
      .replace(/\//g, '-')
      .replace(/^-/, '')
      .replace(/-$/, '') || 'home');

  const dynamicStyle: React.CSSProperties = React.useMemo(
    () => ({
      ...NAV_LINK_DEFAULT_STYLE,
      background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
      fontWeight: isActive ? 700 : 400,
    }),
    [isActive],
  );

  const prefetchConfig: NavLinkPrefetchConfig | null =
    prefetch === true
      ? contextPrefetch
      : prefetch && typeof prefetch === 'object'
        ? prefetch
        : null;

  const triggerPrefetch = React.useCallback(() => {
    if (!prefetchConfig) return;
    void prefetchRoute(cleanTo || '/', prefetchConfig);
  }, [cleanTo, prefetchConfig]);

  return (
    <a
      data-testid={testId}
      href={cleanTo || '/'}
      className={className}
      style={{ ...dynamicStyle, ...(style ?? {}), ...(isActive ? (activeStyle ?? {}) : {}) }}
      onClick={(e) => {
        // Let the browser handle "open in new tab/window" and non-primary
        // clicks natively — only hijack a plain left-click for SPA navigation.
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        dispatchJorvelNavigate({ to: cleanTo || '/' });
      }}
      onMouseEnter={triggerPrefetch}
      onFocus={triggerPrefetch}
      onTouchStart={triggerPrefetch}
    >
      {children ?? label}
    </a>
  );
}

// ── RemoteOutlet ───────────────────────────────────────────────────────────

export type RemoteOutletProps = {
  routes: RouteTarget[];
  remotes: Record<string, () => Promise<{ default: React.ComponentType<{ subpath?: string }> }>>;
  fallback?: React.ReactNode;
  noMatch?: React.ReactNode;
  /** LRU max size for the remote-component cache. Default 32. */
  cacheMax?: number;
};

function getSubpath(params: Record<string, string>): string {
  const wildcard = params['*'];
  if (wildcard == null) return '/';
  return wildcard.startsWith('/') ? wildcard : `/${wildcard}`;
}

// Module-level LRU cache shared across all RemoteOutlet instances. Two
// outlets on the same page therefore dedupe imports.
class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number) {}
  get(k: K): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: K, v: V): void {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }
}

const REMOTE_CACHE_KEY = '__JORVEL_REMOTE_OUTLET_CACHE__';
type GlobalWithRemoteCache = typeof globalThis & {
  [REMOTE_CACHE_KEY]?: LRU<string, React.ComponentType<{ subpath?: string }>>;
};

function getRemoteCache(max: number): LRU<string, React.ComponentType<{ subpath?: string }>> {
  const g = globalThis as GlobalWithRemoteCache;
  if (!g[REMOTE_CACHE_KEY]) g[REMOTE_CACHE_KEY] = new LRU(max);
  return g[REMOTE_CACHE_KEY];
}

export function RemoteOutlet({
  routes,
  remotes,
  fallback,
  noMatch,
  cacheMax = 32,
}: RemoteOutletProps) {
  const pathname = usePathname();

  const resolved: ResolvedRoute | null = React.useMemo(
    () => resolveRoute(routes, pathname),
    [routes, pathname],
  );

  const remoteKey = resolved
    ? `${resolved.target.remote}::${resolved.target.module ?? './App'}`
    : null;

  const [Remote, setRemote] = React.useState<React.ComponentType<{ subpath?: string }> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const subpath = resolved ? getSubpath(resolved.params) : '/';

  // Stash the latest `remotes` map in a ref so the effect's deps stay narrow
  // (just remoteKey) — without this, every parent render that re-creates the
  // map triggers a re-import.
  const remotesRef = React.useRef(remotes);
  React.useEffect(() => { remotesRef.current = remotes; }, [remotes]);

  React.useEffect(() => {
    setError(null);
    if (!resolved || !remoteKey) {
      setRemote(null);
      setLoading(false);
      return;
    }

    const cache = getRemoteCache(cacheMax);
    const cached = cache.get(remoteKey);
    if (cached) {
      setRemote(() => cached);
      setLoading(false);
      return;
    }

    setLoading(true);

    const importer = remotesRef.current[resolved.target.remote];
    if (!importer) {
      setError(`No importer registered for remote "${resolved.target.remote}"`);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    importer()
      .then((m) => {
        if (signal.aborted) return;
        cache.set(remoteKey, m.default);
        setRemote(() => m.default);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [remoteKey, cacheMax, resolved]);

  if (loading) return <>{fallback ?? <p data-testid="loading-remote" style={{ color: '#888' }}>Loading remote…</p>}</>;
  if (error) return <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!Remote) return <>{noMatch ?? <p style={{ color: '#888' }}>404 — No route matched.</p>}</>;

  return (
    <ErrorBoundary
      fallback={({ error: boundaryError }) => (
        <pre
          style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}
          data-testid="remote-render-error"
        >
          {boundaryError instanceof Error ? boundaryError.message : String(boundaryError)}
        </pre>
      )}
    >
      <Remote subpath={subpath} />
    </ErrorBoundary>
  );
}

// ── RemoteApp ───────────────────────────────────────────────────────────────

export type RemoteAppProps = {
  subpath?: string;
  pages: Array<{
    path: string;
    load: () => Promise<{ default: React.ComponentType<{ params?: Record<string, string> }> }>;
  }>;
  fallback?: React.ReactNode;
  noMatch?: React.ReactNode;
};

export function RemoteApp({ subpath = '/', pages, fallback, noMatch }: RemoteAppProps) {
  const [Component, setComponent] = React.useState<React.ComponentType<{ params?: Record<string, string> }> | null>(null);
  const [params, setParams] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Stable pages reference. We hash the pattern list so unrelated parent
  // re-renders that pass a fresh array don't restart the load.
  const pagesKey = React.useMemo(() => pages.map((p) => p.path).join('|'), [pages]);
  const pagesRef = React.useRef(pages);
  React.useEffect(() => { pagesRef.current = pages; }, [pages]);

  React.useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    (async () => {
      const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`;
      for (const p of pagesRef.current) {
        const m = matchPath(p.path, normalized);
        if (!m) continue;
        const mod = await p.load();
        if (signal.aborted) return;
        setComponent(() => mod.default);
        setParams(m.params);
        setLoading(false);
        return;
      }
      if (!signal.aborted) {
        setComponent(null);
        setLoading(false);
      }
    })().catch((e: unknown) => {
      if (signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });

    return () => { controller.abort(); };
  }, [subpath, pagesKey]);

  if (loading) return <>{fallback ?? <p data-testid="loading-page" style={{ color: '#888' }}>Loading page…</p>}</>;
  if (error) return <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>;

  return (
    <div
      data-testid="remote-loaded"
      style={{ padding: 16, border: `2px solid ${Component ? '#6366f1' : '#f87171'}`, borderRadius: 8 }}
    >
      {Component
        ? <Component params={params} />
        : (noMatch ?? <p>404 — No page found for subpath: <code>{subpath}</code></p>)
      }
    </div>
  );
}
