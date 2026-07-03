import { createEdgeAdapter } from '@jorvel/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest } from '@jorvel/ssr';

// NOTE: this module is an edge RUNTIME entry — it must stay free of Node
// builtins (node:fs/path/url) so it bundles cleanly for Bun. Static file
// serving uses Bun's own APIs, guarded behind `typeof Bun` checks so the
// module still imports (and tests still run) under plain Node + vitest.

export interface BunAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {
  /** Directory with pre-built static assets. Default: 'dist'. */
  staticDir?: string;
  /** Mount path for static assets. Default: '/'. */
  staticMount?: string;
  /** Port. Default: process.env.PORT or 3000. */
  port?: number;
}

// ── Minimal local view of the Bun global ──────────────────────────────────────
// We do NOT depend on `bun-types`; declare only the slice we touch and guard
// every use behind `typeof Bun !== 'undefined'`.
interface BunFileLike {
  exists(): Promise<boolean>;
}
interface BunGlobal {
  file(path: string): BunFileLike;
  serve(opts: { port: number; fetch: (req: Request) => Response | Promise<Response> }): {
    port: number;
    stop(): void;
  };
}
declare const Bun: BunGlobal | undefined;

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
// for 304 (ETag revalidation) and other bodyless responses, so pass null here.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/** Reject paths that would escape the static root via `..` or NUL. */
function isSafeRel(rel: string): boolean {
  if (rel.includes('\0')) return false;
  for (const seg of rel.split('/')) {
    if (seg === '..') return false;
  }
  return true;
}

/**
 * Build a Bun `fetch(req: Request) => Response` handler from JORVEL SSR config.
 * When `staticDir` is set AND running under Bun, GET/HEAD requests are first
 * checked against the static directory; otherwise the request is SSR-rendered.
 */
export function createBunHandler(options: BunAdapterOptions) {
  const handler = createEdgeAdapter(options);
  const staticDir = options.staticDir ?? 'dist';
  const staticMount = options.staticMount ?? '/';

  return async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isReadMethod = request.method === 'GET' || request.method === 'HEAD';

    // Static-asset fast path — only available under Bun.
    if (typeof Bun !== 'undefined' && isReadMethod && staticMount) {
      const segmentMatch =
        staticMount === '/' ||
        url.pathname === staticMount ||
        url.pathname.startsWith(staticMount + '/');
      if (segmentMatch) {
        const rawRel = url.pathname.slice(staticMount.length).replace(/^\/+/, '');
        let rel: string;
        try {
          rel = decodeURIComponent(rawRel);
        } catch {
          return new Response('bad request', { status: 400 });
        }
        if (rel && isSafeRel(rel)) {
          const file = Bun.file(`${staticDir}/${rel}`);
          if (await file.exists()) {
            // Bun.file is a BodyInit (Blob-like); Response streams it directly.
            return new Response(file as unknown as BodyInit);
          }
        } else if (rel) {
          return new Response('bad request', { status: 400 });
        }
      }
    }

    const res = await handler(toEdgeRequest(request));
    const body = NULL_BODY_STATUSES.has(res.status) ? null : bodyToBodyInit(res.body);
    return new Response(body, { status: res.status, headers: res.headers });
  };
}

/**
 * Convenience: build the handler and start a Bun server. Throws if not running
 * under Bun (`Bun.serve` is unavailable on Node).
 */
export function serveBun(options: BunAdapterOptions): { port: number; stop(): void } {
  if (typeof Bun === 'undefined') {
    throw new Error('serveBun() requires the Bun runtime (Bun global not found)');
  }
  const fetch = createBunHandler(options);
  const port = options.port ?? Number(process.env['PORT'] ?? 3000);
  return Bun.serve({ port, fetch });
}
