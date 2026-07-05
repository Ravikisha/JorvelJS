/**
 * @jorvel/types — File-based routing compiler (phase-0 foundation).
 *
 * The CLI currently implements route scanning directly.
 * This module formalizes the contract so we can:
 * - swap compilers (React Router, TanStack Router, etc.)
 * - add validation (duplicates/conflicts)
 * - support non-React runtimes
 */

/**
 * Source extensions a page file may use. React authoring works in any of these;
 * the bundler's SWC loaders compile all of them. Keep this list the single
 * source of truth — the CLI mirrors it (see packages/cli/src/commands/routes.ts)
 * and the generated rspack `resolve.extensions` must be a superset.
 */
export const PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js', 'mjs', 'cjs'] as const;

/** Matches a trailing page extension, e.g. ".tsx" / ".mjs". */
export const PAGE_EXT_RE = new RegExp(`\\.(${PAGE_EXTENSIONS.join('|')})$`, 'i');

export type JorvelPageRoute = {
  /** Route pathname relative to app base, e.g. "/" or "/reports/:id" */
  path: string;
  /** Source file path, relative to app root */
  file: string;
};

export type JorvelRoutesManifest = {
  app: string;
  basePath: string;
  routes: JorvelPageRoute[];
};

export type JorvelHostRoutesManifest = {
  host: string;
  routes: Array<{ path: string; remote: string; module: string }>;
};

export type JorvelRoutingCompiler = {
  /**
   * Convert a page file (relative to `src/pages/`) into a route path.
   *
   * Example:
   *  - index.tsx -> /
   *  - users/[id].tsx -> /users/:id
   *  - docs/[...slug].tsx -> /docs/*
   */
  routeFromPageFile(relFromPages: string): string;

  /** Sort routes by matching priority (most specific first). */
  sortRoutesForMatching(routes: JorvelPageRoute[]): JorvelPageRoute[];
};

export const defaultRoutingCompiler: JorvelRoutingCompiler = {
  routeFromPageFile(relFromPages: string) {
    if (!relFromPages) {
      throw new Error(
        '[jorvel/types] routeFromPageFile: empty input. Pass a path relative to src/pages/.',
      );
    }
    let withoutExt = relFromPages.replace(PAGE_EXT_RE, '');
    withoutExt = withoutExt.replace(/\\/g, '/');

    const segs = withoutExt.split('/').filter(Boolean);
    const out: string[] = [];

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s) continue;
      // Drop "(group)" folders like Next.js — they affect filesystem layout
      // but not the route path.
      if (s.startsWith('(') && s.endsWith(')')) continue;
      if (s === 'index' && i === segs.length - 1) continue;

      const mCatchAll = s.match(/^\[\.\.\.(.+)\]$/);
      if (mCatchAll) {
        out.push('*');
        continue;
      }

      const mParam = s.match(/^\[(.+)\]$/);
      if (mParam) {
        out.push(':' + mParam[1]);
        continue;
      }

      out.push(s);
    }

    return '/' + out.join('/');
  },

  sortRoutesForMatching(routes) {
    const score = (p: string) => {
      const segs = p.split('/').filter(Boolean);
      let s = 0;
      for (const seg of segs) {
        if (seg === '*') s += 0;
        else if (seg.startsWith(':')) s += 1;
        else s += 2;
      }
      return s * 100 + segs.length;
    };

    const sorted = [...routes].sort((a, b) => score(b.path) - score(a.path));
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
    if (g.process?.env?.['NODE_ENV'] !== 'production') {
      const seen = new Set<string>();
      for (const r of sorted) {
        if (seen.has(r.path)) {
          // eslint-disable-next-line no-console
          console.warn(`[jorvel/types] sortRoutesForMatching: duplicate route path "${r.path}" — first match wins.`);
        }
        seen.add(r.path);
      }
    }
    return sorted;
  },
};
