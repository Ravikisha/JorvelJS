import { describe, expect, it } from 'vitest';
import { parseSearchParams, buildSearchString, createSearchSchema } from '../src/search-params.js';

// A hand-written standard-schema-style validator (no zod dependency).
const schema = {
  parse(input: unknown) {
    const o = input as Record<string, string>;
    return { tab: o.tab ?? 'home', page: Number(o.page ?? '1') };
  },
};

describe('typed search params', () => {
  it('parses a query string through a validator', () => {
    expect(parseSearchParams('tab=settings&page=3', schema)).toEqual({ tab: 'settings', page: 3 });
    expect(parseSearchParams(new URLSearchParams('page=2'), schema)).toEqual({ tab: 'home', page: 2 });
  });

  it('builds a query string (drops null/undefined, expands arrays)', () => {
    expect(buildSearchString({ a: 1, b: 'x' })).toContain('a=1');
    expect(buildSearchString({ a: null, b: undefined, c: 'k' })).toBe('c=k');
    expect(buildSearchString({ t: ['a', 'b'] })).toBe('t=a&t=b');
  });

  it('createSearchSchema wraps parse + serialize', () => {
    const s = createSearchSchema(schema);
    expect(s.parse('tab=x')).toEqual({ tab: 'x', page: 1 });
  });
});
