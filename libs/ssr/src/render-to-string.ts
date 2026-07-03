/**
 * @jorvel/ssr — renderToString
 *
 * Synchronously renders a React component tree to an HTML string for a given
 * server-side request path. Uses React 18's `renderToString` so the output is
 * hydratable; for static-only exports use `renderToStaticMarkup` directly.
 *
 * For streaming SSR, see `render-to-stream.ts`.
 */

import { createElement } from 'react';
import { renderToString as reactRenderToString, renderToStaticMarkup } from 'react-dom/server';
import { escapeHtml } from '@jorvel/security';
import type { ComponentType } from 'react';
import { isRedirect } from './redirect.js';
import { isJsonResponse, isNotFound } from './response.js';
import type { SsrRenderResult, SsrRoute } from './types.js';

export interface RenderRouteOptions {
  /**
   * If true (default for hydratable use), uses `renderToString` which emits
   * hydration markers. Set to false for static export / email rendering.
   */
  hydratable?: boolean;
}

/**
 * Render a React component tree to an HTML string.
 *
 * @param App     - The root component to render. Receives `{ path, params }`.
 * @param route   - The route to render (`path` + optional `params`).
 * @param opts   - Options.
 * @returns       An `SsrRenderResult` with `{ html, statusCode }`.
 *
 * @example
 * ```ts
 * import { renderRouteToString } from '@jorvel/ssr';
 *
 * const { html } = await renderRouteToString(App, { path: '/dashboard/settings' });
 * ```
 */
export async function renderRouteToString(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute,
  opts: RenderRouteOptions = {},
): Promise<SsrRenderResult> {
  const hydratable = opts.hydratable ?? true;
  try {
    const element = createElement(App, { path: route.path, params: route.params ?? {} });
    const html = hydratable ? reactRenderToString(element) : renderToStaticMarkup(element);
    return { html, statusCode: 200 };
  } catch (err) {
    // Control-flow errors must propagate so the adapter can handle them.
    if (isRedirect(err) || isJsonResponse(err) || isNotFound(err)) throw err;
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      html: `<p data-ssr-error>${escapeHtml(error.message)}</p>`,
      statusCode: 500,
      error,
    };
  }
}

/**
 * Inject rendered HTML into an HTML shell template.
 *
 * The template must contain the placeholder `<!--ssr-outlet-->`. An optional
 * `<!--ssr-head-->` placeholder will be replaced with `headExtra` when given —
 * use this for state-hydration `<script>` tags, preload links, and per-request
 * CSP nonces so they appear before client JS runs.
 *
 * @example
 * ```ts
 * const fullHtml = injectIntoTemplate(template, '<h1>Hello</h1>', '<script>…</script>');
 * ```
 */
export function injectIntoTemplate(
  template: string,
  html: string,
  headExtra?: string,
): string {
  if (!template.includes('<!--ssr-outlet-->')) {
    throw new Error(
      'SSR template must contain the <!--ssr-outlet--> placeholder.\n' +
        'Add it inside your <div id="root"> element:\n' +
        '  <div id="root"><!--ssr-outlet--></div>',
    );
  }
  let out = template.replaceAll('<!--ssr-outlet-->', html);
  if (out.includes('<!--ssr-head-->')) {
    out = out.replaceAll('<!--ssr-head-->', headExtra ?? '');
  } else if (headExtra) {
    // No explicit placeholder — don't silently drop head content (hydration
    // scripts, preloads, nonces). Inject before </head>, else before </body>,
    // else just prepend so it still ships.
    if (out.includes('</head>')) {
      out = out.replace('</head>', `${headExtra}</head>`);
    } else if (out.includes('</body>')) {
      out = out.replace('</body>', `${headExtra}</body>`);
    } else {
      out = headExtra + out;
    }
  }
  return out;
}
