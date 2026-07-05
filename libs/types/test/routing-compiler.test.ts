import { describe, expect, it } from 'vitest';
import { defaultRoutingCompiler, PAGE_EXTENSIONS, PAGE_EXT_RE } from '../src/routing-compiler.js';

const { routeFromPageFile, sortRoutesForMatching } = defaultRoutingCompiler;

describe('PAGE_EXTENSIONS', () => {
  it('covers the React authoring extensions', () => {
    expect([...PAGE_EXTENSIONS]).toEqual(['tsx', 'ts', 'jsx', 'js', 'mjs', 'cjs']);
  });

  it('PAGE_EXT_RE matches every listed extension (case-insensitive)', () => {
    for (const ext of PAGE_EXTENSIONS) {
      expect(PAGE_EXT_RE.test(`index.${ext}`)).toBe(true);
      expect(PAGE_EXT_RE.test(`index.${ext.toUpperCase()}`)).toBe(true);
    }
    expect(PAGE_EXT_RE.test('index.css')).toBe(false);
  });
});

describe('routeFromPageFile — extension independence', () => {
  it.each(PAGE_EXTENSIONS)('index.%s -> /', (ext) => {
    expect(routeFromPageFile(`index.${ext}`)).toBe('/');
  });

  it.each(PAGE_EXTENSIONS)('users/[id].%s -> /users/:id', (ext) => {
    expect(routeFromPageFile(`users/[id].${ext}`)).toBe('/users/:id');
  });

  it('handles catch-all + group folders regardless of extension', () => {
    expect(routeFromPageFile('docs/[...slug].mjs')).toBe('/docs/*');
    expect(routeFromPageFile('(marketing)/about.cjs')).toBe('/about');
  });
});

describe('sortRoutesForMatching', () => {
  it('orders static > param > catch-all', () => {
    const sorted = sortRoutesForMatching([
      { path: '/*', file: 'a' },
      { path: '/:id', file: 'b' },
      { path: '/settings', file: 'c' },
    ]);
    expect(sorted.map((r) => r.path)).toEqual(['/settings', '/:id', '/*']);
  });
});
