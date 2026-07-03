/**
 * @jorvel/ssr — edge adapter
 *
 * Framework-agnostic request/response bridge for edge runtimes (Cloudflare
 * Workers, Vercel Edge, Deno Deploy, AWS Lambda@Edge). Feeds an `EdgeRequest`
 * through the router and returns an `EdgeResponse` you adapt to the platform's
 * native Response type.
 */

import { renderRouteToString, injectIntoTemplate } from './render-to-string.js';
import { matchRoutePath } from './route-utils.js';
import { cacheControl, buildWeakEtag, ifNoneMatchHit, type CacheControlOptions } from './cache-headers.js';
import { isRedirect } from './redirect.js';
import { isJsonResponse, isNotFound } from './response.js';
import { buildRequestContext, runWithRequestContext } from './request-context.js';
import { runLoaders, type LoaderDescriptor } from './loaders.js';
import { escapeHtml } from '@jorvel/security';
import type { HtmlCache } from './html-cache.js';
import type { EdgeAdapterHandler, EdgeAdapterOptions, EdgeRequest, EdgeResponse } from './types.js';

/** Resolves the loaders that run for a matched route before render. */
export type LoadersResolver =
  | LoaderDescriptor<unknown>[]
  | ((ctx: {
      request: EdgeRequest;
      pathname: string;
      params: Record<string, string>;
      route: string;
    }) => LoaderDescriptor<unknown>[] | undefined);

/** Serialize loader data for a `<script>` payload (escape `<` so it can't break out). */
function serializeLoaderData(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export interface EdgeAdapterExtraOptions {
  /** Default Cache-Control for successful responses. */
  cache?: CacheControlOptions;
  /** Cache-Control for 404s. Defaults to `{ scope: 'public', sMaxAge: 60 }`. */
  notFoundCache?: CacheControlOptions;
  /** Per-path override. Matched against route.path (literal). */
  cacheOverrides?: Record<string, CacheControlOptions>;
  /** Emit weak ETag and handle If-None-Match. */
  etag?: boolean;
  /** Extra headers merged into every response (case-insensitive). */
  headers?: Record<string, string>;
  /**
   * CSP header value. May be a static string or a per-request factory — use
   * the factory form whenever you generate a per-request nonce so each
   * response gets a fresh nonce.
   */
  csp?: string | ((req: EdgeRequest) => string);
  /**
   * Optional `<head>` injection per request. Use this slot to inject
   * `serializeState(...)` `<script>` tags, preload links, and CSP nonces. The
   * template must contain `<!--ssr-head-->` to receive the result.
   */
  enrichHead?: (ctx: { request: EdgeRequest; pathname: string }) => string | Promise<string>;
  /**
   * Optional rendered-HTML cache. When set, the adapter does an ETag-only
   * round-trip for cache hits — `If-None-Match` is checked before any render.
   * Provide a per-request stable `cacheKey` if route output varies on cookies,
   * locale, etc. Caching is automatically skipped when `enrichHead` is set
   * (per-request HTML).
   */
  htmlCache?: HtmlCache;
  /**
   * Build a cache key from the request. Default: `pathname`. Return `null` to
   * skip caching for this request (e.g. authenticated routes).
   */
  cacheKey?: (ctx: { request: EdgeRequest; pathname: string }) => string | null;
  /**
   * Per-route data loaders run (inside the request context) before render. Their
   * aggregated data is available to components via `useLoaderData` during SSR and
   * serialized into `window.__JORVEL_LOADER_DATA__` for client hydration; their
   * `setHeader` calls and `cacheControl` are merged into the response. A loader
   * may throw `redirect` / `json` / `notFound` to short-circuit. The rendered
   * HTML cache is auto-disabled when loaders are present (responses are
   * per-request).
   */
  loaders?: LoadersResolver;
}

function lowerKeys(headers?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const k of Object.keys(headers)) {
    const v = headers[k];
    if (typeof v === 'string') out[k.toLowerCase()] = v;
  }
  return out;
}

function getHeader(req: EdgeRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  const headers = req.headers;
  if (!headers) return undefined;
  // Fast path: already lowercased.
  if (headers[lower] !== undefined) return headers[lower];
  // Fallback: case-insensitive scan.
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}

function appendVary(headers: Record<string, string>, value: string): void {
  const existing = headers['vary'];
  if (!existing) {
    headers['vary'] = value;
    return;
  }
  const parts = existing.split(',').map((p) => p.trim().toLowerCase());
  for (const v of value.split(',').map((p) => p.trim())) {
    if (!parts.includes(v.toLowerCase())) headers['vary'] = `${headers['vary']}, ${v}`;
  }
}

export function createEdgeAdapter(
  options: EdgeAdapterOptions & EdgeAdapterExtraOptions,
): EdgeAdapterHandler {
  const {
    App,
    template,
    routes,
    onNotFound,
    cache,
    notFoundCache,
    cacheOverrides,
    etag,
    headers: extraHeaders,
    csp,
    enrichHead,
    htmlCache,
    cacheKey,
    loaders,
  } = options;

  const baseExtra = lowerKeys(extraHeaders);
  // Caching renders per-request HTML is unsafe when enrichHead OR loaders are in
  // play (loaders may set per-request headers / data).
  const cacheEnabled = Boolean(htmlCache && etag && !enrichHead && !loaders);

  return async function handleEdgeRequest(request: EdgeRequest): Promise<EdgeResponse> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method?.toUpperCase() ?? 'GET';

    if (method === 'OPTIONS') {
      return {
        status: 204,
        headers: { ...baseExtra, allow: 'GET, HEAD, OPTIONS' },
        body: '',
      };
    }

    // This adapter only renders read requests. Mutating methods would otherwise
    // be SSR-rendered like GET (and, worse, their output cached) — reject them so
    // loaders (read-side) never run for a mutation.
    if (method !== 'GET' && method !== 'HEAD') {
      return {
        status: 405,
        headers: { ...baseExtra, allow: 'GET, HEAD, OPTIONS' },
        body: '',
      };
    }

    const match = matchRoutePath(routes, pathname);
    if (!match) {
      if (onNotFound) return onNotFound(request);
      return defaultNotFound(pathname, template, baseExtra, notFoundCache);
    }

    // ── ETag-before-render fast path ────────────────────────────────────────
    let entryKey: string | null = null;
    if (cacheEnabled && htmlCache) {
      entryKey = cacheKey ? cacheKey({ request, pathname }) : pathname;
      if (entryKey !== null) {
        const cached = await htmlCache.get(entryKey);
        if (cached) {
          const responseHeaders: Record<string, string> = {
            ...baseExtra,
            'content-type': 'text/html; charset=utf-8',
            'x-jorvel-ssr': '1',
            'x-jorvel-ssr-cache': 'hit',
            etag: cached.etag,
          };
          const cspValue = typeof csp === 'function' ? csp(request) : csp;
          if (cspValue) responseHeaders['content-security-policy'] = cspValue;
          appendVary(responseHeaders, 'Accept-Encoding');
          const cacheOpts = cacheOverrides?.[match.path] ?? cache;
          if (cacheOpts && cached.status < 400) {
            responseHeaders['cache-control'] = cacheControl(cacheOpts);
          }
          if (ifNoneMatchHit(cached.etag, getHeader(request, 'if-none-match'))) {
            return { status: 304, headers: responseHeaders, body: '' };
          }
          if (method === 'HEAD') {
            return { status: cached.status, headers: responseHeaders, body: '' };
          }
          return { status: cached.status, headers: responseHeaders, body: cached.html };
        }
      }
    }

    // Resolve route loaders (a static list or a per-request resolver).
    const routeLoaders = typeof loaders === 'function'
      ? loaders({ request, pathname, params: match.params, route: match.path }) ?? []
      : loaders ?? [];

    let result;
    let loaderData: Record<string, unknown> | undefined;
    let loaderHeaders: Record<string, string> | undefined;
    let loaderCacheControl: string | undefined;
    const ctx = buildRequestContext(request);
    try {
      // Loaders (async) run first, inside the request context. runLoaders captures
      // ctx + its slot synchronously and writes the data into ctx.locals, so it
      // survives the await even on the sync-slot store. A loader may throw
      // redirect/json/notFound — caught below.
      if (routeLoaders.length) {
        const r = await runWithRequestContext(ctx, () =>
          runLoaders({ loaders: routeLoaders, request, params: match.params }),
        );
        loaderData = r.data;
        loaderHeaders = r.headers;
        loaderCacheControl = r.cacheControl;
      }
      // Render is SYNCHRONOUS (no await before reactRenderToString), so the ctx
      // stays active for the whole render and useLoaderData() reads ctx.locals.
      result = await runWithRequestContext(ctx, () =>
        renderRouteToString(App, { path: match.path, params: match.params }),
      );
    } catch (err) {
      if (isRedirect(err)) {
        return {
          status: err.status,
          headers: { ...baseExtra, location: err.location },
          body: '',
        };
      }
      if (isJsonResponse(err)) {
        return {
          status: err.status,
          headers: {
            ...baseExtra,
            ...err.headers,
            'content-type': err.headers['content-type'] ?? 'application/json; charset=utf-8',
          },
          body: JSON.stringify(err.body),
        };
      }
      if (isNotFound(err)) {
        if (onNotFound) return onNotFound(request);
        return defaultNotFound(pathname, template, baseExtra, notFoundCache);
      }
      throw err;
    }

    const enrichedHead = enrichHead ? await enrichHead({ request, pathname }) : '';
    // Serialize loader data for client hydration (the client seeds the loader
    // slot from window.__JORVEL_LOADER_DATA__).
    const loaderHead =
      loaderData && Object.keys(loaderData).length
        ? `<script>window.__JORVEL_LOADER_DATA__=${serializeLoaderData(loaderData)}</script>`
        : '';
    const html = injectIntoTemplate(template, result.html, enrichedHead + loaderHead);

    const responseHeaders: Record<string, string> = {
      ...baseExtra,
      // Loader-set headers (e.g. Set-Cookie) — already lowercased by runLoaders.
      ...(loaderHeaders ?? {}),
      'content-type': 'text/html; charset=utf-8',
      'x-jorvel-ssr': '1',
    };

    const cspValue = typeof csp === 'function' ? csp(request) : csp;
    if (cspValue) responseHeaders['content-security-policy'] = cspValue;

    appendVary(responseHeaders, 'Accept-Encoding');

    const cacheOpts = cacheOverrides?.[match.path] ?? cache;
    if (result.statusCode < 400) {
      // A loader's cacheControl (route-specific) takes precedence over the
      // adapter-level default/override.
      if (loaderCacheControl) {
        responseHeaders['cache-control'] = loaderCacheControl;
      } else if (cacheOpts) {
        responseHeaders['cache-control'] = cacheControl(cacheOpts);
      }
    }

    let etagValue: string | undefined;
    if (etag && result.statusCode < 400) {
      etagValue = buildWeakEtag(html);
      responseHeaders['etag'] = etagValue;
    }

    if (cacheEnabled && htmlCache && entryKey !== null && etagValue && result.statusCode < 400) {
      responseHeaders['x-jorvel-ssr-cache'] = 'miss';
      await htmlCache.set(entryKey, {
        html,
        etag: etagValue,
        status: result.statusCode,
        storedAt: Date.now(),
      });
    }

    if (method === 'HEAD') {
      return { status: result.statusCode, headers: responseHeaders, body: '' };
    }

    if (etagValue && ifNoneMatchHit(etagValue, getHeader(request, 'if-none-match'))) {
      return { status: 304, headers: responseHeaders, body: '' };
    }

    return {
      status: result.statusCode,
      headers: responseHeaders,
      body: html,
    };
  };
}

function defaultNotFound(
  pathname: string,
  template: string,
  baseExtra: Record<string, string>,
  notFoundCache?: CacheControlOptions,
): EdgeResponse {
  const html = `<h1>404 - Not Found</h1><p>No page matched <code>${escapeHtml(pathname)}</code>.</p>`;
  const headers: Record<string, string> = {
    ...baseExtra,
    'content-type': 'text/html; charset=utf-8',
  };
  if (notFoundCache) headers['cache-control'] = cacheControl(notFoundCache);
  appendVary(headers, 'Accept-Encoding');
  return {
    status: 404,
    headers,
    body: injectIntoTemplate(template, html),
  };
}
