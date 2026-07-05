# 03 · React host + Vue remote

A React host embedding a real **Vue 3** SFC remote via the framework-neutral `@jorvel/mount` contract. The host never imports Vue.

The source is **committed** here — browse `apps/` and run it directly.

## Run it

```sh
pnpm install                       # from the repo root, once
cd examples/03-vue
jorvel dev                         # host on :3000, loads the remote(s)
```

| File | What |
| --- | --- |
| `apps/storefront/src/Root.vue` | Vue SFC (`<script setup lang="ts">`) |
| `apps/storefront/src/remote.ts` | `export default defineVueRemote(Root)` |
| `apps/shell/src/bootstrap.tsx` | React host, mounts the Vue remote |

## Regenerate

```sh
pnpm scaffold                      # re-runs the CLI to regenerate apps/ from current templates
```
