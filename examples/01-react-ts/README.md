# 01-react-ts

React host + remote in **TypeScript** — a real, runnable federated app. The source
is committed here (browse `apps/shell` and `apps/dashboard`), so you can read
and run it directly.

## Run it

```sh
pnpm install                       # from the repo root, once
cd examples/01-react-ts
jorvel dev                         # host on :3000, loads the dashboard remote
```

Open http://localhost:3000 — the host renders its welcome shell; the dashboard
remote renders a styled, interactive page (`apps/dashboard/src/pages/index.*`)
with live React state, proving it's a real running app.

## Add another remote (auto-wired)

```sh
jorvel generate remote pricing     # prompts framework/language; wires into the host
```

The new remote is auto-configured into the host (federation + routes + REMOTES map).

## Regenerate from scratch

```sh
pnpm scaffold                      # re-runs the CLI to regenerate apps/ (real source)
```
