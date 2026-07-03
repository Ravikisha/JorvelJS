import React from 'react';
import { matchPath } from './route-matcher.js';
import { usePathname } from './routing.js';
import { ErrorBoundary, type ErrorBoundaryFallbackProps } from './error-boundary.js';

export interface NestedRoute {
  path: string;
  element?: React.ReactNode;
  lazy?: () => Promise<{ default: React.ComponentType<{ children?: React.ReactNode }> }>;
  children?: NestedRoute[];
  index?: boolean;
  /**
   * Per-segment Suspense fallback — the `loading.tsx` convention. Rendered
   * while this segment's `lazy` component (or any Suspense-throwing descendant
   * up to the next boundary) resolves.
   */
  loading?: React.ReactNode;
  /**
   * Per-segment error UI — the `error.tsx` convention. When a render in this
   * segment (or a descendant below the next error boundary) throws, this
   * fallback renders instead of bubbling to the parent segment. A render fn
   * receives `{ error, reset }`; a bare node is shown as-is.
   */
  errorElement?: React.ReactNode | ((props: ErrorBoundaryFallbackProps) => React.ReactNode);
}

export interface MatchedRoute {
  route: NestedRoute;
  params: Record<string, string>;
  consumed: string;
}

interface OutletContextValue {
  remaining: string;
  chain: MatchedRoute[];
  depth: number;
  params: Record<string, string>;
}

const OutletContext = React.createContext<OutletContextValue | null>(null);

export function Outlet(): React.ReactElement | null {
  const ctx = React.useContext(OutletContext);
  if (!ctx) return null;
  const child = ctx.chain[ctx.depth + 1];
  if (!child) return null;

  const remaining = stripPrefix(ctx.remaining, child.consumed);
  return (
    <OutletContext.Provider
      value={{
        remaining,
        chain: ctx.chain,
        depth: ctx.depth + 1,
        params: { ...ctx.params, ...child.params },
      }}
    >
      <RouteNode route={child.route} />
    </OutletContext.Provider>
  );
}

function RouteContent({ route }: { route: NestedRoute }): React.ReactElement {
  const [El, setEl] = React.useState<React.ComponentType<{ children?: React.ReactNode }> | null>(null);
  const [lazyError, setLazyError] = React.useState<unknown>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (route.lazy) {
      route.lazy().then(
        (m) => !cancelled && setEl(() => m.default),
        (e) => !cancelled && setLazyError(e),
      );
    }
    return () => { cancelled = true; };
  }, [route]);

  // Surface a lazy-import failure to the nearest error boundary (the segment's
  // own `errorElement`, if any). Throwing during render is what an ErrorBoundary
  // catches — rejecting in the effect above would otherwise go unhandled.
  if (lazyError != null) throw lazyError;

  if (route.element) return <>{route.element}</>;
  if (El) return <El />;
  // Lazy still pending — render the segment's loading fallback (the
  // `loading.tsx` convention). RouteNode also wraps us in <Suspense> so any
  // descendant that throws a promise shows the same fallback.
  if (route.lazy) return <>{route.loading ?? null}</>;
  return <></>;
}

/**
 * Renders one matched segment, applying its per-segment `error.tsx`
 * (ErrorBoundary) and `loading.tsx` (Suspense fallback) boundaries. A segment
 * without `errorElement`/`loading` lets errors and pending states bubble to the
 * nearest ancestor that does — matching the Next.js App Router contract.
 */
function RouteNode({ route }: { route: NestedRoute }): React.ReactElement {
  const content = <RouteContent route={route} />;

  const withSuspense =
    route.loading !== undefined
      ? <React.Suspense fallback={route.loading}>{content}</React.Suspense>
      : content;

  if (route.errorElement === undefined) return withSuspense;

  const fallback =
    typeof route.errorElement === 'function'
      ? (route.errorElement as (p: ErrorBoundaryFallbackProps) => React.ReactNode)
      : () => route.errorElement as React.ReactNode;

  return <ErrorBoundary fallback={fallback}>{withSuspense}</ErrorBoundary>;
}

export interface NestedRouterProps {
  routes: NestedRoute[];
  /** Rendered while lazy layouts resolve. */
  fallback?: React.ReactNode;
  /** Rendered when no route matches. */
  notFound?: React.ReactNode;
}

export function NestedRouter({ routes, fallback, notFound }: NestedRouterProps): React.ReactElement {
  const pathname = usePathname();
  const chain = React.useMemo(() => resolveChain(routes, pathname), [routes, pathname]);

  if (chain.length === 0) return <>{notFound ?? <p>404 — no route matched.</p>}</>;

  const root = chain[0]!;
  const remaining = stripPrefix(pathname, root.consumed);
  return (
    <React.Suspense fallback={fallback ?? <span>Loading…</span>}>
      <OutletContext.Provider value={{ remaining, chain, depth: 0, params: root.params }}>
        <RouteNode route={root.route} />
      </OutletContext.Provider>
    </React.Suspense>
  );
}

export function resolveChain(routes: NestedRoute[], pathname: string): MatchedRoute[] {
  const normalized = pathname || '/';
  const out: MatchedRoute[] = [];
  walk(routes, normalized, out);
  return out;
}

function walk(routes: NestedRoute[], remaining: string, out: MatchedRoute[]): boolean {
  for (const route of routes) {
    const isIndex = route.index === true;
    const routePath = isIndex ? '/' : route.path;

    if (isIndex) {
      if (remaining === '/' || remaining === '') {
        out.push({ route, params: {}, consumed: '/' });
        return true;
      }
      continue;
    }

    const hasChildren = !!route.children?.length;
    const patternForMatch = hasChildren ? appendWildcard(routePath) : routePath;
    const m = matchPath(patternForMatch, remaining);
    if (!m) continue;

    const consumed = computeConsumed(routePath, m.params);
    const segmentParams = hasChildren ? stripWildcardParam(m.params) : m.params;
    out.push({ route, params: segmentParams, consumed });

    if (route.children?.length) {
      const nextRemaining = stripPrefix(remaining, consumed) || '/';
      if (walk(route.children, nextRemaining, out)) return true;
      // Backtrack if no child matched but children required a match
      out.pop();
      continue;
    }
    return true;
  }
  return false;
}

function stripWildcardParam(params: Record<string, string>): Record<string, string> {
  if (!('*' in params)) return params;
  const { ['*']: _wild, ...rest } = params;
  return rest;
}

function appendWildcard(p: string): string {
  if (p.endsWith('/*')) return p;
  if (p === '/') return '/*';
  return `${p.replace(/\/$/, '')}/*`;
}

function computeConsumed(routePath: string, params: Record<string, string>): string {
  const segments = routePath.split('/').filter(Boolean);
  const resolved = segments.map((seg) => {
    if (seg.startsWith(':')) return params[seg.slice(1)] ?? seg;
    if (seg === '*') return '';
    return seg;
  }).filter(Boolean);
  return '/' + resolved.join('/');
}

function stripPrefix(path: string, prefix: string): string {
  if (prefix === '/' || prefix === '') return path;
  if (path.startsWith(prefix)) {
    const rest = path.slice(prefix.length);
    return rest.startsWith('/') ? rest : '/' + rest;
  }
  return path;
}

export function useOutletParams<T extends Record<string, string> = Record<string, string>>(): T {
  return (React.useContext(OutletContext)?.params ?? {}) as T;
}
