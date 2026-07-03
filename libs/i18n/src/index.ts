/**
 * @jorvel/i18n — small MVP i18n primitives.
 *
 * Surface:
 *   - `formatMessage(template, values, locale?)` — ICU-lite interpolation with
 *     `{name}`, `{count, plural, one {…} other {…}}` and `{value, number}`.
 *   - `Catalog` — string → template map, by locale.
 *   - `createI18n(opts)` — main entry: `t(key, values)`, locale state,
 *     change-listener, lazy `load(locale)` for code-split catalogs.
 *   - `detectLocale(accept, supported, fallback)` — pure helper for SSR
 *     `Accept-Language` parsing.
 */

export * from './locale-routing.js';
export * from './locale-detection.js';
export * from './rtl.js';

export type CatalogMessages = Record<string, string>;
export type Catalog = Record<string, CatalogMessages>;

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface FormatValues {
  [k: string]: string | number | boolean | Date | undefined | null;
}

/** Strip the leading region tag — `en-US` → `en`. */
function baseLocale(locale: string): string {
  return locale.split(/[-_]/)[0]!.toLowerCase();
}

function pluralCategory(locale: string, n: number): PluralCategory {
  // Avoid pulling Intl.PluralRules in environments that lack it.
  const g = globalThis as { Intl?: { PluralRules?: new (l: string) => { select: (n: number) => PluralCategory } } };
  if (g.Intl?.PluralRules) {
    try {
      return new g.Intl.PluralRules(locale).select(n);
    } catch {
      /* fall through */
    }
  }
  return n === 1 ? 'one' : 'other';
}

const PLURAL_RE = /^([a-zA-Z_][\w]*),\s*plural,\s*([\s\S]+)$/;
const NUMBER_RE = /^([a-zA-Z_][\w]*),\s*number(?:,\s*([a-zA-Z]+))?$/;
// `{gender, select, male{…} female{…} other{…}}` and the generic `select`.
const SELECT_RE = /^([a-zA-Z_][\w]*),\s*(?:select|gender),\s*([\s\S]+)$/;
// `{when, date}` / `{when, date, short|medium|long|full}` and `time`.
const DATE_RE = /^([a-zA-Z_][\w]*),\s*(date|time)(?:,\s*([a-zA-Z]+))?$/;

function parsePluralArms(body: string): Partial<Record<PluralCategory | 'other', string>> {
  const out: Partial<Record<PluralCategory | 'other', string>> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i]!)) i++;
    let key = '';
    while (i < body.length && /[a-zA-Z=0-9]/.test(body[i]!)) {
      key += body[i]!;
      i++;
    }
    while (i < body.length && /\s/.test(body[i]!)) i++;
    if (body[i] !== '{') break;
    i++;
    let depth = 1;
    let val = '';
    while (i < body.length && depth > 0) {
      const ch = body[i]!;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      val += ch;
      i++;
    }
    const normalKey = key.startsWith('=') ? key.slice(1) : key;
    out[normalKey as PluralCategory] = val;
  }
  return out;
}

/**
 * Interpolate `template`. Supports `{name}`, `{n, number}`, and
 * `{count, plural, one {…} other {…}}`.
 */
export function formatMessage(template: string, values: FormatValues = {}, locale = 'en'): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i]!;
    if (ch !== '{') {
      out += ch;
      i++;
      continue;
    }
    // Find the matching close brace, respecting nesting.
    let depth = 1;
    let body = '';
    i++;
    while (i < template.length && depth > 0) {
      const c = template[i]!;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      body += c;
      i++;
    }
    const trimmed = body.trim();
    const plural = PLURAL_RE.exec(trimmed);
    if (plural) {
      const name = plural[1]!;
      const arms = parsePluralArms(plural[2]!);
      const raw = values[name];
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isNaN(n)) {
        if (arms[String(n) as PluralCategory] !== undefined) {
          out += formatMessage(arms[String(n) as PluralCategory]!.replace(/#/g, String(n)), values, locale);
        } else {
          const cat = pluralCategory(locale, n);
          const tpl = arms[cat] ?? arms.other ?? '';
          out += formatMessage(tpl.replace(/#/g, String(n)), values, locale);
        }
      }
      continue;
    }
    const num = NUMBER_RE.exec(trimmed);
    if (num) {
      const name = num[1]!;
      const style = num[2];
      const raw = values[name];
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(n)) continue;
      const g = globalThis as { Intl?: typeof Intl };
      if (style === 'percent' && g.Intl?.NumberFormat) {
        out += new g.Intl.NumberFormat(locale, { style: 'percent' }).format(n);
      } else if (g.Intl?.NumberFormat) {
        out += new g.Intl.NumberFormat(locale).format(n);
      } else {
        out += String(n);
      }
      continue;
    }
    // `{gender, select, ...}` / `{x, select, ...}` — pick the arm by exact match.
    const select = SELECT_RE.exec(trimmed);
    if (select) {
      const name = select[1]!;
      const arms = parsePluralArms(select[2]!);
      const key = String(values[name] ?? '');
      const tpl = arms[key as PluralCategory] ?? arms.other ?? '';
      out += formatMessage(tpl, values, locale);
      continue;
    }
    // `{when, date}` / `{when, time}` with optional style, via Intl.
    const date = DATE_RE.exec(trimmed);
    if (date) {
      const name = date[1]!;
      const kind = date[2]!;
      const style = date[3] as 'short' | 'medium' | 'long' | 'full' | undefined;
      const raw = values[name];
      const d = raw instanceof Date ? raw : new Date(raw as string | number);
      const g = globalThis as { Intl?: typeof Intl };
      if (!Number.isNaN(d.getTime()) && g.Intl?.DateTimeFormat) {
        const opts: Intl.DateTimeFormatOptions =
          kind === 'time' ? { timeStyle: style ?? 'medium' } : { dateStyle: style ?? 'medium' };
        out += new g.Intl.DateTimeFormat(locale, opts).format(d);
      } else {
        out += String(raw ?? '');
      }
      continue;
    }
    // Simple placeholder: `{name}`.
    const value = values[trimmed];
    out += value === undefined || value === null ? `{${trimmed}}` : String(value);
  }
  return out;
}

// ── I18n instance ─────────────────────────────────────────────────────────

export interface CreateI18nOptions {
  /** Initial locale. */
  locale: string;
  /** Catalogs the runtime starts with. */
  catalogs?: Catalog;
  /** Fallback locale used when a key is missing in the active locale. */
  fallbackLocale?: string;
  /** Lazy loader for additional locales. */
  loader?: (locale: string) => Promise<CatalogMessages>;
}

export interface I18n {
  locale: string;
  /** Translate `key`. Missing key returns `key`. */
  t(key: string, values?: FormatValues): string;
  /** Change the active locale. Triggers listeners. */
  setLocale(locale: string): Promise<void>;
  /** Subscribe to locale or catalog changes. */
  subscribe(listener: () => void): () => void;
  /** Load a catalog without switching locales. */
  load(locale: string): Promise<void>;
  /** Inspect / mutate raw catalogs (for tests + SSR hydration). */
  catalogs: Catalog;
}

export function createI18n(opts: CreateI18nOptions): I18n {
  const state = {
    locale: opts.locale,
    catalogs: { ...(opts.catalogs ?? {}) } as Catalog,
  };
  const listeners = new Set<() => void>();
  const fallback = opts.fallbackLocale;

  function notify() {
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        /* swallow */
      }
    }
  }

  // Dedupe concurrent loads of the same locale — without this, two overlapping
  // setLocale('es') calls invoke the loader twice.
  const inflight = new Map<string, Promise<void>>();
  function ensureLoaded(locale: string): Promise<void> {
    if (state.catalogs[locale] || !opts.loader) return Promise.resolve();
    let p = inflight.get(locale);
    if (!p) {
      const loader = opts.loader;
      p = (async () => {
        state.catalogs[locale] = await loader(locale);
      })().finally(() => inflight.delete(locale));
      inflight.set(locale, p);
    }
    return p;
  }

  // Monotonic token so a slower-resolving setLocale can't clobber a later one.
  let setLocaleSeq = 0;

  return {
    get locale() {
      return state.locale;
    },
    set locale(_v: string) {
      throw new Error('[jorvel/i18n] use setLocale(locale) instead of mutating directly.');
    },
    t(key, values) {
      const cur = state.catalogs[state.locale]?.[key];
      const base = state.catalogs[baseLocale(state.locale)]?.[key];
      const fb = fallback ? state.catalogs[fallback]?.[key] : undefined;
      const template = cur ?? base ?? fb ?? key;
      return formatMessage(template, values, state.locale);
    },
    async setLocale(locale) {
      const seq = ++setLocaleSeq;
      await ensureLoaded(locale);
      // A newer setLocale started while we were loading — let it win.
      if (seq !== setLocaleSeq) return;
      state.locale = locale;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async load(locale) {
      await ensureLoaded(locale);
      notify();
    },
    get catalogs() {
      return state.catalogs;
    },
  };
}

// ── Shared singleton ──────────────────────────────────────────────────────
//
// Pinned to globalThis so the host and every remote that calls getI18n()
// observe ONE instance (and one active locale) even when each bundles its own
// copy of @jorvel/i18n — same pattern as getEventBus()/getStore().

const I18N_KEY = '__JORVEL_I18N_SINGLETON__';
type GlobalWithI18n = typeof globalThis & { [I18N_KEY]?: I18n };

/**
 * Get the shared i18n singleton, creating it from `opts` on first call
 * (defaults to `{ locale: 'en' }`). Subsequent calls ignore `opts` and return
 * the existing instance — configure it once in the host before remotes load,
 * or use `setI18n()`.
 */
export function getI18n(opts?: CreateI18nOptions): I18n {
  const g = globalThis as GlobalWithI18n;
  if (!g[I18N_KEY]) g[I18N_KEY] = createI18n(opts ?? { locale: 'en' });
  return g[I18N_KEY];
}

/** Replace the shared singleton (host configures it before remotes consume it). */
export function setI18n(instance: I18n): void {
  (globalThis as GlobalWithI18n)[I18N_KEY] = instance;
}

/** @internal — reset the singleton (tests / single-threaded only). */
export function _resetI18n(): void {
  delete (globalThis as GlobalWithI18n)[I18N_KEY];
}

// ── Locale detection ──────────────────────────────────────────────────────

/**
 * Parse an `Accept-Language` header and return the best supported locale.
 *
 * Falls back to `fallback`. Exact match wins over base-language match.
 */
export function detectLocale(
  acceptLanguage: string | undefined,
  supported: string[],
  fallback: string,
): string {
  if (!acceptLanguage || !supported.length) return fallback;
  const requested = acceptLanguage
    .split(',')
    .map((s) => {
      const [tag, qPart] = s.trim().split(';');
      const q = qPart && /q=([0-9.]+)/.exec(qPart);
      return { tag: tag!.trim().toLowerCase(), q: q ? Number(q[1]) : 1 };
    })
    .filter((r) => r.tag)
    .sort((a, b) => b.q - a.q);

  const supportedLower = supported.map((s) => s.toLowerCase());
  // Exact match first.
  for (const r of requested) {
    const idx = supportedLower.indexOf(r.tag);
    if (idx !== -1) return supported[idx]!;
  }
  // Then base-language match.
  for (const r of requested) {
    const base = r.tag.split('-')[0]!;
    const idx = supportedLower.findIndex((s) => s.split('-')[0] === base);
    if (idx !== -1) return supported[idx]!;
  }
  return fallback;
}
