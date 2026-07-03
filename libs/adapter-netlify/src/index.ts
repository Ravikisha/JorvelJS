import { createEdgeAdapter } from '@jorvel/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest, EdgeResponse } from '@jorvel/ssr';

/**
 * Netlify deployment adapter for JORVEL SSR.
 *
 * Works for both Netlify Functions (v2) and Netlify Edge Functions — both use
 * the Web `Request`/`Response` types. Also exports a `netlifyToml` template
 * string so `jorvel deploy --target netlify` can emit config.
 */

export interface NetlifyAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {}

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function lowerHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  return out;
}

/** Web `Request` → JORVEL `EdgeRequest`. */
export function toEdgeRequest(req: Request): EdgeRequest {
  const er: EdgeRequest = { url: req.url, method: req.method, headers: lowerHeaders(req.headers) };
  if (req.body) er.body = req.body as ReadableStream<Uint8Array>;
  if (req.signal) er.signal = req.signal;
  return er;
}

function bodyToBodyInit(body: string | Uint8Array | ReadableStream<Uint8Array>): BodyInit {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return body.slice().buffer as ArrayBuffer;
  return body;
}

/** JORVEL `EdgeResponse` → Web `Response`. */
export function toResponse(res: EdgeResponse): Response {
  const body = NULL_BODY_STATUSES.has(res.status) ? null : bodyToBodyInit(res.body);
  return new Response(body, { status: res.status, headers: res.headers });
}

/**
 * Build a Netlify handler: `(request: Request) => Promise<Response>`. Use it as
 * the default export of a `netlify/edge-functions/*.ts` or Functions v2 module.
 */
export function createNetlifyHandler(options: NetlifyAdapterOptions) {
  const handler = createEdgeAdapter(options);
  return async function netlifyHandler(request: Request): Promise<Response> {
    return toResponse(await handler(toEdgeRequest(request)));
  };
}

/** A starter `netlify.toml` routing SSR through an edge function. */
export const netlifyToml = `[build]
  command = "jorvel build"
  publish = "apps/shell/dist"

[[edge_functions]]
  path = "/*"
  function = "ssr"

[functions]
  node_bundler = "esbuild"
`;
