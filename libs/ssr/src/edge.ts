/**
 * @jorvel/ssr/edge — surface safe for Cloudflare Workers, Vercel Edge,
 * Deno Deploy, and any other runtime that does not provide `node:stream`.
 *
 * Excludes: render-to-stream (Node streams), static-export (fs).
 */

export type {
  SsrRoute,
  SsrRenderResult,
  EdgeRequest,
  EdgeResponse,
  EdgeAdapterHandler,
  EdgeAdapterOptions,
} from './types.js';

export { renderRouteToString, injectIntoTemplate } from './render-to-string.js';
export { createEdgeAdapter, type EdgeAdapterExtraOptions } from './edge-adapter.js';
export { matchRoutePath, type SsrRouteMatch } from './route-utils.js';
export { redirect, isRedirect, SsrRedirect } from './redirect.js';
export {
  json,
  notFound,
  isJsonResponse,
  isNotFound,
  SsrJsonResponse,
  SsrNotFound,
} from './response.js';
export {
  getRequestContext,
  requireRequestContext,
  runWithRequestContext,
  setRequestContextStore,
  buildRequestContext,
  parseCookies,
  type RequestContext,
} from './request-context.js';
export {
  defineLoader,
  runLoaders,
  useLoaderData,
  requireLoaderData,
  setLoaderData,
  _clearLoaderSlot,
  type LoaderContext,
  type LoaderFn,
  type LoaderDescriptor,
  type RunLoadersOptions,
  type RunLoadersResult,
} from './loaders.js';
export {
  serializeState,
  hydrateState,
  consumeHydratedState,
  clearHydratedState,
  type SerializeStateOptions,
} from './state-hydration.js';
export { buildPreloadTags, remoteEntryPreloads, type PreloadLink } from './preload.js';
export { cacheControl, buildWeakEtag, ifNoneMatchHit, type CacheControlOptions } from './cache-headers.js';
export {
  LruHtmlCache,
  type HtmlCache,
  type HtmlCacheEntry,
  type LruHtmlCacheOptions,
} from './html-cache.js';
export {
  serveWithISR,
  awaitIsrRevalidation,
  type ServeIsrOptions,
  type ServeIsrResult,
  type IsrRenderResult,
} from './isr.js';
export {
  defineRoute,
  createApiRouter,
  type HttpMethod,
  type RouteContext,
  type RouteHandler,
  type RouteDef,
  type ApiRouter,
  type CreateApiRouterOptions,
} from './server-routes.js';
export {
  extractCriticalCss,
  inlineCriticalCss,
  type CriticalCssResult,
  type InlineCriticalOptions,
} from './critical-css.js';
export { ssrLoadRemoteEdge, type SsrEdgeRemoteMap } from './remote-ssr.js';
export {
  renderFragmentsToString,
  renderFragmentsToReadableStream,
  type FragmentSpec,
  type FragmentOutcome,
  type RenderFragmentsOptions,
  type RenderFragmentsResult,
  type RenderFragmentsStreamResult,
} from './fragments.js';
export {
  renderRouteToReadableStream,
  renderRouteToResponse,
  collectReadableStream,
  _setReactDomServerWeb,
  type ReadableStreamRenderResult,
  type RenderRouteToReadableStreamOptions,
  type RenderRouteAsResponseOptions,
} from './render-to-readable-stream.js';
