/**
 * @jorvel/adapter-vue — expose a Vue 3 remote through the framework-neutral
 * `@jorvel/mount` contract, so any JORVEL host can embed it.
 *
 * ```ts
 * import { defineVueRemote } from '@jorvel/adapter-vue';
 * import Root from './Root.vue';
 * export default defineVueRemote(Root);
 * ```
 *
 * The root component receives `subpath`, `basePath`, `params` (and any host
 * `props`) as Vue props.
 */

import { createApp, createSSRApp, type App, type Component } from 'vue';
import type { JorvelMountContext, JorvelMountModule } from '@jorvel/mount';

export interface DefineVueRemoteOptions {
  /** Extend the app instance before mount — register plugins, a router, i18n, etc. */
  setup?: (app: App<Element>, ctx: JorvelMountContext) => void;
}

function propsFrom(ctx: JorvelMountContext): Record<string, unknown> {
  return {
    subpath: ctx.subpath,
    basePath: ctx.basePath,
    params: ctx.params,
    ...(ctx.initialState !== undefined ? { initialState: ctx.initialState } : {}),
    ...(ctx.props ?? {}),
  };
}

export function defineVueRemote(
  Root: Component,
  options: DefineVueRemoteOptions = {},
): JorvelMountModule {
  const apps = new WeakMap<HTMLElement, App<Element>>();

  const tearDown = (el: HTMLElement) => {
    const app = apps.get(el);
    if (!app) return;
    apps.delete(el);
    app.unmount();
  };

  return {
    mount(ctx) {
      // When the host hydrates server-rendered markup, createSSRApp reuses the
      // existing DOM in `ctx.el`; otherwise createApp renders fresh.
      const app = ctx.hydrate ? createSSRApp(Root, propsFrom(ctx)) : createApp(Root, propsFrom(ctx));
      options.setup?.(app, ctx);
      apps.set(ctx.el, app);
      app.mount(ctx.el);
      return () => tearDown(ctx.el);
    },
    unmount(el) {
      tearDown(el);
    },
  };
}
