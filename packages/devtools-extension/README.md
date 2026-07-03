# JORVEL DevTools

A Chrome DevTools extension that surfaces JORVEL Module Federation state from
`window.__JORVEL__` — loaded remotes, per-remote load timings, SRI status, and
the shared scope.

## Install (load unpacked)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder (`packages/devtools-extension`)
3. Open DevTools on any JORVEL app → the **JORVEL** panel

The panel polls the inspected page once a second. It needs the runtime devtools
namespace, which `@jorvel/runtime` populates automatically on every successful
remote load (see `window.__JORVEL__`).

## Firefox

The same MV3 sources load in Firefox via `about:debugging` → **Load Temporary
Add-on** → pick `manifest.json`.

## Publishing

Zip the folder and upload to the Chrome Web Store / AMO. No build step — the
extension is plain HTML + ES modules.
