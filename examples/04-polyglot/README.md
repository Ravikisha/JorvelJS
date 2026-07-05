# 04 · Polyglot (5 frameworks)

One React host federating **React, Vue, Angular, Solid, and Svelte** remotes — real source in each, all Tailwind (v4), all mounted through `@jorvel/mount`. Verified: every remote compiles + dev-serves.

The source is **committed** here — browse `apps/` and run it directly.

## Run it

```sh
pnpm install                       # from the repo root, once
cd examples/04-polyglot
jorvel dev                         # host on :3000, loads the remote(s)
```

| Remote | Framework file |
| --- | --- |
| `apps/dashboard/src/pages/index.tsx` | React |
| `apps/pricing/src/Root.vue` | Vue SFC |
| `apps/reports/src/root.component.ts` | Angular standalone component |
| `apps/widgets/src/Root.tsx` | Solid |
| `apps/docs-site/src/Root.svelte` | Svelte 5 |

Federation shares each app’s own runtime as a singleton; `@jorvel/event-bus` is shared across all. Cross-framework talk goes through the bus.

## Regenerate

```sh
pnpm scaffold                      # re-runs the CLI to regenerate apps/ from current templates
```
