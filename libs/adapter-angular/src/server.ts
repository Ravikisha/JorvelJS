/**
 * @jorvel/adapter-angular/server — server-side counterpart to
 * `defineAngularRemote`.
 *
 * Renders a standalone Angular component to an HTML string via
 * `@angular/platform-server` `renderApplication`. Import only from server code.
 * The Angular runtime is imported lazily so this module loads without Angular
 * installed (it's a peer dependency).
 *
 * ```ts
 * import { defineAngularServerRemote } from '@jorvel/adapter-angular/server';
 * import { RootComponent } from './root.component';
 * export default defineAngularServerRemote(RootComponent, { selector: 'jorvel-x-root' });
 * ```
 */

import type { Type } from '@angular/core';
import type { JorvelServerModule, JorvelSSRContext } from '@jorvel/mount/ssr';

export interface DefineAngularServerRemoteOptions {
  /** Application-level providers (HttpClient, router, provideServerRendering, …). */
  providers?: unknown[];
  /** The root component's selector — the element `renderApplication` renders into. */
  selector?: string;
  head?: string;
  getState?: (ctx: JorvelSSRContext) => unknown;
}

export function defineAngularServerRemote(
  Root: Type<unknown>,
  options: DefineAngularServerRemoteOptions = {},
): JorvelServerModule {
  const selector = options.selector ?? 'jorvel-ng-root';
  return {
    async renderToString(ctx: JorvelSSRContext) {
      // Resolve at runtime only — Angular is a peer dep, absent in envs that
      // don't do SSR. The variable+ignore hints keep bundlers from eagerly
      // resolving/bundling it.
      const load = (m: string): Promise<Record<string, unknown>> => import(/* @vite-ignore */ /* webpackIgnore: true */ m);
      const [{ renderApplication }, { bootstrapApplication }] = (await Promise.all([
        load('@angular/platform-server'),
        load('@angular/platform-browser'),
      ])) as [
        { renderApplication: (b: () => Promise<unknown>, o: { document?: string; url?: string }) => Promise<string> },
        { bootstrapApplication: (r: unknown, o?: { providers?: unknown[] }) => Promise<unknown> },
      ];
      const state = options.getState?.(ctx);
      const html = await renderApplication(
        () => bootstrapApplication(Root, { providers: options.providers ?? [] }),
        { document: `<${selector}></${selector}>`, url: ctx.subpath },
      );
      return {
        html,
        ...(options.head !== undefined ? { head: options.head } : {}),
        ...(state !== undefined ? { state } : {}),
      };
    },
  };
}
