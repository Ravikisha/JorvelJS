/**
 * @jorvel/types — `redirects` / `rewrites` config block + pure matcher.
 *
 * Lets a `jorvel.config` declare URL-level redirects (the browser/edge changes
 * the visible URL) and rewrites (the URL stays, a different path is served).
 * This module is pure logic — NO React, NO runtime deps — so it can run in the
 * CLI, edge adapters, the Node server, and the client router alike.
 *
 * Pattern syntax mirrors the route matcher (`route-matcher.ts`):
 *   - static segments:  /old/blog
 *   - named params:     /blog/:slug            (captured, substitutable in dest)
 *   - splat:            /docs/*                (captures the rest as `*`)
 *
 * Destinations substitute captured params with `:name` and the splat with `*`:
 *   { source: '/blog/:slug', destination: '/posts/:slug' }
 *   { source: '/docs/*',     destination: '/help/*' }
 */

export interface RedirectRule {
  /** Match pattern, e.g. `/old/:id` or `/legacy/*`. */
  source: string;
  /** Target, e.g. `/new/:id`. Supports `:param` and `*` substitution. */
  destination: string;
  /**
   * When true the redirect is permanent (308). When false/omitted it is
   * temporary (307). Consumers map this to whatever status they emit.
   */
  permanent?: boolean;
}

export interface RewriteRule {
  /** Match pattern, e.g. `/api/:path*` style `/api/*`. */
  source: string;
  /** Internal target served without changing the URL. Supports substitution. */
  destination: string;
}

/** Resolved redirect: where to send the user and whether it is permanent. */
export interface RedirectResult {
  destination: string;
  permanent: boolean;
}

/**
 * Captured values from a `source` match. Named params keyed by name; a splat is
 * keyed by `*`. Mirrors the route matcher's `params` bag.
 */
type Params = Record<string, string>;

function normalize(path: string): string {
  if (!path) return '/';
  // Match on pathname only; drop query/hash so callers can pass full-ish URLs.
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  if (cut !== -1) path = path.slice(0, cut);
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/**
 * Match a `source` pattern against a pathname. Returns captured params on a
 * match, or `null`. Kept local (rather than importing the runtime matcher) so
 * this stays a dependency-free types package.
 */
function matchSource(source: string, pathname: string): Params | null {
  const p = normalize(source);
  const u = normalize(pathname);

  const pSegs = p.split('/').filter(Boolean);
  const uSegs = u.split('/').filter(Boolean);

  const params: Params = {};

  if (p === '/' || p === '') {
    return u === '/' || u === '' ? params : null;
  }

  for (let i = 0; i < pSegs.length; i++) {
    const ps = pSegs[i];
    const us = uSegs[i];

    if (ps === undefined) return null;

    if (ps === '*') {
      params['*'] = uSegs.slice(i).join('/');
      return params;
    }

    if (us === undefined) return null;

    if (ps.startsWith(':')) {
      params[ps.slice(1)] = safeDecode(us);
      continue;
    }

    if (ps !== us) return null;
  }

  // Extra user segments with no trailing splat → not a match.
  if (uSegs.length > pSegs.length) return null;

  return params;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Substitute `:param` and `*` tokens in a destination with captured values.
 * Tokens with no matching capture are left verbatim.
 */
function substitute(destination: string, params: Params): string {
  const [pathPart, ...rest] = destination.split(/([?#])/);
  const suffix = rest.join('');

  const segs = (pathPart ?? '').split('/').map((seg) => {
    if (seg.startsWith(':')) {
      const name = seg.slice(1);
      const value = params[name];
      return value === undefined ? seg : value;
    }
    if (seg === '*') {
      const splat = params['*'];
      return splat === undefined ? '' : splat;
    }
    return seg;
  });

  // Drop empty segments introduced by an empty splat, but preserve the leading
  // slash (the first split element is '' for an absolute path).
  const joined = segs.filter((s, i) => s !== '' || i === 0).join('/');
  const result = joined === '' ? '/' : joined;
  return result + suffix;
}

/**
 * Find the first matching redirect for `pathname` and resolve its destination
 * (with param/splat substitution). Returns `null` when nothing matches.
 */
export function matchRedirect(
  rules: readonly RedirectRule[],
  pathname: string,
): RedirectResult | null {
  for (const rule of rules) {
    const params = matchSource(rule.source, pathname);
    if (params === null) continue;
    return {
      destination: substitute(rule.destination, params),
      permanent: rule.permanent === true,
    };
  }
  return null;
}

/**
 * Find the first matching rewrite for `pathname` and resolve its destination
 * (with param/splat substitution). Returns `null` when nothing matches.
 */
export function matchRewrite(
  rules: readonly RewriteRule[],
  pathname: string,
): string | null {
  for (const rule of rules) {
    const params = matchSource(rule.source, pathname);
    if (params === null) continue;
    return substitute(rule.destination, params);
  }
  return null;
}
