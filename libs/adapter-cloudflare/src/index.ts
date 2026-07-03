import { createEdgeAdapter } from '@jorvel/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest } from '@jorvel/ssr';

// NOTE: this module is the Worker RUNTIME entry — it must stay free of Node
// builtins (node:fs/path/url) so it bundles cleanly for Cloudflare Workers
// without `nodejs_compat`. The deploy scaffold lives in `./deploy`.

export interface CloudflareAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {}

/**
 * Cloudflare Worker execution context — minimal shape so we don't take a hard
 * dep on `@cloudflare/workers-types`. Bindings live on `env`; background work
 * uses `ctx.waitUntil`.
 */
export interface CloudflareExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

/** Per-request hook — receives the raw Worker arguments before handing back to SSR. */
export type CloudflareRequestHook<Env = unknown> = (args: {
  request: Request;
  env: Env;
  ctx: CloudflareExecutionContext;
}) => void | Promise<void>;

export interface CloudflareWorkerOptions<Env = unknown> extends CloudflareAdapterOptions {
  /** Called once per request before render — wire bindings into per-request state here. */
  onRequest?: CloudflareRequestHook<Env>;
}

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
  if (body instanceof Uint8Array) {
    // Cast to a fresh ArrayBuffer-backed view so it satisfies BodyInit.
    return body.slice().buffer as ArrayBuffer;
  }
  return body;
}

// Per the Fetch spec, constructing a Response with a (non-null) body for a
// null-body status throws TypeError. The SSR edge adapter returns `body: ''`
// for 304 (ETag revalidation) and other bodyless responses, so we must pass
// null for these statuses — otherwise every 304 became a production 500.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function toResponse(res: { body: string | Uint8Array | ReadableStream<Uint8Array>; status: number; headers: Record<string, string> }): Response {
  const body = NULL_BODY_STATUSES.has(res.status) ? null : bodyToBodyInit(res.body);
  return new Response(body, { status: res.status, headers: res.headers });
}

export function createCloudflareWorker<Env = unknown>(
  options: CloudflareWorkerOptions<Env>,
) {
  const handler = createEdgeAdapter(options);
  const { onRequest } = options;

  return {
    async fetch(
      request: Request,
      env: Env,
      ctx: CloudflareExecutionContext,
    ): Promise<Response> {
      if (onRequest) {
        await onRequest({ request, env, ctx });
      }
      return toResponse(await handler(toEdgeRequest(request)));
    },
  };
}

export function createPagesFunction<Env = unknown>(
  options: CloudflareWorkerOptions<Env>,
) {
  const handler = createEdgeAdapter(options);
  const { onRequest } = options;

  return async function onRequestFn(ctx: {
    request: Request;
    env: Env;
    waitUntil: (p: Promise<unknown>) => void;
    passThroughOnException: () => void;
  }): Promise<Response> {
    if (onRequest) {
      await onRequest({
        request: ctx.request,
        env: ctx.env,
        ctx: { waitUntil: ctx.waitUntil, passThroughOnException: ctx.passThroughOnException },
      });
    }
    return toResponse(await handler(toEdgeRequest(ctx.request)));
  };
}

// Deploy scaffold (used by `jorvel deploy --target cloudflare`) moved to
// `./deploy` to keep Node builtins out of this Worker-runtime entry.
export type { ScaffoldDeployOptions, ScaffoldDeployResult } from './deploy.js';
