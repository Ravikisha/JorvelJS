import { afterEach, describe, expect, it, vi } from 'vitest';
import { createI18n, detectLocale, formatMessage, getI18n, setI18n, _resetI18n } from '../src/index.js';

describe('formatMessage — simple placeholders', () => {
  it('substitutes {name}', () => {
    expect(formatMessage('Hello, {name}!', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('leaves missing placeholders intact', () => {
    expect(formatMessage('Hello, {name}!', {})).toBe('Hello, {name}!');
  });

  it('coerces numeric + boolean values', () => {
    expect(formatMessage('n={n}', { n: 0 })).toBe('n=0');
    expect(formatMessage('on={on}', { on: true })).toBe('on=true');
  });

  it('handles literals with no placeholders', () => {
    expect(formatMessage('plain text', {})).toBe('plain text');
  });
});

describe('formatMessage — plural', () => {
  it('selects "one" vs "other" via Intl', () => {
    const tpl = '{count, plural, one {# item} other {# items}}';
    expect(formatMessage(tpl, { count: 1 }, 'en')).toBe('1 item');
    expect(formatMessage(tpl, { count: 5 }, 'en')).toBe('5 items');
  });

  it('exact match `=0` wins over plural category', () => {
    const tpl = '{count, plural, =0 {No items} one {# item} other {# items}}';
    expect(formatMessage(tpl, { count: 0 }, 'en')).toBe('No items');
    expect(formatMessage(tpl, { count: 1 }, 'en')).toBe('1 item');
  });

  it('supports nested {name} inside arms', () => {
    const tpl = '{count, plural, one {# message for {who}} other {# messages for {who}}}';
    expect(formatMessage(tpl, { count: 3, who: 'Ada' }, 'en')).toBe('3 messages for Ada');
  });
});

describe('formatMessage — number', () => {
  it('renders {n, number} with Intl.NumberFormat', () => {
    expect(formatMessage('{n, number}', { n: 1234567 }, 'en-US')).toMatch(/1,234,567/);
  });

  it('renders {n, number, percent}', () => {
    expect(formatMessage('{n, number, percent}', { n: 0.42 }, 'en-US')).toContain('42');
  });
});

describe('createI18n', () => {
  it('t() returns the matched message + interpolation', () => {
    const i = createI18n({
      locale: 'en',
      catalogs: { en: { greet: 'Hi, {name}' } },
    });
    expect(i.t('greet', { name: 'Ada' })).toBe('Hi, Ada');
  });

  it('falls back to the base locale, then fallbackLocale, then key', () => {
    const i = createI18n({
      locale: 'fr-CA',
      fallbackLocale: 'en',
      catalogs: {
        en: { only_en: 'EN' },
        fr: { only_base: 'FR' },
      },
    });
    expect(i.t('only_base')).toBe('FR');
    expect(i.t('only_en')).toBe('EN');
    expect(i.t('missing')).toBe('missing');
  });

  it('setLocale() loads + notifies subscribers', async () => {
    const loader = vi.fn(async () => ({ greet: 'Hola, {name}' }));
    const i = createI18n({ locale: 'en', catalogs: { en: { greet: 'Hi, {name}' } }, loader });
    const sub = vi.fn();
    i.subscribe(sub);
    await i.setLocale('es');
    expect(loader).toHaveBeenCalledWith('es');
    expect(sub).toHaveBeenCalled();
    expect(i.t('greet', { name: 'Ada' })).toBe('Hola, Ada');
  });

  it('the latest setLocale wins even if an earlier one resolves later', async () => {
    // 'fr' loader is slower than 'de' — 'de' was requested last, so it must win.
    const loader = vi.fn(async (loc: string) => {
      await new Promise((r) => setTimeout(r, loc === 'fr' ? 30 : 5));
      return { greet: loc };
    });
    const i = createI18n({ locale: 'en', loader });
    const p1 = i.setLocale('fr');
    const p2 = i.setLocale('de');
    await Promise.all([p1, p2]);
    expect(i.locale).toBe('de');
  });

  it('dedupes concurrent loads of the same locale', async () => {
    const loader = vi.fn(async () => ({ greet: 'x' }));
    const i = createI18n({ locale: 'en', loader });
    await Promise.all([i.setLocale('es'), i.setLocale('es')]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('load() warms a catalog without changing locale', async () => {
    const loader = vi.fn(async () => ({ greet: 'Hej' }));
    const i = createI18n({ locale: 'en', loader });
    await i.load('sv');
    expect(i.locale).toBe('en');
    expect(i.catalogs.sv).toEqual({ greet: 'Hej' });
  });

  it('subscriber throws are isolated', async () => {
    const i = createI18n({ locale: 'en' });
    i.subscribe(() => {
      throw new Error('bad sub');
    });
    const ok = vi.fn();
    i.subscribe(ok);
    await i.setLocale('en');
    expect(ok).toHaveBeenCalled();
  });

  it('direct locale assignment throws (immutable getter)', () => {
    const i = createI18n({ locale: 'en' });
    expect(() => {
      (i as unknown as { locale: string }).locale = 'fr';
    }).toThrow(/setLocale/);
  });
});

describe('detectLocale', () => {
  it('returns fallback when header missing', () => {
    expect(detectLocale(undefined, ['en', 'fr'], 'en')).toBe('en');
  });

  it('exact match wins', () => {
    expect(detectLocale('fr-CA, en;q=0.5', ['en', 'fr-CA'], 'en')).toBe('fr-CA');
  });

  it('base-language match when no exact', () => {
    expect(detectLocale('fr-CA', ['en', 'fr'], 'en')).toBe('fr');
  });

  it('respects q-value preferences', () => {
    expect(detectLocale('de;q=0.3, fr;q=0.9, en;q=0.5', ['en', 'fr', 'de'], 'en')).toBe('fr');
  });

  it('falls back when nothing matches', () => {
    expect(detectLocale('zh', ['en', 'fr'], 'en')).toBe('en');
  });
});

describe('getI18n singleton', () => {
  afterEach(() => _resetI18n());

  it('returns the same instance across calls', () => {
    const a = getI18n({ locale: 'en', catalogs: { en: { hi: 'Hi' } } });
    const b = getI18n({ locale: 'fr' }); // opts ignored after first
    expect(a).toBe(b);
    expect(b.locale).toBe('en');
    expect(b.t('hi')).toBe('Hi');
  });

  it('setI18n replaces the singleton', () => {
    getI18n({ locale: 'en' });
    const custom = createI18n({ locale: 'de', catalogs: { de: { hi: 'Hallo' } } });
    setI18n(custom);
    expect(getI18n()).toBe(custom);
    expect(getI18n().t('hi')).toBe('Hallo');
  });
});
