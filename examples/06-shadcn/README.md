# 06 · shadcn/ui

A Tailwind-v4 React remote ready for **[shadcn/ui](https://ui.shadcn.com)**. Scaffold, then `npx shadcn@latest init` drops the token theme + components in.

The source is **committed** here — browse `apps/` and run it directly.

## Run it

```sh
pnpm install                       # from the repo root, once
cd examples/06-shadcn
jorvel dev                         # host on :3000, loads the remote(s)
```

| File | What |
| --- | --- |
| `apps/ui/postcss.config.cjs` | Tailwind v4 PostCSS |
| `apps/ui/src/pages/index.tsx` | React page |

## Add shadcn/ui

```sh
cd apps/ui
npx shadcn@latest init
npx shadcn@latest add button card input
```

## Regenerate

```sh
pnpm scaffold                      # re-runs the CLI to regenerate apps/ from current templates
```
