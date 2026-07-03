/**
 * @jorvel/ssr — renderToStream
 *
 * Streaming SSR via React 18's `renderToPipeableStream`. Returns a Node.js
 * `Readable` stream that yields the rendered HTML in chunks. For edge
 * runtimes use `renderRouteToString` (no node:stream dependency).
 */

import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { text as readText } from 'node:stream/consumers';
import type { Readable } from 'node:stream';
import type { ComponentType } from 'react';
import type { SsrRoute } from './types.js';

export type StreamRenderResult = {
  /** Pipe the rendered stream to a Node.js writable (e.g. `res`). */
  pipe: (destination: NodeJS.WritableStream) => void;
  /** Promise that resolves when the full shell has been flushed. */
  shellReady: Promise<void>;
  /** Promise that resolves (or rejects) when the render is complete. */
  allReady: Promise<void>;
  /** HTTP status code — may be updated to 500 on shell error. */
  readonly statusCode: number;
  /** Errors that fired inside Suspense boundaries after shell flush. */
  readonly errors: Error[];
  /** Abort the in-flight render. */
  abort: () => void;
};

export interface RenderRouteToStreamOptions {
  /** AbortSignal for cooperative cancellation (e.g. client disconnect). */
  signal?: AbortSignal;
  /** Hard timeout for `allReady`. After this, the stream is aborted. */
  timeoutMs?: number;
  /** Optional reporter for deferred Suspense errors. */
  onError?: (err: Error) => void;
}

/**
 * Render a React component tree to a Node.js pipeable stream.
 */
export function renderRouteToStream(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute,
  opts: RenderRouteToStreamOptions = {},
): StreamRenderResult {
  let statusCode = 200;
  const errors: Error[] = [];

  const passThrough = new PassThrough();

  let resolveShell!: () => void;
  let rejectShell!: (err: Error) => void;
  const shellReady = new Promise<void>((res, rej) => {
    resolveShell = res;
    rejectShell = rej;
  });

  let resolveAll!: () => void;
  let rejectAll!: (err: Error) => void;
  const allReady = new Promise<void>((res, rej) => {
    resolveAll = res;
    rejectAll = rej;
  });

  const element = createElement(App, { path: route.path, params: route.params ?? {} });

  const stream = renderToPipeableStream(element, {
    onShellReady() {
      // Pipe synchronously inside onShellReady so React's first chunks land in
      // the writable target without a microtask delay (otherwise initial bytes
      // can be lost under backpressure).
      stream.pipe(passThrough);
      resolveShell();
    },
    onShellError(err) {
      statusCode = 500;
      const error = err instanceof Error ? err : new Error(String(err));
      rejectShell(error);
      rejectAll(error);
      passThrough.destroy(error);
    },
    onAllReady() {
      resolveAll();
    },
    onError(err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error);
      if (opts.onError) {
        try {
          opts.onError(error);
        } catch {
          // Reporter must never break the host.
        }
      } else {
        console.error('[jorvel/ssr] streaming render error:', error);
      }
    },
  });

  let aborted = false;
  const abort = () => {
    if (aborted) return;
    aborted = true;
    try {
      stream.abort();
    } catch {
      // ignore
    }
  };

  if (opts.signal) {
    if (opts.signal.aborted) abort();
    else opts.signal.addEventListener('abort', abort, { once: true });
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (opts.timeoutMs && opts.timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      abort();
      const err = new Error(`[jorvel/ssr] streaming render timed out after ${opts.timeoutMs}ms`);
      errors.push(err);
      rejectAll(err);
    }, opts.timeoutMs);
  }
  allReady.finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }).catch(() => {
    /* ignore — we've already routed the error through rejectAll */
  });

  // A shell error rejects shellReady. Callers that only await allReady (or just
  // pipe) would otherwise leave that rejection unhandled — fatal under Node's
  // default --unhandled-rejections=throw. Attach a no-op handler so the rejection
  // is always considered handled; real consumers attach their own.
  shellReady.catch(() => {});

  return {
    pipe(destination: NodeJS.WritableStream) {
      passThrough.pipe(destination);
    },
    shellReady,
    allReady,
    get statusCode() {
      return statusCode;
    },
    get errors() {
      return errors;
    },
    abort,
  };
}

/**
 * Collect a streaming render into a string. Use `renderRouteToStream` directly
 * when you actually need streaming.
 */
export async function collectStream(stream: Readable): Promise<string> {
  return readText(stream);
}
