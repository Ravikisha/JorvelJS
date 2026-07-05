/**
 * @jorvel/adapter-solid/server — server-side counterpart to `defineSolidRemote`.
 *
 * Renders a Solid remote to an HTML string via `solid-js/web` `renderToString`.
 * Import only from server code.
 *
 * ```tsx
 * import { defineSolidServerRemote } from '@jorvel/adapter-solid/server';
 * import Root from './Root';
 * export default defineSolidServerRemote(Root);
 * ```
 */

import { renderToString as solidRenderToString } from 'solid-js/web';
import type { Component } from 'solid-js';
import type { JorvelServerModule, JorvelSSRContext } from '@jorvel/mount/ssr';
import type { SolidRemoteProps } from './index.js';

export interface DefineSolidServerRemoteOptions {
  head?: string;
  getState?: (ctx: JorvelSSRContext) => unknown;
}

export function defineSolidServerRemote(
  Root: Component<SolidRemoteProps>,
  options: DefineSolidServerRemoteOptions = {},
): JorvelServerModule {
  return {
    renderToString(ctx: JorvelSSRContext) {
      const state = options.getState?.(ctx);
      const props: SolidRemoteProps = {
        subpath: ctx.subpath,
        basePath: ctx.basePath,
        params: ctx.params,
        ...(ctx.props !== undefined ? { props: ctx.props } : {}),
        ...(state !== undefined ? { initialState: state } : {}),
      };
      const html = solidRenderToString(() => Root(props));
      return {
        html,
        ...(options.head !== undefined ? { head: options.head } : {}),
        ...(state !== undefined ? { state } : {}),
      };
    },
  };
}
