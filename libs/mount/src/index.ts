/**
 * @jorvel/mount — the framework-neutral remote contract.
 *
 * A JORVEL host mounts a remote by handing it a DOM node and a context, then
 * calling `mount(ctx)`. The remote bootstraps *whatever framework it wants*
 * into that node and returns a disposer. This is the seam that lets a React
 * host embed a Vue / Angular / Solid / Svelte remote (and vice-versa) — the
 * host never imports the remote's framework.
 *
 * React remotes get this contract for free via `@jorvel/adapter-react`
 * (`defineReactRemote`). Other frameworks implement `mount`/`unmount` directly
 * or through their own adapter.
 *
 * This package is zero-dependency and framework-free on purpose.
 */

/** Disposer returned from `mount` — tears the remote back down. */
export type JorvelUnmount = () => void;

/**
 * Everything the host gives a remote when mounting it. Framework-neutral: no
 * React types leak across this boundary.
 */
export interface JorvelMountContext {
  /** The DOM node the remote owns. The remote renders into this and nothing else. */
  el: HTMLElement;
  /** Path relative to the remote's mount prefix, e.g. "/reports/42". Always starts with "/". */
  subpath: string;
  /** The prefix the host mounted this remote under, e.g. "/dashboard". */
  basePath: string;
  /** Route params matched by the host, e.g. `{ id: "42" }`. */
  params: Record<string, string>;
  /** Arbitrary props the host chose to pass through. */
  props?: Record<string, unknown>;
  /** Aborted when the host unmounts or navigates away — remotes should honor it. */
  signal?: AbortSignal;
  /**
   * When true, `el` already contains server-rendered markup for this remote —
   * the adapter should HYDRATE it (reuse the DOM) instead of rendering fresh.
   * See `@jorvel/mount/ssr`.
   */
  hydrate?: boolean;
  /** Serializable state emitted by the server render, for hydration. */
  initialState?: unknown;
}

/**
 * A remote module in neutral form. `mount` may return a disposer (or a promise
 * of one); `unmount` is an optional explicit teardown the host also calls.
 */
export interface JorvelMountModule {
  mount(ctx: JorvelMountContext): void | JorvelUnmount | Promise<void | JorvelUnmount>;
  unmount?(el: HTMLElement): void;
}

/**
 * Duck-typed guard: a value is a mount module if it exposes a `mount` function.
 * Deliberately structural so remotes built by any adapter (or hand-written)
 * satisfy it without importing this package.
 */
export function isMountModule(value: unknown): value is JorvelMountModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { mount?: unknown }).mount === 'function'
  );
}

/**
 * Unwrap a federated module to its mount module, if it is one. Accepts either
 * the module namespace (`{ default: <mountModule> }`) or the mount module
 * directly. Returns `null` when the value is not a mount module (e.g. a legacy
 * React-component default), so callers can fall back.
 */
export function asMountModule(mod: unknown): JorvelMountModule | null {
  if (isMountModule(mod)) return mod;
  const def = (mod as { default?: unknown } | null)?.default;
  if (isMountModule(def)) return def;
  return null;
}

/**
 * Framework-neutral host helper: mount a remote module into `el` and get back a
 * single disposer that runs the returned teardown *and* `unmount(el)`, and is
 * idempotent. Use this from a plain-DOM host; React hosts use the bridge in
 * `@jorvel/runtime` instead.
 */
export function mountRemoteModule(
  module: JorvelMountModule,
  ctx: JorvelMountContext,
): JorvelUnmount {
  let disposed = false;
  let dispose: JorvelUnmount | void;

  const result = module.mount(ctx);
  if (result instanceof Promise) {
    void result.then((d) => {
      // If the host already tore down before mount resolved, dispose immediately.
      if (disposed) {
        d?.();
        return;
      }
      dispose = d;
    });
  } else {
    dispose = result;
  }

  return () => {
    if (disposed) return;
    disposed = true;
    try {
      dispose?.();
    } finally {
      module.unmount?.(ctx.el);
    }
  };
}

export {
  toCustomElement,
  defineCustomElement,
  type CustomElementOptions,
} from './custom-element.js';

export {
  isServerModule,
  asServerModule,
  renderFragment,
  composeFragments,
  serializeState,
  readSSRState,
  hydrateFragments,
  FRAGMENT_ATTR,
  SSR_STATE_ID,
  type JorvelSSRContext,
  type JorvelSSRResult,
  type JorvelServerModule,
  type JorvelFragment,
  type ComposeOptions,
  type ComposeResult,
  type FragmentLoaders,
  type HydrateFragmentsOptions,
} from './ssr.js';
