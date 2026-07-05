# docs-site

A **Svelte 5** micro-frontend remote, embedded by the React host through the
framework-neutral [`@jorvel/mount`](https://jorveljs.vercel.app/docs/cross-framework) contract.

## Develop

```sh
pnpm dev            # rspack serve — runs this remote standalone on its port
```

Standalone, `src/bootstrap.ts` mounts the remote's exposed `./App` into `#root`
using the exact contract the host uses in production.

## Build

```sh
pnpm build          # bundle into dist/
pnpm start          # preview the production build
```

## Federation

- `src/remote.ts` exposes `./App` — `export default defineSvelteRemote(Root)`.
- Run `jorvel federation` at the workspace root to (re)generate `jorvel.federation.json`.
- The host mounts this remote at `/docs-site/*` and passes `{ subpath, basePath, params }`.

## Layout

| File | Purpose |
| --- | --- |
| `src/remote.ts` | Exposed `./App` — the mount module (federation contract) |
| `src/Root.svelte` | Sample root component (edit freely) |
| `src/bootstrap.ts` | Standalone dev mount |
| `rspack.config.mjs` | Generated — regenerate via the CLI |

> Svelte 5 remotes are an experimental JORVEL scaffold. The mount contract is
> stable; the build config is a starting point — tune it for your app.

Full guide → https://jorveljs.vercel.app/docs/cross-framework
