/**
 * Cross-framework SSR primitives for JORVEL.
 *
 * The client mount contract (`@jorvel/mount`) is framework-neutral; so is its
 * server side. A remote can expose a **server module** that renders its markup
 * to an HTML string on the server; the host stitches every framework's fragment
 * into one document, and on the client each fragment is re-mounted with
 * `hydrate: true` (the adapter reuses the server DOM).
 *
 * This module is pure + zero-dependency — it does not run any framework
 * renderer itself. Adapters provide `renderToString` (e.g. via react-dom/server,
 * @vue/server-renderer); this composes their output.
 */

/** Context handed to a remote's server renderer. Mirrors the client mount context, sans DOM. */
export interface JorvelSSRContext {
  subpath: string;
  basePath: string;
  params: Record<string, string>;
  props?: Record<string, unknown>;
}

/** A server render result. A bare string is shorthand for `{ html }`. */
export interface JorvelSSRResult {
  /** Rendered fragment markup. */
  html: string;
  /** Head tags to hoist into the document (styles, preloads, etc.). */
  head?: string;
  /** Serializable state to ship for client hydration (becomes `ctx.initialState`). */
  state?: unknown;
}

/** A remote's server-side counterpart to `JorvelMountModule`. */
export interface JorvelServerModule {
  renderToString(ctx: JorvelSSRContext): string | JorvelSSRResult | Promise<string | JorvelSSRResult>;
}

/** Duck-typed guard: exposes a `renderToString` function. */
export function isServerModule(value: unknown): value is JorvelServerModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { renderToString?: unknown }).renderToString === 'function'
  );
}

/** Unwrap a federated module to its server module (`{ default }` or bare), else null. */
export function asServerModule(mod: unknown): JorvelServerModule | null {
  if (isServerModule(mod)) return mod;
  const def = (mod as { default?: unknown } | null)?.default;
  if (isServerModule(def)) return def;
  return null;
}

import { asMountModule, mountRemoteModule, type JorvelUnmount } from './index.js';

/** A server-rendered fragment, ready to stitch into a document. */
export interface JorvelFragment {
  /** Stable id — usually the remote name. The client mounts the matching remote here. */
  id: string;
  html: string;
  head?: string;
  state?: unknown;
  /** Routing context — stamped as data-attributes so the client can hydrate with it. */
  ctx?: { subpath: string; basePath: string; params: Record<string, string> };
}

/**
 * Run a server module's renderer and normalize the result to a `JorvelFragment`.
 */
export async function renderFragment(
  id: string,
  server: JorvelServerModule,
  ctx: JorvelSSRContext,
): Promise<JorvelFragment> {
  const out = await server.renderToString(ctx);
  if (typeof out === 'string') return { id, html: out };
  return {
    id,
    html: out.html,
    ...(out.head !== undefined ? { head: out.head } : {}),
    ...(out.state !== undefined ? { state: out.state } : {}),
  };
}

/** Marker attribute the client bootstrap uses to find a fragment's mount point. */
export const FRAGMENT_ATTR = 'data-jorvel-fragment';
/** Element id holding the serialized per-fragment hydration state. */
export const SSR_STATE_ID = '__jorvel_ssr_state__';

// Matches <, >, & and the two JS-hostile line terminators (U+2028/U+2029).
// Built via RegExp() with escapes so no exotic literals live in this source file.
const UNSAFE_JSON = new RegExp('[<>&\\u2028\\u2029]', 'g');

/** JSON-serialize safely for inline `<script>` embedding (escapes <, >, & and JS line terminators). */
export function serializeState(state: Record<string, unknown>): string {
  return JSON.stringify(state).replace(UNSAFE_JSON, (c) => {
    const hex = c.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${hex}`;
  });
}

export interface ComposeOptions {
  /** Element used to wrap each fragment's mount point. Default: 'div'. */
  tag?: string;
  /**
   * Full-document template. `{{head}}`, `{{body}}`, `{{state}}` are replaced.
   * When omitted, only the composed body markup is returned in `html`.
   */
  template?: string;
}

export interface ComposeResult {
  /** Fragments wrapped in mount-point elements, concatenated. */
  body: string;
  /** All fragment heads concatenated. */
  head: string;
  /** The `<script type="application/json">` tag carrying hydration state. */
  state: string;
  /** Full document if a template was given; otherwise the body. */
  html: string;
}

/**
 * Stitch fragments into markup. Each fragment becomes
 * `<tag data-jorvel-fragment="id">…html…</tag>`; a state script carries every
 * fragment's `state` keyed by id for the client to hydrate against.
 */
export function composeFragments(fragments: JorvelFragment[], options: ComposeOptions = {}): ComposeResult {
  const tag = options.tag ?? 'div';
  const body = fragments
    .map((f) => {
      const attrs = [`${FRAGMENT_ATTR}="${escapeAttr(f.id)}"`];
      if (f.ctx) {
        attrs.push(`data-subpath="${escapeAttr(f.ctx.subpath)}"`);
        attrs.push(`data-basepath="${escapeAttr(f.ctx.basePath)}"`);
        attrs.push(`data-params="${escapeAttr(JSON.stringify(f.ctx.params))}"`);
      }
      return `<${tag} ${attrs.join(' ')}>${f.html}</${tag}>`;
    })
    .join('\n');
  const head = fragments.map((f) => f.head ?? '').filter(Boolean).join('\n');

  const stateMap: Record<string, unknown> = {};
  for (const f of fragments) if (f.state !== undefined) stateMap[f.id] = f.state;
  const state = Object.keys(stateMap).length
    ? `<script id="${SSR_STATE_ID}" type="application/json">${serializeState(stateMap)}</script>`
    : '';

  const html = options.template
    ? options.template
        .replace('{{head}}', head)
        .replace('{{body}}', body)
        .replace('{{state}}', state)
    : body;

  return { body, head, state, html };
}

/** Read the per-fragment hydration state emitted by `composeFragments` (client side). */
export function readSSRState(doc: Document = globalThis.document): Record<string, unknown> {
  const el = doc.getElementById(SSR_STATE_ID);
  if (!el?.textContent) return {};
  try {
    return JSON.parse(el.textContent) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function parseParamsAttr(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const p: unknown = JSON.parse(raw);
    if (p && typeof p === 'object') return p as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

/** Loader per fragment id — returns the remote module (namespace or bare). */
export type FragmentLoaders = Record<string, () => Promise<unknown>>;

export interface HydrateFragmentsOptions {
  doc?: Document;
}

/**
 * Client-side closer for cross-framework SSR: find every server-rendered
 * fragment (`[data-jorvel-fragment]`), load its remote, and mount it with
 * `hydrate: true` — reusing the server DOM and seeding `initialState` from the
 * emitted state script. Returns a disposer that unmounts all of them.
 */
export async function hydrateFragments(
  loaders: FragmentLoaders,
  options: HydrateFragmentsOptions = {},
): Promise<JorvelUnmount> {
  const doc = options.doc ?? globalThis.document;
  const state = readSSRState(doc);
  const nodes = Array.from(doc.querySelectorAll(`[${FRAGMENT_ATTR}]`));
  const disposers: JorvelUnmount[] = [];

  await Promise.all(
    nodes.map(async (node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute(FRAGMENT_ATTR);
      if (!id) return;
      const loader = loaders[id];
      if (!loader) return;
      const mod = asMountModule(await loader());
      if (!mod) return;
      const initialState = (state as Record<string, unknown>)[id];
      disposers.push(
        mountRemoteModule(mod, {
          el,
          subpath: el.getAttribute('data-subpath') ?? '/',
          basePath: el.getAttribute('data-basepath') ?? '/',
          params: parseParamsAttr(el.getAttribute('data-params')),
          hydrate: true,
          ...(initialState !== undefined ? { initialState } : {}),
        }),
      );
    }),
  );

  return () => {
    for (const d of disposers) d();
  };
}
