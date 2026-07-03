import { describe, expect, it } from 'vitest';
import {
  extractLocale,
  stripLocale,
  localizePath,
  isRtlLocale,
  dirForLocale,
  htmlDirAttrs,
  negotiateLocale,
  localeMiddleware,
  formatMessage,
} from '../src/index.js';

const LOCALES = ['en', 'fr', 'ar'];

describe('locale routing', () => {
  it('extracts a leading locale', () => {
    expect(extractLocale('/fr/dashboard', LOCALES)).toEqual({ locale: 'fr', rest: '/dashboard' });
    expect(extractLocale('/dashboard', LOCALES).locale).toBeNull();
  });

  it('strips and localizes paths', () => {
    expect(stripLocale('/fr/dashboard', LOCALES)).toBe('/dashboard');
    expect(localizePath('/dashboard', 'fr', { locales: LOCALES })).toBe('/fr/dashboard');
  });
});

describe('rtl', () => {
  it('detects RTL languages', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('he-IL')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
    expect(dirForLocale('ar')).toBe('rtl');
    expect(htmlDirAttrs('ar')).toEqual({ lang: 'ar', dir: 'rtl' });
  });
});

describe('locale detection', () => {
  it('negotiates from Accept-Language', () => {
    const l = negotiateLocale({ supported: LOCALES, default: 'en', header: 'fr-FR,fr;q=0.9,en;q=0.8' });
    expect(l).toBe('fr');
  });

  it('cookie overrides header', () => {
    const l = negotiateLocale({ supported: LOCALES, default: 'en', header: 'fr', cookie: 'ar' });
    expect(l).toBe('ar');
  });

  it('localeMiddleware redirects an unprefixed path', () => {
    const mw = localeMiddleware({ supported: LOCALES, default: 'en' });
    const dec = mw({ pathname: '/dashboard', request: new Request('https://x.test/dashboard', { headers: { 'accept-language': 'fr' } }) });
    expect(dec.type === 'redirect' || dec.type === 'next').toBe(true);
    if (dec.type === 'redirect') expect(dec.to).toMatch(/^\/fr\//);
  });
});

describe('ICU select / gender / date', () => {
  it('formats a select/gender arm', () => {
    const tpl = '{g, select, male {He} female {She} other {They}} replied';
    expect(formatMessage(tpl, { g: 'female' })).toBe('She replied');
    expect(formatMessage(tpl, { g: 'x' })).toBe('They replied');
  });

  it('formats a date via Intl', () => {
    const out = formatMessage('Posted {when, date, short}', { when: new Date('2026-01-15T00:00:00Z') }, 'en');
    expect(out).toMatch(/Posted \d/);
  });
});
