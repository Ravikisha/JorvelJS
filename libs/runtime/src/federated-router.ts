/**
 * @jorvel/runtime — Federated Router (Phase-0/1 bridge)
 *
 * Goal: allow the host (shell) to provide the *router singleton instance* to
 * remotes via Module Federation shared modules.
 *
 * Design A: a shared singleton module.
 *
 * - Host calls `provideHostRouter(getRouter())` once during bootstrap.
 * - Remotes call `getFederatedRouter()` to access the same Router instance.
 * - If the host never provides one, remotes fall back to their local router.
 */

import type { Router } from './router.js';
import { getRouter } from './routing.js';

// Pinned to globalThis (not a module-local) so it survives DUPLICATE runtime
// bundles — the exact scenario this bridge exists for. If host and remote each
// bundle their own @jorvel/runtime, a module-local would let the host set its
// copy while the remote reads its own (null) copy and falls back to a separate
// local router. The shared global keeps them on one instance.
const HOST_ROUTER_KEY = '__JORVEL_HOST_ROUTER__';
type GlobalWithHostRouter = typeof globalThis & { [HOST_ROUTER_KEY]?: Router | null };

/**
 * Bind the host router singleton for remotes to consume.
 *
 * Call this from the host app (shell) during startup.
 */
export function provideHostRouter(router: Router) {
  (globalThis as GlobalWithHostRouter)[HOST_ROUTER_KEY] = router;
}

/**
 * Returns the federated router if the host has provided one.
 * Otherwise returns the local singleton router.
 */
export function getFederatedRouter(): Router {
  return (globalThis as GlobalWithHostRouter)[HOST_ROUTER_KEY] ?? getRouter();
}

/** @internal */
export function _resetFederatedRouter() {
  delete (globalThis as GlobalWithHostRouter)[HOST_ROUTER_KEY];
}
