# 05 · Tailwind CSS

A React host + remote with **Tailwind v4** wired through PostCSS/rspack (`@tailwindcss/postcss` + `@import "tailwindcss"`). Verified: dev server compiles.

The source is **committed** here — browse `apps/` and run it directly.

## Run it

```sh
pnpm install                       # from the repo root, once
cd examples/05-tailwind
jorvel dev                         # host on :3000, loads the remote(s)
```

| File | What |
| --- | --- |
| `apps/marketing/src/styles.css` | `@import "tailwindcss"` |
| `apps/marketing/postcss.config.cjs` | `@tailwindcss/postcss` plugin |
| `apps/marketing/src/pages/index.tsx` | React page using utility classes |

## Regenerate

```sh
pnpm scaffold                      # re-runs the CLI to regenerate apps/ from current templates
```
