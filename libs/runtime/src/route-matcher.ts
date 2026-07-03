export type RouteMatch = {
  params: Record<string, string>;
};

/**
 * Very small matcher supporting:
 * - static segments: /dashboard
 * - params: /reports/:id
 * - splat: /dashboard/* (captures the rest into params['*'])
 */
export function matchPath(pattern: string, pathname: string): RouteMatch | null {
  const p = normalize(pattern);
  const u = normalize(pathname);

  const pSegs = p.split('/').filter(Boolean);
  const uSegs = u.split('/').filter(Boolean);

  const params: Record<string, string> = {};

  // Special-case root: it should only match the root path.
  if (p === '/' || p === '') {
    return u === '/' || u === '' ? { params } : null;
  }

  for (let i = 0, j = 0; i < pSegs.length; i++, j++) {
    const ps = pSegs[i];
    const us = uSegs[j];

    // noUncheckedIndexedAccess: both `ps` and `us` can be `undefined` when the
    // index is out of bounds, even though we bound by `pSegs.length` above.
    if (ps === undefined) return null;

    if (ps === '*') {
      params['*'] = uSegs.slice(j).join('/');
      return { params };
    }

    if (!us) return null;

    if (ps.startsWith(':')) {
      params[ps.slice(1)] = safeDecode(us);
      continue;
    }

    if (ps !== us) return null;
  }

  // If user path has extra segments and pattern didn't end with splat, it's not a match.
  if (uSegs.length > pSegs.length) return null;

  return { params };
}

function safeDecode(s: string): string {
  // Malformed escapes (e.g. a lone "%") make decodeURIComponent throw URIError.
  // Fall back to the raw segment so a bad URL renders rather than crashing the
  // matcher — and so client matching stays consistent with the SSR matcher
  // (route-utils.ts), avoiding hydration mismatches on param routes.
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function normalize(path: string) {
  if (!path) return '/';
  // Allow passing full URL-ish paths ("/dashboard?tab=a#top").
  // We only match on pathname.
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  if (cut !== -1) path = path.slice(0, cut);
  if (!path.startsWith('/')) path = '/' + path;
  // remove trailing slash (but keep root)
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}
