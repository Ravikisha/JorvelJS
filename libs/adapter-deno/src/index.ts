import { createEdgeAdapter } from '@jorvel/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest, EdgeResponse } from '@jorvel/ssr';

/**
 * Deno Deploy adapter for JORVEL SSR. Produces a `fetch(req: Request) =>
 * Response` handler for `Deno.serve`. Deno APIs are guarded behind
 * `typeof Deno` checks so the module imports (and tests run) under plain Node.
 */

export interface DenoAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {
  /** Port for `serveDeno`. Default: env PORT or 8000 (Deno Deploy default). */
  port?: number;
}

// Minimal local view of the Deno global — no `@types/deno` dependency.
interface DenoGlobal {
  serve(
    opts: { port: number },
    handler: (req: Request) => Response | Promise<Response>,
  ): { finished: Promise<void>; shutdown(): Promise<void> };
  env: { get(key: string): string | undefined };
}
declare const Deno: DenoGlobal | undefined;

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function lowerHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  return out;
}

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

export function toResponse(res: EdgeResponse): Response {
  const body = NULL_BODY_STATUSES.has(res.status) ? null : bodyToBodyInit(res.body);
  return new Response(body, { status: res.status, headers: res.headers });
}

/** Build a `fetch(req) => Response` handler for Deno Deploy / `Deno.serve`. */
export function createDenoHandler(options: DenoAdapterOptions) {
  const handler = createEdgeAdapter(options);
  return async function denoHandler(request: Request): Promise<Response> {
    return toResponse(await handler(toEdgeRequest(request)));
  };
}

/** Convenience: start a `Deno.serve`. Throws when not running under Deno. */
export function serveDeno(options: DenoAdapterOptions) {
  if (typeof Deno === 'undefined') {
    throw new Error('serveDeno() requires the Deno runtime (Deno global not found)');
  }
  const fetch = createDenoHandler(options);
  const port = options.port ?? Number(Deno.env.get('PORT') ?? 8000);
  return Deno.serve({ port }, fetch);
}
