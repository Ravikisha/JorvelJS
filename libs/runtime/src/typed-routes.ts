import { matchPath } from './route-matcher.js';

/** Minimal validator contract — Zod / Valibot / Yup / custom all conform. */
export interface Validator<T> {
  parse: (input: unknown) => T;
  safeParse?: (input: unknown) => { success: true; data: T } | { success: false; error: unknown };
}

export interface TypedRouteConfig<P = unknown, S = unknown> {
  path: string;
  params?: Validator<P>;
  search?: Validator<S>;
}

export interface TypedRoute<P = unknown, S = unknown> {
  path: string;
  match: (pathname: string) => { raw: Record<string, string>; params: P } | null;
  parseSearch: (qs: string | URLSearchParams) => S;
  build: (params: P extends void ? undefined : P, search?: S) => string;
}

export function createRoute<P = Record<string, string>, S = Record<string, string>>(
  config: TypedRouteConfig<P, S>,
): TypedRoute<P, S> {
  return {
    path: config.path,

    match(pathname: string) {
      const m = matchPath(config.path, pathname);
      if (!m) return null;
      const params = (config.params ? config.params.parse(m.params) : (m.params as unknown)) as P;
      return { raw: m.params, params };
    },

    parseSearch(qs) {
      const params = qs instanceof URLSearchParams ? qs : new URLSearchParams(qs);
      const obj = Object.fromEntries(params);
      return (config.search ? config.search.parse(obj) : (obj as unknown)) as S;
    },

    build(params, search) {
      const segments = config.path.split('/').filter(Boolean);
      const p = (params ?? {}) as Record<string, unknown>;
      const resolved = segments.map((seg) => {
        if (seg.startsWith(':')) {
          const name = seg.slice(1);
          const value = p[name];
          if (value == null) throw new Error(`createRoute.build: missing param "${name}" for ${config.path}`);
          return encodeURIComponent(String(value));
        }
        if (seg === '*') {
          const rest = p['*'];
          if (rest == null || rest === '') return '';
          // A splat captures a multi-segment path — encode each segment but keep
          // the separators, otherwise `/` becomes %2F and the URL breaks.
          return String(rest)
            .split('/')
            .map((s) => encodeURIComponent(s))
            .join('/');
        }
        return seg;
      }).filter(Boolean);

      let url = '/' + resolved.join('/');
      if (search) {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(search as Record<string, unknown>)) {
          if (v == null) continue;
          sp.set(k, String(v));
        }
        const qs = sp.toString();
        if (qs) url += '?' + qs;
      }
      return url;
    },
  };
}

/** Combine route definitions into a registry for type-safe nav helpers. */
export function defineRoutes<T extends Record<string, TypedRoute<any, any>>>(routes: T): T {
  return routes;
}
