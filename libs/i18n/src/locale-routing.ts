/**
 * @jorvel/i18n — routing-aware locale helpers.
 *
 * Pure, dependency-free path manipulation for prefix-based locale routing
 * (`/fr/dashboard`, `/en-US/blog/post`). Designed for both the client router
 * and SSR/edge: no DOM, no Node, no `@jorvel/runtime` import.
 *
 *   - `localizePath(path, locale, opts)`  →  add/replace the locale prefix.
 *   - `extractLocale(pathname, locales, opts)`  →  `{ locale, rest }`.
 *   - `stripLocale(pathname, locales, opts)`  →  pathname without the prefix.
 *   - `buildLocaleHref(href, locale, locales, opts)`  →  re-localize a full href,
 *      preserving query + hash.
 */

export interface LocaleRoutingOptions {
  /**
   * Locale that is served *without* a path prefix. With `'en'` set, `/about`
   * resolves to `en` and `localizePath('/about', 'en')` stays `/about`, while
   * `localizePath('/about', 'fr')` → `/fr/about`.
   *
   * Omit (or `null`) to always require a prefix.
   */
  defaultLocale?: string | null;
}

/** Normalize a locale to lowercase for case-insensitive segment comparison. */
function lc(s: string): string {
  return s.toLowerCase();
}

/**
 * Split a pathname into a leading `/`, its segments, and a trailing-slash flag.
 * The query/hash must already be stripped (see {@link buildLocaleHref}).
 */
function splitSegments(pathname: string): { segments: string[]; trailingSlash: boolean } {
  // Preserve a meaningful trailing slash on non-root paths (`/fr/` vs `/fr`).
  const trailingSlash = pathname.length > 1 && pathname.endsWith('/');
  const trimmed = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = trimmed.length ? trimmed.split('/') : [];
  return { segments, trailingSlash };
}

function joinSegments(segments: string[], trailingSlash: boolean): string {
  if (segments.length === 0) return '/';
  return '/' + segments.join('/') + (trailingSlash ? '/' : '');
}

/**
 * If the first segment of `pathname` is one of `locales`, return it (in its
 * canonical/original casing) — otherwise `undefined`.
 */
function leadingLocale(segments: string[], locales: readonly string[]): string | undefined {
  const first = segments[0];
  if (first === undefined) return undefined;
  const firstLc = lc(first);
  return locales.find((l) => lc(l) === firstLc);
}

export interface ExtractLocaleResult {
  /** The matched locale, or `null` when the path carries no known prefix. */
  locale: string | null;
  /** The pathname with the locale prefix removed (always starts with `/`). */
  rest: string;
}

/**
 * Pull the locale prefix off `pathname`.
 *
 * - `/fr/dashboard` with `['en','fr']` → `{ locale: 'fr', rest: '/dashboard' }`
 * - `/dashboard`    with `['en','fr']` → `{ locale: null, rest: '/dashboard' }`
 *   (or `{ locale: defaultLocale, … }` when `defaultLocale` is set)
 */
export function extractLocale(
  pathname: string,
  locales: readonly string[],
  opts: LocaleRoutingOptions = {},
): ExtractLocaleResult {
  const { segments, trailingSlash } = splitSegments(pathname);
  const matched = leadingLocale(segments, locales);
  if (matched !== undefined) {
    const rest = joinSegments(segments.slice(1), trailingSlash);
    return { locale: matched, rest };
  }
  const fallback = opts.defaultLocale ?? null;
  return { locale: fallback, rest: joinSegments(segments, trailingSlash) };
}

/**
 * Remove a known locale prefix from `pathname`, returning the un-prefixed path.
 * No-op when the path has no recognized locale prefix.
 */
export function stripLocale(
  pathname: string,
  locales: readonly string[],
  opts: LocaleRoutingOptions = {},
): string {
  return extractLocale(pathname, locales, opts).rest;
}

/**
 * Return `path` prefixed for `locale`. Any existing *known-locale* prefix is
 * replaced (so this is idempotent and safe to call on already-localized paths,
 * as long as the current prefix is in `locales`).
 *
 * With `defaultLocale` set, the default locale is emitted without a prefix.
 *
 * @param locales Optional set of known locales used to detect (and strip) an
 *   existing prefix. Defaults to `[locale]` plus `defaultLocale`.
 */
export function localizePath(
  path: string,
  locale: string,
  opts: LocaleRoutingOptions & { locales?: readonly string[] } = {},
): string {
  const known =
    opts.locales ??
    (opts.defaultLocale != null ? [locale, opts.defaultLocale] : [locale]);
  // Strip any current known prefix first so we don't stack `/fr/en/…`.
  const { rest } = extractLocale(path, known, opts);
  const { segments, trailingSlash } = splitSegments(rest);

  const isDefault =
    opts.defaultLocale != null && lc(opts.defaultLocale) === lc(locale);
  if (isDefault) {
    return joinSegments(segments, trailingSlash);
  }
  return joinSegments([locale, ...segments], trailingSlash);
}

/**
 * Re-localize a full href — relative (`/blog?tab=1#x`) or absolute
 * (`https://h/blog`) — to `locale`, preserving query string and hash.
 *
 * Only the pathname is rewritten; origin, search, and hash are kept verbatim.
 */
export function buildLocaleHref(
  href: string,
  locale: string,
  locales: readonly string[],
  opts: LocaleRoutingOptions = {},
): string {
  // Detect an absolute URL without throwing on relative inputs.
  let origin = '';
  let pathAndRest = href;

  const schemeMatch = /^([a-zA-Z][\w+.-]*:)?\/\//.exec(href);
  if (schemeMatch) {
    // Absolute (or protocol-relative) URL — peel off scheme + authority.
    const afterScheme = href.slice(schemeMatch[0].length);
    const slashIdx = afterScheme.indexOf('/');
    if (slashIdx === -1) {
      // No path component at all, e.g. `https://host` — nothing to localize.
      return href;
    }
    origin = schemeMatch[0] + afterScheme.slice(0, slashIdx);
    pathAndRest = afterScheme.slice(slashIdx);
  }

  // Separate pathname from `?search` / `#hash`.
  const qIdx = pathAndRest.indexOf('?');
  const hIdx = pathAndRest.indexOf('#');
  let cut = pathAndRest.length;
  if (qIdx !== -1) cut = Math.min(cut, qIdx);
  if (hIdx !== -1) cut = Math.min(cut, hIdx);

  const pathname = pathAndRest.slice(0, cut) || '/';
  const suffix = pathAndRest.slice(cut);

  const localized = localizePath(pathname, locale, { ...opts, locales });
  return origin + localized + suffix;
}
