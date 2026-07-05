/**
 * @jorvel/adapter-solid — expose a SolidJS remote through the framework-neutral
 * `@jorvel/mount` contract.
 *
 * ```tsx
 * import { defineSolidRemote } from '@jorvel/adapter-solid';
 * import { Root } from './Root';
 * export default defineSolidRemote(Root);
 * ```
 *
 * The root component receives `subpath`, `basePath`, `params` (and any host
 * `props`) as Solid props.
 */

import { render, hydrate } from 'solid-js/web';
import type { Component } from 'solid-js';
import type { JorvelMountContext, JorvelMountModule } from '@jorvel/mount';

export interface SolidRemoteProps {
  subpath: string;
  basePath: string;
  params: Record<string, string>;
  props?: Record<string, unknown>;
  /** Present when hydrating server-rendered markup. */
  initialState?: unknown;
}

function propsFrom(ctx: JorvelMountContext): SolidRemoteProps {
  return {
    subpath: ctx.subpath,
    basePath: ctx.basePath,
    params: ctx.params,
    ...(ctx.props !== undefined ? { props: ctx.props } : {}),
    ...(ctx.initialState !== undefined ? { initialState: ctx.initialState } : {}),
  };
}

export function defineSolidRemote(Root: Component<SolidRemoteProps>): JorvelMountModule {
  const disposers = new WeakMap<HTMLElement, () => void>();

  const tearDown = (el: HTMLElement) => {
    const dispose = disposers.get(el);
    if (!dispose) return;
    disposers.delete(el);
    dispose();
    el.replaceChildren();
  };

  return {
    mount(ctx) {
      const props = propsFrom(ctx);
      // Hydrate server-rendered markup in `ctx.el` when asked; else render fresh.
      const dispose = ctx.hydrate ? hydrate(() => Root(props), ctx.el) : render(() => Root(props), ctx.el);
      disposers.set(ctx.el, dispose);
      return () => tearDown(ctx.el);
    },
    unmount(el) {
      tearDown(el);
    },
  };
}
