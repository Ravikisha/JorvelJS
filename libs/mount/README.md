# @jorvel/mount

The **framework-neutral remote contract** for JORVEL micro-frontends.

A host mounts a remote by handing it a DOM node + context and calling
`mount(ctx)`. The remote bootstraps whatever framework it likes into that node
and returns a disposer. The host never imports the remote's framework — so a
React host can embed a Vue / Angular / Solid / Svelte remote, and vice-versa.

```ts
export interface JorvelMountModule {
  mount(ctx: JorvelMountContext): void | JorvelUnmount | Promise<void | JorvelUnmount>;
  unmount?(el: HTMLElement): void;
}

export interface JorvelMountContext {
  el: HTMLElement;                    // the node the remote owns
  subpath: string;                    // path relative to the mount prefix
  basePath: string;                   // the prefix the host mounted under
  params: Record<string, string>;     // route params
  props?: Record<string, unknown>;    // host-passed props
  signal?: AbortSignal;               // aborted on unmount/navigation
}
```

## Authoring a remote

- **React** → use `@jorvel/adapter-react`'s `defineReactRemote(Component)`.
- **Any framework** → export a `JorvelMountModule` directly:

```ts
import type { JorvelMountModule } from '@jorvel/mount';

const remote: JorvelMountModule = {
  mount({ el, subpath }) {
    const app = createMyFrameworkApp(subpath);
    app.mount(el);
    return () => app.destroy();
  },
};
export default remote;
```

## Mounting from a plain-DOM host

```ts
import { asMountModule, mountRemoteModule } from '@jorvel/mount';

const mod = asMountModule(await importRemote());
if (mod) {
  const dispose = mountRemoteModule(mod, { el, subpath, basePath, params });
  // …later, on navigation away:
  dispose();
}
```

React hosts don't call this directly — `@jorvel/runtime`'s `RemoteOutlet`
detects a mount module and bridges it automatically.

## Web Component embed

Wrap any mount module as a custom element for non-JORVEL / plain-HTML hosts:

```ts
import { defineCustomElement } from '@jorvel/mount';
defineCustomElement('jorvel-pricing', remote);
```

```html
<jorvel-pricing subpath="/plans" basepath="/pricing"></jorvel-pricing>
```

## Cross-framework SSR — `@jorvel/mount/ssr`

Server-render each framework's fragment, stitch, and hydrate:

```ts
import { renderFragment, composeFragments, hydrateFragments } from '@jorvel/mount/ssr';

// server
const fragments = await Promise.all([
  renderFragment('pricing', pricingServer, ctx),
  renderFragment('reports', reportsServer, ctx),
]);
const { html } = composeFragments(fragments, { template });

// client
await hydrateFragments({
  pricing: () => import('pricing/App'),
  reports: () => import('reports/App'),
});
```

A remote's server side is a `JorvelServerModule` (`renderToString(ctx)`); the
matching client mount honors `ctx.hydrate` to reuse the server DOM. See
[the guide](https://jorveljs.vercel.app/docs/cross-framework#ssr).

Zero dependencies, framework-free.
