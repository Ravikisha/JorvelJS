---
name: vue-remote
description: Build and modify the pricing Vue 3 remote — mount contract, exposed ./App, framework conventions. Trigger when work is scoped to apps/pricing/.
---

# pricing — Vue 3 remote

This app is a **Vue 3** micro-frontend, embedded by the React host through the
framework-neutral `@jorvel/mount` contract. The host never imports Vue 3.

## Conventions
- Root SFC: `src/Root.vue` — receives `subpath`, `basePath`, `params` as props.
- Exposed entry: `src/remote.ts` → `export default defineVueRemote(Root)`.
- Plugins (router, pinia, i18n) go in the `setup` option of `defineVueRemote`.
- SFCs compile via `vue-loader`; `.ts` via swc.

## Boundaries
- `src/remote.ts` exposes `./App` (the mount module) — this is the federation contract. Don't rename the default export.
- The host mounts into a DOM node it owns and passes `{ subpath, basePath, params }`; read routing from those, not from `window.location` directly.
- Cross-remote/host communication goes through `@jorvel/event-bus` / `@jorvel/state` (plain-JS) or DOM `CustomEvent`s — never a shared framework context.
- `rspack.config.mjs` is generated — regenerate via the CLI, don't hand-edit the federation block.
- After adding pages/routes, keep them internal to this remote (pricing owns `/pricing/*`).
