# JORVEL Basic Example

This is a minimal runnable example workspace generated to prove the current JORVEL Module Federation wiring works end-to-end.

## What it contains

- `apps/shell` (host)
- `apps/dashboard` (remote)

Both apps use **Rspack**.

## How to run

From the repo root:

```sh
cd examples/basic
pnpm install

# Start both apps via the JORVEL CLI (recommended). `pnpm dev` builds the CLI
# (predev hook) then runs `jorvel dev --dir .` from this example.
pnpm dev

# Same-origin proxy mode — forward flags to the CLI with `--`:
pnpm dev -- --proxy-remotes

# Optional: also enable remote rebuild -> host reload
# pnpm dev -- --proxy-remotes --hmr-remotes
```

Then open:

- http://localhost:3000

You should see the host page and the remote rendered inside it.

## Notes

- The host expects the remote entry at `http://localhost:3001/remoteEntry.js`.
- If you change ports, regenerate federation configs (or edit `apps/shell/jorvel.federation.json`).
