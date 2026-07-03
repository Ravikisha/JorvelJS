/**
 * @jorvel/ssr — server-route convention.
 *
 * A tiny, dependency-free API router (method + path → `Request → Response`)
 * that any adapter can consult BEFORE falling through to SSR. This is the
 * seam tRPC / Hono / a hand-written handler plug into: mount their fetch
 * handler as a catch-all route, or use the built-in matcher for simple JSON
 * endpoints.
 *
 * Edge-safe: Web `Request`/`Response`, `:param` + `*` splat matching, no Node
 * builtins.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
}

export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;

export interface RouteDef {
  method: HttpMethod | '*';
  path: string;
  handler: RouteHandler;
}

export function defineRoute(method: RouteDef['method'], path: string, handler: RouteHandler): RouteDef {
  return { method, path, handler };
}

/** Compile a `/users/:id` / `/files/*` pattern to a regex + param names. */
function compile(pattern: string): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = pattern
    .split('/')
    .map((seg) => {
      if (seg === '*') { keys.push('*'); return '(.*)'; }
      if (seg.startsWith(':')) { keys.push(seg.slice(1)); return '([^/]+)'; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { re: new RegExp(`^${src}/?$`), keys };
}

function match(pattern: string, pathname: string): Record<string, string> | null {
  const { re, keys } = compile(pattern);
  const m = re.exec(pathname);
  if (!m) return null;
  const params: Record<string, string> = {};
  keys.forEach((k, i) => {
    const v = m[i + 1];
    if (v !== undefined) params[k] = decodeURIComponent(v);
  });
  return params;
}

export interface ApiRouter {
  /** Handle a request. Returns a Response, or `null` when no route matched. */
  handle(request: Request): Promise<Response | null>;
  routes: RouteDef[];
}

export interface CreateApiRouterOptions {
  /** Prefix every route path is mounted under, e.g. `/api`. Default `''`. */
  prefix?: string;
  /** Mount a foreign fetch handler (tRPC/Hono) as the fallback for the prefix. */
  fallback?: RouteHandler;
}

/**
 * Build a router from route defs. First method+path match wins; `'*'` method
 * matches any verb. Returns `null` on no match so the caller can fall through
 * to SSR page rendering.
 */
export function createApiRouter(routes: RouteDef[], opts: CreateApiRouterOptions = {}): ApiRouter {
  const prefix = opts.prefix ?? '';
  return {
    routes,
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url);
      if (prefix && !url.pathname.startsWith(prefix)) return null;
      const rel = prefix ? url.pathname.slice(prefix.length) || '/' : url.pathname;

      for (const route of routes) {
        if (route.method !== '*' && route.method !== request.method) continue;
        const params = match(route.path, rel);
        if (!params) continue;
        return route.handler({ request, url, params });
      }

      if (opts.fallback && (!prefix || url.pathname.startsWith(prefix))) {
        return opts.fallback({ request, url, params: {} });
      }
      return null;
    },
  };
}

// ── JSON helpers ─────────────────────────────────────────────────────────────

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

export function notFound(message = 'Not Found'): Response {
  return new Response(message, { status: 404 });
}
