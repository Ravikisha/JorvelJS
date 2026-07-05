/**
 * @jorvel/adapter-svelte — expose a Svelte 5 remote through the
 * framework-neutral `@jorvel/mount` contract.
 *
 * ```ts
 * import { defineSvelteRemote } from '@jorvel/adapter-svelte';
 * import Root from './Root.svelte';
 * export default defineSvelteRemote(Root);
 * ```
 *
 * The root component receives `subpath`, `basePath`, `params` (and any host
 * `props`) as Svelte props. Requires Svelte 5 (`mount`/`unmount` API).
 */

import { mount, hydrate, unmount, type Component } from 'svelte';
import type { JorvelMountContext, JorvelMountModule } from '@jorvel/mount';

type SvelteInstance = Record<string, unknown>;

function propsFrom(ctx: JorvelMountContext): Record<string, unknown> {
  return {
    subpath: ctx.subpath,
    basePath: ctx.basePath,
    params: ctx.params,
    ...(ctx.initialState !== undefined ? { initialState: ctx.initialState } : {}),
    ...(ctx.props ?? {}),
  };
}

export function defineSvelteRemote(
  Root: Component<Record<string, unknown>>,
): JorvelMountModule {
  const instances = new WeakMap<HTMLElement, SvelteInstance>();

  const tearDown = (el: HTMLElement) => {
    const instance = instances.get(el);
    if (!instance) return;
    instances.delete(el);
    void unmount(instance);
  };

  return {
    mount(ctx) {
      // hydrate() reuses server-rendered markup in `ctx.el`; mount() renders fresh.
      const opts = { target: ctx.el, props: propsFrom(ctx) };
      const instance = (ctx.hydrate ? hydrate(Root, opts) : mount(Root, opts)) as SvelteInstance;
      instances.set(ctx.el, instance);
      return () => tearDown(ctx.el);
    },
    unmount(el) {
      tearDown(el);
    },
  };
}
