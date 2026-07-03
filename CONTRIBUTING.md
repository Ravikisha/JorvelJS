# Contributing to JORVEL

Thanks for helping build JORVEL! This guide covers local setup, the test
layout, and the release workflow.

## Prerequisites

- **Node.js 20, 22, or 24** (all three are supported and tested in CI).
- **pnpm 9** (`packageManager` is pinned in `package.json`; run `corepack enable`
  if you don't have pnpm).

## Setup

```sh
git clone https://github.com/Ravikisha/JorvelJS.git
cd JorvelJS
pnpm install
pnpm build        # build every package (libs + CLI)
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Build all workspace packages (`tsc`). |
| `pnpm test` | Run every package's unit tests (`pnpm -r test`). |
| `pnpm test:features` | Integration tests in `tests/features/` against built `dist/` (the `pretest:features` hook builds the libs first). |
| `pnpm typecheck` | `tsc --noEmit` across packages. |
| `pnpm lint` | ESLint across packages. |
| `pnpm e2e` | Playwright end-to-end suite (see below). |

### Working on a single package

```sh
pnpm --filter @jorvel/runtime test
pnpm --filter @jorvel/runtime build
```

## Test layout

- **`libs/*/test`, `packages/cli/test`** — unit tests run against `src/` via
  vitest. This is where most coverage lives.
- **`tests/features/`** — black-box integration tests that import the **built
  `dist/`** of each package, exercising the public API exactly as published.
  Build the libs first (`pnpm test:features` does this for you). A handful of
  AsyncLocalStorage isolation assertions auto-skip outside a real Node runtime
  (vitest's module runner can't load the bundler-hidden `node:async_hooks`
  import); they run in plain Node / production.
- **`tests/e2e/`** — Playwright scenarios (direct / proxy-remotes / on-demand /
  build-output) driven by `scripts/e2e.mjs`.

### Running e2e

E2E is opt-in to keep the fast test loop fast:

```sh
JORVEL_E2E=1 pnpm e2e
```

`scripts/e2e.mjs` owns the full lifecycle — it builds, starts the per-scenario
dev servers, and invokes Playwright itself. The Playwright `webServer` is
therefore disabled by default (set `JORVEL_E2E_WEBSERVER=1` only for an ad-hoc
direct `playwright test`).

## Configuration & schemas

The workspace config contract lives in **one** place: the
`JorvelWorkspaceConfig` type and the JSON Schema in `@jorvel/types`
(`libs/types/schemas/*.json`). The CLI's config type extends it; `jorvel schema`
re-emits those same schemas; `jorvel config validate` checks a workspace's
`jorvel.config.json` against them. Don't re-declare config fields elsewhere.

## Changesets & releases

We use [changesets](https://github.com/changesets/changesets). For any change
that affects a published package, add a changeset:

```sh
pnpm changeset
```

Pick the affected packages and a semver bump, and describe the change. CI's
release workflow opens/updates a "release packages" PR; merging it publishes.

## Pull requests

- Branch off `main`.
- Keep changes focused; add or update tests for any behavior change.
- Run `pnpm typecheck && pnpm lint && pnpm test` before pushing.
- Add a changeset when a publishable package changes.
