# @jorvel/adapter-solid

Expose a **SolidJS** remote through the framework-neutral
[`@jorvel/mount`](../mount) contract.

```tsx
import { defineSolidRemote } from '@jorvel/adapter-solid';
import type { SolidRemoteProps } from '@jorvel/adapter-solid';

function Root(props: SolidRemoteProps) {
  return <span>{props.subpath}</span>;
}

export default defineSolidRemote(Root);
```

The root receives `subpath`, `basePath`, `params` (and any host `props`). Each
mount owns its own Solid reactive root and is disposed on teardown.

`solid-js` is a peer dependency — the remote app provides it (plus
`babel-preset-solid` / `vite-plugin-solid` in its build).
