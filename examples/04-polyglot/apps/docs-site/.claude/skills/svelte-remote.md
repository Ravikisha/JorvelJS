---
name: svelte-remote
description: Build and modify the docs-site Svelte 5 remote — mount contract, exposed ./App, framework conventions. Trigger when work is scoped to apps/docs-site/.
---

# docs-site — Svelte 5 remote

This app is a **Svelte 5** micro-frontend, embedded by the React host through the
framework-neutral `@jorvel/mount` contract. The host never imports Svelte 5.

## Conventions
- Root: `src/Root.svelte` — props via `$props()` (`subpath`, `basePath`, `params`).
- Exposed entry: `src/remote.ts` → `export default defineSvelteRemote(Root)`.
- Uses the Svelte 5 `mount`/`unmount` runtime API; components compile via `svelte-loader`.

## Boundaries
- `src/remote.ts` exposes `./App` (the mount module) — this is the federation contract. Don't rename the default export.
- The host mounts into a DOM node it owns and passes `{ subpath, basePath, params }`; read routing from those, not from `window.location` directly.
- Cross-remote/host communication goes through `@jorvel/event-bus` / `@jorvel/state` (plain-JS) or DOM `CustomEvent`s — never a shared framework context.
- `rspack.config.mjs` is generated — regenerate via the CLI, don't hand-edit the federation block.
- After adding pages/routes, keep them internal to this remote (docs-site owns `/docs-site/*`).
