/**
 * Web Component embed — wrap a `JorvelMountModule` as a custom element so it can
 * be dropped into ANY host: a non-JORVEL app, plain HTML, or a page owned by a
 * different framework. The element reads routing context from attributes and
 * drives the mount lifecycle from its connect/disconnect callbacks.
 *
 * ```html
 * <jorvel-pricing subpath="/plans" basepath="/pricing"></jorvel-pricing>
 * ```
 */

import {
  mountRemoteModule,
  type JorvelMountContext,
  type JorvelMountModule,
  type JorvelUnmount,
} from './index.js';

export interface CustomElementOptions {
  /**
   * Render into a shadow root instead of the element's light DOM.
   * `true` → 'open'. Default: light DOM (no shadow) so the host's CSS applies.
   */
  shadow?: boolean | 'open' | 'closed';
  /**
   * Extra attribute names to forward as `props` (in addition to `subpath`,
   * `basepath`, `params`). Kebab-case attributes arrive camelCased in `props`.
   */
  observedAttributes?: string[];
}

const CORE_ATTRS = ['subpath', 'basepath', 'params'] as const;

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function readParams(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
  } catch {
    /* malformed params attribute — treat as none */
  }
  return {};
}

/**
 * Build a `CustomElementConstructor` for `module`. Register it yourself with
 * `customElements.define(tag, Ctor)`, or use `defineCustomElement`.
 */
export function toCustomElement(
  module: JorvelMountModule,
  options: CustomElementOptions = {},
): CustomElementConstructor {
  const extraAttrs = (options.observedAttributes ?? []).map((a) => a.toLowerCase());
  const shadowMode: 'open' | 'closed' | null =
    options.shadow === true ? 'open' : options.shadow === false || options.shadow === undefined ? null : options.shadow;

  class JorvelRemoteElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return [...CORE_ATTRS, ...extraAttrs];
    }

    private dispose: JorvelUnmount | undefined;
    private root: HTMLElement = this;
    private mounted = false;

    connectedCallback(): void {
      if (shadowMode && !this.shadowRoot) {
        const sr = this.attachShadow({ mode: shadowMode });
        const host = document.createElement('div');
        sr.appendChild(host);
        this.root = host;
      }
      this.remount();
    }

    disconnectedCallback(): void {
      this.teardown();
    }

    attributeChangedCallback(): void {
      // Re-mount on any observed attribute change once connected (cheap: remotes
      // are small; navigation already re-mounts). No-op before first connect.
      if (this.mounted) this.remount();
    }

    private buildContext(): JorvelMountContext {
      const props: Record<string, unknown> = {};
      for (const name of extraAttrs) {
        const v = this.getAttribute(name);
        if (v !== null) props[kebabToCamel(name)] = v;
      }
      const ctx: JorvelMountContext = {
        el: this.root,
        subpath: this.getAttribute('subpath') ?? '/',
        basePath: this.getAttribute('basepath') ?? '/',
        params: readParams(this.getAttribute('params')),
        ...(Object.keys(props).length > 0 ? { props } : {}),
      };
      return ctx;
    }

    private remount(): void {
      this.teardown();
      this.dispose = mountRemoteModule(module, this.buildContext());
      this.mounted = true;
    }

    private teardown(): void {
      try {
        this.dispose?.();
      } finally {
        this.dispose = undefined;
        this.mounted = false;
      }
    }
  }

  return JorvelRemoteElement;
}

/**
 * Define + register a custom element for `module` under `tagName`. Idempotent:
 * a second call with an already-registered tag is a no-op.
 */
export function defineCustomElement(
  tagName: string,
  module: JorvelMountModule,
  options?: CustomElementOptions,
): void {
  if (typeof customElements === 'undefined') {
    throw new Error(
      `[jorvel/mount] defineCustomElement("${tagName}"): no customElements registry (not a browser environment).`,
    );
  }
  if (customElements.get(tagName)) return;
  customElements.define(tagName, toCustomElement(module, options));
}
