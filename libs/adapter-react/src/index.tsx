/**
 * @jorvel/adapter-react — bridge a React remote into the framework-neutral
 * `@jorvel/mount` contract.
 *
 * A React remote's exposed entry becomes mountable by ANY JORVEL host (React or
 * not) just by wrapping its root component:
 *
 * ```tsx
 * import { defineReactRemote } from '@jorvel/adapter-react';
 * import { RemoteApp } from '@jorvel/runtime';
 * import { pages } from './jorvel.routes.js';
 *
 * export default defineReactRemote(({ subpath }) => (
 *   <RemoteApp subpath={subpath} pages={pages} />
 * ));
 * ```
 */

import * as React from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import type { JorvelMountContext, JorvelMountModule } from '@jorvel/mount';

/** Props a React remote root receives from the host, mirrored from the mount context. */
export interface ReactRemoteProps {
  subpath: string;
  basePath: string;
  params: Record<string, string>;
  props?: Record<string, unknown>;
  /** Present when the host hydrates server-rendered markup — seed from this. */
  initialState?: unknown;
}

export interface DefineReactRemoteOptions {
  /**
   * Wrap the mounted tree — e.g. providers, an error boundary, StrictMode.
   * Receives the rendered root element and must return an element.
   */
  wrap?: (node: React.ReactElement) => React.ReactElement;
}

/**
 * Turn a React root component into a `JorvelMountModule`. The component is
 * (re-)rendered whenever the host mounts, and unmounted on teardown. Each mount
 * owns its own React root, so the remote is fully isolated from the host's tree.
 */
export function defineReactRemote(
  Root: React.ComponentType<ReactRemoteProps>,
  options: DefineReactRemoteOptions = {},
): JorvelMountModule {
  // One React root per mounted DOM node. A remote can, in principle, be mounted
  // into more than one node concurrently, so key by element.
  const roots = new WeakMap<HTMLElement, Root>();

  const render = (ctx: JorvelMountContext) => {
    const props: ReactRemoteProps = {
      subpath: ctx.subpath,
      basePath: ctx.basePath,
      params: ctx.params,
      ...(ctx.props !== undefined ? { props: ctx.props } : {}),
      ...(ctx.initialState !== undefined ? { initialState: ctx.initialState } : {}),
    };
    let node: React.ReactElement = React.createElement(Root, props);
    if (options.wrap) node = options.wrap(node);

    let root = roots.get(ctx.el);
    if (!root) {
      // Hydrate the server-rendered markup already in `el` when the host asks;
      // otherwise mount fresh. hydrateRoot takes the initial children directly.
      root = ctx.hydrate ? hydrateRoot(ctx.el, node) : createRoot(ctx.el);
      roots.set(ctx.el, root);
      if (ctx.hydrate) return; // hydrateRoot already rendered `node`
    }
    root.render(node);
  };

  const tearDown = (el: HTMLElement) => {
    const root = roots.get(el);
    if (!root) return;
    roots.delete(el);
    // Defer out of any React commit phase to avoid the "unmount during render" warning.
    queueMicrotask(() => root.unmount());
  };

  return {
    mount(ctx) {
      render(ctx);
      return () => tearDown(ctx.el);
    },
    unmount(el) {
      tearDown(el);
    },
  };
}
