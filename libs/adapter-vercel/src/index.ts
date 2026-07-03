import { createEdgeAdapter } from '@jorvel/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest } from '@jorvel/ssr';

// NOTE: this module is the edge RUNTIME entry — it must stay free of Node
// builtins (node:fs/path/url) so it bundles cleanly for Workers / Vercel Edge.
// The deploy scaffold (which needs the filesystem) lives in `./deploy`.

// VercelAdapterOptions extends EdgeAdapterOptions + EdgeAdapterExtraOptions
// without adding fields — the runtime target is selected via `vercelConfig`
// (exported below) at the function-export site, not on the handler itself.
export type VercelAdapterOptions = EdgeAdapterOptions & EdgeAdapterExtraOptions;

function lowerHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function toEdgeRequest(req: Request): EdgeRequest {
  const er: EdgeRequest = {
    url: req.url,
    method: req.method,
    headers: lowerHeaders(req.headers),
  };
  if (req.body) er.body = req.body as ReadableStream<Uint8Array>;
  if (req.signal) er.signal = req.signal;
  return er;
}

function bodyToBodyInit(body: string | Uint8Array | ReadableStream<Uint8Array>): BodyInit {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return body.slice().buffer as ArrayBuffer;
  return body;
}

// Per the Fetch spec, constructing a Response with a (non-null) body for a
// null-body status throws TypeError. The SSR edge adapter returns `body: ''`
// for 304 (ETag revalidation) and other bodyless responses, so we must pass
// null for these statuses — otherwise every 304 became a production 500.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/** Build a Vercel Edge/Node function handler from JORVEL SSR config. */
export function createVercelHandler(options: VercelAdapterOptions) {
  const handler = createEdgeAdapter(options);

  return async function fetch(request: Request): Promise<Response> {
    const res = await handler(toEdgeRequest(request));
    const body = NULL_BODY_STATUSES.has(res.status) ? null : bodyToBodyInit(res.body);
    return new Response(body, { status: res.status, headers: res.headers });
  };
}

export const vercelConfig = {
  edge: { runtime: 'edge' as const },
  node: { runtime: 'nodejs22.x' as const },
};

// Deploy scaffold (used by `jorvel deploy --target vercel`) moved to `./deploy`
// to keep Node builtins out of this edge-runtime entry.
export type { ScaffoldDeployOptions, ScaffoldDeployResult } from './deploy.js';
