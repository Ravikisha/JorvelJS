/**
 * @jorvel/adapter-svelte/server — server-side counterpart to `defineSvelteRemote`.
 *
 * Renders a Svelte 5 remote to HTML via `svelte/server` `render`. Import only
 * from server code.
 *
 * ```ts
 * import { defineSvelteServerRemote } from '@jorvel/adapter-svelte/server';
 * import Root from './Root.svelte';
 * export default defineSvelteServerRemote(Root);
 * ```
 */

import { render } from 'svelte/server';
import type { Component } from 'svelte';
import type { JorvelServerModule, JorvelSSRContext } from '@jorvel/mount/ssr';

export interface DefineSvelteServerRemoteOptions {
  head?: string;
  getState?: (ctx: JorvelSSRContext) => unknown;
}

export function defineSvelteServerRemote(
  Root: Component<Record<string, unknown>>,
  options: DefineSvelteServerRemoteOptions = {},
): JorvelServerModule {
  return {
    renderToString(ctx: JorvelSSRContext) {
      const state = options.getState?.(ctx);
      const props: Record<string, unknown> = {
        subpath: ctx.subpath,
        basePath: ctx.basePath,
        params: ctx.params,
        ...(state !== undefined ? { initialState: state } : {}),
        ...(ctx.props ?? {}),
      };
      const out = render(Root, { props }) as { body: string; head?: string };
      // svelte/server returns component-authored head separately; merge with any
      // caller-provided head.
      const head = [out.head, options.head].filter(Boolean).join('\n');
      return {
        html: out.body,
        ...(head ? { head } : {}),
        ...(state !== undefined ? { state } : {}),
      };
    },
  };
}
