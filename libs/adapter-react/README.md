# @jorvel/adapter-react

Expose a React remote through the framework-neutral
[`@jorvel/mount`](../mount) contract, so any JORVEL host can embed it.

```tsx
import { defineReactRemote } from '@jorvel/adapter-react';
import { RemoteApp } from '@jorvel/runtime';
import { pages } from './jorvel.routes.js';

export default defineReactRemote(({ subpath }) => (
  <RemoteApp subpath={subpath} pages={pages} />
));
```

The host mounts this into a DOM node it owns; each mount gets its own
`react-dom` root, isolated from the host tree.

## Root props

Your root component receives (`ReactRemoteProps`):

| Prop | Type | From |
| --- | --- | --- |
| `subpath` | `string` | path relative to the mount prefix |
| `basePath` | `string` | the prefix the host mounted under |
| `params` | `Record<string,string>` | route params matched by the host |
| `props` | `Record<string,unknown>?` | host-passed props |

## Options

```tsx
defineReactRemote(Root, {
  wrap: (node) => <MyProviders>{node}</MyProviders>, // providers / boundary / StrictMode
});
```

## Back-compat

Remotes that still `export default <ReactComponent>` (the pre-mount contract)
keep working — `@jorvel/runtime`'s `RemoteOutlet` renders a React-component
default directly and only takes the mount path when it detects a mount module.
`defineReactRemote` is the forward-compatible way to expose a remote.
