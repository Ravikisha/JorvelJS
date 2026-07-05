/**
 * @jorvel/adapter-vue/server — server-side counterpart to `defineVueRemote`.
 *
 * Renders a Vue remote to an HTML string via `@vue/server-renderer`. Import
 * only from server code — keeps the server renderer out of client bundles.
 *
 * ```ts
 * import { defineVueServerRemote } from '@jorvel/adapter-vue/server';
 * import Root from './Root.vue';
 * export default defineVueServerRemote(Root);
 * ```
 */

import { createSSRApp, type App, type Component } from 'vue';
import { renderToString } from '@vue/server-renderer';
import type { JorvelServerModule, JorvelSSRContext } from '@jorvel/mount/ssr';

export interface DefineVueServerRemoteOptions {
  /** Extend the SSR app before rendering — plugins, router, i18n, etc. */
  setup?: (app: App<Element>, ctx: JorvelSSRContext) => void;
  /** Head markup returned with the fragment. */
  head?: string;
  /** Compute serializable hydration state from the render context. */
  getState?: (ctx: JorvelSSRContext) => unknown;
}

export function defineVueServerRemote(
  Root: Component,
  options: DefineVueServerRemoteOptions = {},
): JorvelServerModule {
  return {
    async renderToString(ctx: JorvelSSRContext) {
      const state = options.getState?.(ctx);
      const props: Record<string, unknown> = {
        subpath: ctx.subpath,
        basePath: ctx.basePath,
        params: ctx.params,
        ...(state !== undefined ? { initialState: state } : {}),
        ...(ctx.props ?? {}),
      };
      const app = createSSRApp(Root, props);
      options.setup?.(app, ctx);
      const html = await renderToString(app);
      return {
        html,
        ...(options.head !== undefined ? { head: options.head } : {}),
        ...(state !== undefined ? { state } : {}),
      };
    },
  };
}
