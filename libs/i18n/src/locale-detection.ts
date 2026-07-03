/**
 * @jorvel/i18n — locale detection + middleware factory.
 *
 * Pure header/cookie negotiation plus a `localeMiddleware()` factory that
 * returns a function compatible with JORVEL's `middleware.ts` shape WITHOUT
 * importing `@jorvel/runtime` (i18n stays dependency-free). The decision type
 * below is a structural mirror of `@jorvel/runtime`'s `MiddlewareDecision`
 * (`next` / `redirect` subset) — it is assignment-compatible by shape.
 */

import { localizePath, extractLocale, type LocaleRoutingOptions } from './locale-routing.js';

// ── Header / cookie negotiation ──────────────────────────────────────────────

export interface DetectLocaleOptions {
  /** Raw `Accept-Language` header value (e.g. `fr-CH, fr;q=0.9, en;q=0.5`). */
  header?: string | null | undefined;
  /** Locale already chosen by the user, typically read from a cookie. */
  cookie?: string | null | undefined;
  /** Locales the app actually ships catalogs for. */
  supported: readonly string[];
  /** Locale to use when nothing matches. */
  default: string;
}

interface RankedTag {
  tag: string;
  q: number;
}

/** Parse `Accept-Language` into tags sorted by descending quality. */
function parseAcceptLanguage(header: string): RankedTag[] {
  return header
    .split(',')
    .map((part): RankedTag | null => {
      const [rawTag, ...params] = part.trim().split(';');
      const tag = rawTag?.trim().toLowerCase();
      if (!tag) return null;
      let q = 1;
      for (const p of params) {
        const m = /^\s*q\s*=\s*([0-9](?:\.[0-9]+)?)\s*$/.exec(p);
        if (m) q = Number(m[1]);
      }
      return { tag, q };
    })
    .filter((r): r is RankedTag => r !== null && !Number.isNaN(r.q) && r.q > 0)
    // Stable sort by quality, descending. (Array.prototype.sort is stable in
    // every supported runtime, so equal-q tags keep header order.)
    .sort((a, b) => b.q - a.q);
}

/** Best supported locale for one requested tag — exact wins over base match. */
function bestMatch(tag: string, supportedLower: string[], supported: readonly string[]): string | undefined {
  const exact = supportedLower.indexOf(tag);
  if (exact !== -1) return supported[exact];
  const base = tag.split('-')[0];
  const baseIdx = supportedLower.findIndex((s) => s.split('-')[0] === base);
  return baseIdx !== -1 ? supported[baseIdx] : undefined;
}

/**
 * Negotiate a locale from a cookie override + `Accept-Language` header.
 *
 * Precedence: a *supported* cookie value wins outright; otherwise the
 * highest-quality `Accept-Language` tag that maps to a supported locale
 * (exact match preferred, then base language); otherwise `default`.
 */
export function negotiateLocale(opts: DetectLocaleOptions): string {
  const { supported, default: fallback } = opts;
  if (supported.length === 0) return fallback;

  const supportedLower = supported.map((s) => s.toLowerCase());

  // 1. Cookie override (only when it names a supported locale).
  if (opts.cookie) {
    const match = bestMatch(opts.cookie.trim().toLowerCase(), supportedLower, supported);
    if (match !== undefined) return match;
  }

  // 2. Accept-Language negotiation.
  if (opts.header) {
    for (const { tag } of parseAcceptLanguage(opts.header)) {
      const match = bestMatch(tag, supportedLower, supported);
      if (match !== undefined) return match;
    }
  }

  return fallback;
}

// ── Middleware factory ───────────────────────────────────────────────────────

/**
 * Structural mirror of `@jorvel/runtime`'s `MiddlewareDecision` (the subset this
 * factory emits). Deliberately NOT imported from the runtime so `@jorvel/i18n`
 * carries no dependency — the shapes are assignment-compatible.
 */
export type LocaleMiddlewareDecision =
  | { type: 'next'; headers?: Record<string, string> }
  | { type: 'redirect'; to: string; status: 301 | 302 | 303 | 307 | 308 };

/** Minimal context shape consumed by the middleware (a subset of the runtime's). */
export interface LocaleMiddlewareContext {
  pathname: string;
  searchParams?: URLSearchParams;
  request?: { headers?: { get(name: string): string | null } } | undefined;
}

export interface LocaleMiddlewareOptions extends LocaleRoutingOptions {
  /** Locales the app ships. */
  supported: readonly string[];
  /** Locale used when negotiation finds nothing. */
  default: string;
  /** Cookie name to read a locale override from. Default: `'locale'`. */
  cookieName?: string;
  /** Redirect status used when prefixing an un-prefixed path. Default: `307`. */
  redirectStatus?: 301 | 302 | 303 | 307 | 308;
  /**
   * Explicit header reader, for runtimes where `ctx.request` is absent. Receives
   * the header name (lowercased) and returns its value or `null`.
   */
  getHeader?: (name: string) => string | null | undefined;
}

/** Read a cookie value out of a raw `Cookie` header string. */
function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const k = pair.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return undefined;
}

/**
 * Build a middleware that ensures every request lands on a locale-prefixed
 * path. When the incoming pathname already carries a known locale it passes
 * (`next`); otherwise it negotiates a locale (cookie → `Accept-Language` →
 * default) and `redirect`s to the localized path, preserving the query string.
 *
 * With `defaultLocale` set, the default locale is served prefix-free, so an
 * un-prefixed path that resolves to the default locale is left alone.
 *
 * The returned function matches JORVEL's `Middleware` shape structurally; drop
 * it straight into a `runMiddleware([...])` chain.
 */
export function localeMiddleware(
  opts: LocaleMiddlewareOptions,
): (ctx: LocaleMiddlewareContext) => LocaleMiddlewareDecision {
  const cookieName = opts.cookieName ?? 'locale';
  const status = opts.redirectStatus ?? 307;
  const routingOpts: LocaleRoutingOptions =
    opts.defaultLocale != null ? { defaultLocale: opts.defaultLocale } : {};

  return (ctx) => {
    const header = (name: string): string | null | undefined => {
      if (opts.getHeader) return opts.getHeader(name);
      return ctx.request?.headers?.get(name) ?? undefined;
    };

    const { locale: prefixLocale } = extractLocale(ctx.pathname, opts.supported, routingOpts);

    // Already on a known locale prefix → nothing to do.
    if (prefixLocale !== null && opts.supported.some((l) => l.toLowerCase() === prefixLocale.toLowerCase())) {
      return { type: 'next' };
    }

    const cookieValue = readCookie(header('cookie'), cookieName);
    const detected = negotiateLocale({
      supported: opts.supported,
      default: opts.default,
      ...(header('accept-language') != null ? { header: header('accept-language') } : {}),
      ...(cookieValue != null ? { cookie: cookieValue } : {}),
    });

    const target = localizePath(ctx.pathname, detected, {
      ...routingOpts,
      locales: opts.supported,
    });

    // If localizePath produced no change (e.g. default-locale-without-prefix and
    // detected === default), continue rather than redirect to the same URL.
    if (target === ctx.pathname) {
      return { type: 'next' };
    }

    const search = ctx.searchParams?.toString();
    const to = search ? `${target}?${search}` : target;
    return { type: 'redirect', to, status };
  };
}
