/**
 * @jorvel/i18n — right-to-left (RTL) locale helpers.
 *
 * Determines text direction from a BCP-47 locale tag and produces the HTML
 * attributes you set on `<html>` (or a layout root) for correct bidi rendering.
 * Detection is by base-language subtag, so `ar`, `ar-EG`, `AR_eg` all resolve
 * to RTL.
 */

/**
 * Base-language subtags written right-to-left. Covers the commonly-shipped set:
 * Arabic, Hebrew, Persian/Farsi, Urdu, Pashto, Sindhi, Uyghur, Yiddish, Dhivehi,
 * Kurdish (Sorani), Syriac, Samaritan, N'Ko, plus Aramaic variants.
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar', // Arabic
  'he', // Hebrew
  'iw', // Hebrew (legacy code)
  'fa', // Persian / Farsi
  'ur', // Urdu
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'yi', // Yiddish
  'ji', // Yiddish (legacy code)
  'dv', // Dhivehi / Maldivian
  'ckb', // Central Kurdish (Sorani)
  'ku', // Kurdish (commonly RTL in Sorani-script contexts)
  'syr', // Syriac
  'sam', // Samaritan Aramaic
  'arc', // Imperial Aramaic
  'nqo', // N'Ko
  'rhg', // Rohingya (Hanifi)
  'prs', // Dari
]);

export type Direction = 'ltr' | 'rtl';

/** Lowercase base-language subtag of a BCP-47 tag (`ar-EG` → `ar`). */
function baseLanguage(locale: string): string {
  return locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
}

/** True when `locale`'s base language is written right-to-left. */
export function isRtlLocale(locale: string): boolean {
  if (!locale) return false;
  return RTL_LANGUAGES.has(baseLanguage(locale));
}

/** Text direction for `locale`: `'rtl'` for RTL languages, else `'ltr'`. */
export function dirForLocale(locale: string): Direction {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * HTML root attributes for `locale` — spread onto `<html {...htmlDirAttrs(loc)}>`
 * (or a React `<html lang dir>` element). `lang` is the locale verbatim; `dir`
 * is the computed direction.
 */
export function htmlDirAttrs(locale: string): { lang: string; dir: Direction } {
  return { lang: locale, dir: dirForLocale(locale) };
}
