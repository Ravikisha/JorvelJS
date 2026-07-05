---
name: solid-remote
description: Build and modify the widgets SolidJS remote — mount contract, exposed ./App, framework conventions. Trigger when work is scoped to apps/widgets/.
---

# widgets — SolidJS remote

This app is a **SolidJS** micro-frontend, embedded by the React host through the
framework-neutral `@jorvel/mount` contract. The host never imports SolidJS.

## Conventions
- Root: `src/Root.tsx` — a Solid component taking `SolidRemoteProps`.
- Exposed entry: `src/remote.ts` → `export default defineSolidRemote(Root)`.
- JSX compiles via `babel-preset-solid` (babel-loader). Solid reactivity works normally inside the mounted subtree.

## Boundaries
- `src/remote.ts` exposes `./App` (the mount module) — this is the federation contract. Don't rename the default export.
- The host mounts into a DOM node it owns and passes `{ subpath, basePath, params }`; read routing from those, not from `window.location` directly.
- Cross-remote/host communication goes through `@jorvel/event-bus` / `@jorvel/state` (plain-JS) or DOM `CustomEvent`s — never a shared framework context.
- `rspack.config.mjs` is generated — regenerate via the CLI, don't hand-edit the federation block.
- After adding pages/routes, keep them internal to this remote (widgets owns `/widgets/*`).
