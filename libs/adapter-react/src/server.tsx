/**
 * @jorvel/adapter-react/server — server-side counterpart to `defineReactRemote`.
 *
 * Keeps `react-dom/server` OUT of client bundles: import this only from server
 * code (the host's SSR renderer, or an exposed `./AppServer` federation entry).
 *
 * ```ts
 * // remote.server.tsx (exposed as ./AppServer)
 * import { defineReactServerRemote } from '@jorvel/adapter-react/server';
 * import Root from './Root';
 * export default defineReactServerRemote(Root);
 * ```
 */

import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { JorvelServerModule, JorvelSSRContext } from '@jorvel/mount/ssr';
import type { ReactRemoteProps } from './index.js';

export interface DefineReactServerRemoteOptions {
  /** Wrap the tree before rendering — providers, an error boundary, etc. */
  wrap?: (node: React.ReactElement) => React.ReactElement;
  /** Optional head markup (e.g. collected styles) returned with the fragment. */
  head?: string;
  /** Compute serializable hydration state from the render context. */
  getState?: (ctx: JorvelSSRContext) => unknown;
}

/** Turn a React root component into a `JorvelServerModule` (renders to an HTML string). */
export function defineReactServerRemote(
  Root: React.ComponentType<ReactRemoteProps>,
  options: DefineReactServerRemoteOptions = {},
): JorvelServerModule {
  return {
    renderToString(ctx: JorvelSSRContext) {
      const state = options.getState?.(ctx);
      const props: ReactRemoteProps = {
        subpath: ctx.subpath,
        basePath: ctx.basePath,
        params: ctx.params,
        ...(ctx.props !== undefined ? { props: ctx.props } : {}),
        ...(state !== undefined ? { initialState: state } : {}),
      };
      let node: React.ReactElement = React.createElement(Root, props);
      if (options.wrap) node = options.wrap(node);
      const html = renderToString(node);
      return {
        html,
        ...(options.head !== undefined ? { head: options.head } : {}),
        ...(state !== undefined ? { state } : {}),
      };
    },
  };
}
