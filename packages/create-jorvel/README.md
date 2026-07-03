# create-jorvel

Scaffold a new [JORVEL](https://jorveljs.vercel.app) micro-frontend workspace.

```sh
npm create jorvel@latest my-app
# or
pnpm create jorvel my-app
yarn create jorvel my-app
bun create jorvel my-app
```

It forwards every argument to `jorvel init`, so all flags work:

```sh
npm create jorvel@latest my-app -- --template saas --pm pnpm --tailwind
```

| Flag | Values | Default |
| --- | --- | --- |
| `--template` | `host-remote` · `saas` · `blank` | `host-remote` |
| `--pm` | `pnpm` · `npm` · `yarn` · `bun` | `pnpm` |
| `--tailwind` | enable Tailwind in generated apps | off |
| `--no-git` | skip `git init` | — |
| `--no-ai` | skip AI coding-agent config | — |

Run interactively (TTY) and you'll get a template + package-manager picker. See the
[Getting started](https://jorveljs.vercel.app/docs/getting-started) docs.
