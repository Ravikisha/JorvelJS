# JORVEL examples

Every example is a **real JORVEL app** — not a `.mjs` demo. Each is a small
scaffold script that runs the real `jorvel generate` CLI, so the output is
actual, current framework source: `.tsx` / `.jsx` / `.vue` / `.svelte` / `.ts`,
exactly what you'd write by hand. Just like `create-react-app` / `create-vue` /
Angular CLI — the template lives in the CLI, you generate the app.

| # | Example | What it shows |
| --- | --- | --- |
| 01 | [`01-react-ts`](./01-react-ts) | React host + remote in **TypeScript** (`.tsx`) |
| 02 | [`02-react-js`](./02-react-js) | React host + remote in **JavaScript** (`.jsx` + `jsconfig`) |
| 03 | [`03-vue`](./03-vue) | React host + **Vue 3** remote (`.vue` SFC) via the mount contract |
| 04 | [`04-polyglot`](./04-polyglot) | React host + **React/Vue/Angular/Solid/Svelte** remotes, all Tailwind |
| 05 | [`05-tailwind`](./05-tailwind) | React host + remote with **Tailwind v4** (PostCSS via rspack) |
| 06 | [`06-shadcn`](./06-shadcn) | React remote ready for **shadcn/ui** |

**All six have committed source** you can browse and run directly (they double as
the framework's starter **templates**). Every one is verified to compile + run
its dev server. Re-generate any from current CLI templates with `pnpm scaffold`.

## Run any example

```sh
pnpm install                 # from the repo root, once
cd examples/01-react-ts
jorvel dev                   # host :3000 loads its remote(s) — open http://localhost:3000
```

Source lives under each example's `apps/`. Build artifacts (`dist/`,
`node_modules`) are git-ignored; regenerate the apps from current CLI templates
any time with `pnpm scaffold`.

## Choosing framework + language yourself

Skip the scaffold script and run the CLI directly — it prompts for framework,
language, and Tailwind, or take them as flags:

```sh
jorvel generate remote checkout            # interactive: framework? · js/ts? · Tailwind?
jorvel generate remote checkout --framework vue --lang js --tailwind
jorvel generate remote checkout --framework angular          # Angular is TypeScript-only
```

## Which surface each example exercises

| Surface | 01 | 02 | 03 | 04 | 05 | 06 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| React host + Module Federation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TypeScript | ✅ |  | ✅ | ✅ | ✅ | ✅ |
| JavaScript |  | ✅ |  |  |  |  |
| Cross-framework mount contract |  |  | ✅ | ✅ |  |  |
| Tailwind CSS |  |  |  | ✅ | ✅ | ✅ |
| shadcn/ui |  |  |  |  |  | ✅ |

## Learn more

- Tutorial → https://jorveljs.vercel.app/docs/tutorial
- Cross-framework → https://jorveljs.vercel.app/docs/cross-framework
- Polyglot monorepo → https://jorveljs.vercel.app/docs/polyglot
