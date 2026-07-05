---
name: angular-remote
description: Build and modify the reports Angular remote — mount contract, exposed ./App, framework conventions. Trigger when work is scoped to apps/reports/.
---

# reports — Angular remote

This app is a **Angular** micro-frontend, embedded by the React host through the
framework-neutral `@jorvel/mount` contract. The host never imports Angular.

## Conventions
- Root: `src/root.component.ts` — a **standalone** `@Component` with `@Input()` `subpath`/`basePath`/`params`.
- Exposed entry: `src/remote.ts` → `export default defineAngularRemote(RootComponent)` (imports `zone.js` first).
- App-level providers (HttpClient, router) go in the `defineAngularRemote(..., { providers })` option.
- Bootstraps with the standalone API (`createApplication` + `createComponent`) in JIT mode — no NgModule.

## Boundaries
- `src/remote.ts` exposes `./App` (the mount module) — this is the federation contract. Don't rename the default export.
- The host mounts into a DOM node it owns and passes `{ subpath, basePath, params }`; read routing from those, not from `window.location` directly.
- Cross-remote/host communication goes through `@jorvel/event-bus` / `@jorvel/state` (plain-JS) or DOM `CustomEvent`s — never a shared framework context.
- `rspack.config.mjs` is generated — regenerate via the CLI, don't hand-edit the federation block.
- After adding pages/routes, keep them internal to this remote (reports owns `/reports/*`).
