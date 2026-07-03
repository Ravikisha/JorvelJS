import React from 'react';
import ReactDOM from 'react-dom/client';

export interface ShadowRemoteProps {
  /** Component to render inside the shadow root. */
  children: React.ReactNode;
  /** Shadow root mode. Default: 'open'. */
  mode?: 'open' | 'closed';
  /** Extra CSS injected into the shadow root — useful for design-system resets. */
  css?: string;
  /** Link tags for external stylesheets to load inside the shadow. */
  stylesheets?: string[];
  /** Forward ref to the mount div. */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Mount a remote (or any React subtree) inside a Shadow DOM root. Styles do not
 * leak into or out of the host — useful when remotes ship conflicting CSS.
 */
export function ShadowRemote({ children, mode = 'open', css, stylesheets, className, style }: ShadowRemoteProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<ReactDOM.Root | null>(null);
  const mountRef = React.useRef<HTMLDivElement | null>(null);

  // Shadow root + mount + React root. Keyed on `mode` (the only thing that
  // forces a re-attach).
  React.useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode });

    if (!mountRef.current) {
      const mount = document.createElement('div');
      mount.className = 'jorvel-shadow-root';
      shadow.appendChild(mount);
      mountRef.current = mount;
    }

    rootRef.current = ReactDOM.createRoot(mountRef.current);
    return () => {
      const root = rootRef.current;
      rootRef.current = null;
      // Defer unmount out of the render/commit phase to avoid React's
      // "synchronously unmount during render" warning.
      queueMicrotask(() => root?.unmount());
    };
  }, [mode]);

  // Inject css/stylesheets in a SEPARATE effect that tracks and removes the
  // nodes it added — so prop updates apply, and re-runs (e.g. StrictMode's
  // double-invoke in dev) don't pile up duplicate <style>/<link> tags.
  React.useEffect(() => {
    const shadow = hostRef.current?.shadowRoot;
    if (!shadow) return;
    const injected: ChildNode[] = [];

    if (css) {
      const style = document.createElement('style');
      style.setAttribute('data-jorvel-shadow-css', '');
      style.textContent = css;
      shadow.appendChild(style);
      injected.push(style);
    }
    if (stylesheets?.length) {
      for (const href of stylesheets) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        shadow.appendChild(link);
        injected.push(link);
      }
    }

    return () => {
      for (const node of injected) node.remove();
    };
  }, [css, stylesheets]);

  React.useEffect(() => {
    rootRef.current?.render(<>{children}</>);
  }, [children]);

  return <div ref={hostRef} className={className} style={style} />;
}

/** Emit an `@scope` or prefixed-selector block around arbitrary CSS. */
export function scopeCss(css: string, scopePrefix: string): string {
  return css
    .split('}')
    .map((rule) => {
      const trimmed = rule.trim();
      if (!trimmed) return '';
      const openBrace = trimmed.indexOf('{');
      if (openBrace === -1) return rule;
      const selector = trimmed.slice(0, openBrace).trim();
      const body = trimmed.slice(openBrace + 1);
      if (!selector || selector.startsWith('@')) return rule + '}';
      const scoped = selector
        .split(',')
        .map((s) => `${scopePrefix} ${s.trim()}`)
        .join(', ');
      return `${scoped} {${body}}`;
    })
    .filter(Boolean)
    .join('\n');
}
