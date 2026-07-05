# @jorvel/adapter-vue

Expose a **Vue 3** remote through the framework-neutral
[`@jorvel/mount`](../mount) contract, so any JORVEL host can embed it.

```ts
import { defineVueRemote } from '@jorvel/adapter-vue';
import Root from './Root.vue';

export default defineVueRemote(Root);
```

The root component receives `subpath`, `basePath`, `params` (and any host
`props`) as Vue props. Each mount gets its own Vue app instance, isolated from
the host.

## Options

```ts
defineVueRemote(Root, {
  setup: (app, ctx) => {
    app.use(createRouter(/* … */)); // plugins, i18n, pinia, a router…
  },
});
```

`vue` is a peer dependency — the remote app provides it.
