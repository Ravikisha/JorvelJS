# @jorvel/adapter-svelte

Expose a **Svelte 5** remote through the framework-neutral
[`@jorvel/mount`](../mount) contract.

```ts
import { defineSvelteRemote } from '@jorvel/adapter-svelte';
import Root from './Root.svelte';

export default defineSvelteRemote(Root);
```

The root component receives `subpath`, `basePath`, `params` (and any host
`props`) as Svelte props. Uses the Svelte 5 `mount`/`unmount` API — each mount
is isolated and torn down on dispose.

`svelte` is a peer dependency — the remote app provides it (with
`@sveltejs/vite-plugin-svelte` or the Rspack Svelte loader in its build).
