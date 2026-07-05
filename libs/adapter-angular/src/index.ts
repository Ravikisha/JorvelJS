/**
 * @jorvel/adapter-angular — expose a standalone Angular component as a
 * framework-neutral `@jorvel/mount` remote.
 *
 * ```ts
 * import { defineAngularRemote } from '@jorvel/adapter-angular';
 * import { RootComponent } from './root.component';
 * export default defineAngularRemote(RootComponent);
 * ```
 *
 * Uses the modern standalone bootstrap API (`createApplication` +
 * `createComponent`) — no NgModule required. The root component should declare
 * `@Input()` fields for `subpath`, `basePath`, and `params` to receive routing
 * context from the host.
 */

import type { ApplicationRef, ComponentRef, Type } from '@angular/core';
import type { JorvelMountContext, JorvelMountModule } from '@jorvel/mount';

export interface DefineAngularRemoteOptions {
  /** Application-level providers (HttpClient, router, etc.). */
  providers?: unknown[];
}

/** Inputs the host sets on the root component (when declared as `@Input()`). */
export interface AngularRemoteInputs {
  subpath: string;
  basePath: string;
  params: Record<string, string>;
}

function setInputs<C>(ref: ComponentRef<C>, ctx: JorvelMountContext): void {
  const inputs: Record<string, unknown> = {
    subpath: ctx.subpath,
    basePath: ctx.basePath,
    params: ctx.params,
    ...(ctx.props ?? {}),
  };
  for (const [key, value] of Object.entries(inputs)) {
    // setInput no-ops safely for names the component doesn't declare as inputs
    // in dev, and Angular guards it in prod — wrap so an undeclared input can't
    // abort the whole mount.
    try {
      ref.setInput(key, value);
    } catch {
      /* input not declared on the component — ignore */
    }
  }
}

export function defineAngularRemote(
  Root: Type<unknown>,
  options: DefineAngularRemoteOptions = {},
): JorvelMountModule {
  const apps = new WeakMap<HTMLElement, ApplicationRef>();

  const tearDown = (el: HTMLElement) => {
    const app = apps.get(el);
    if (!app) return;
    apps.delete(el);
    app.destroy();
  };

  return {
    mount(ctx) {
      let disposed = false;

      // Import Angular's runtime lazily so this module can load in environments
      // that don't have @angular installed (the adapter is peer-only); the
      // import only happens when a remote is actually mounted.
      void (async () => {
        const [{ createApplication }, { createComponent }] = await Promise.all([
          import('@angular/platform-browser'),
          import('@angular/core'),
        ]);
        const app = await createApplication({ providers: options.providers ?? [] });
        if (disposed) {
          app.destroy();
          return;
        }
        apps.set(ctx.el, app);
        const ref = createComponent(Root, {
          environmentInjector: app.injector,
          hostElement: ctx.el,
        });
        setInputs(ref, ctx);
        app.attachView(ref.hostView);
        app.tick();
      })().catch((err: unknown) => {
        ctx.el.textContent = err instanceof Error ? err.message : String(err);
      });

      return () => {
        disposed = true;
        tearDown(ctx.el);
      };
    },
    unmount(el) {
      tearDown(el);
    },
  };
}
