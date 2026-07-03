import { describe, expect, it } from 'vitest';
import { buildPreloadTags, remoteEntryPreloads } from '../src/preload.js';

describe('buildPreloadTags', () => {
  it('default rel for as=script is modulepreload', () => {
    const out = buildPreloadTags([{ href: '/a.js', as: 'script' }]);
    expect(out).toBe('<link rel="modulepreload" href="/a.js">');
  });

  it('drops `as` attr when rel=modulepreload', () => {
    const out = buildPreloadTags([{ href: '/a.js', as: 'script', rel: 'modulepreload' }]);
    expect(out).not.toContain('as="script"');
  });

  it('keeps `as` attr for rel=preload', () => {
    const out = buildPreloadTags([{ href: '/f.woff2', as: 'font', rel: 'preload' }]);
    expect(out).toContain('as="font"');
    expect(out).toContain('rel="preload"');
  });

  it('emits crossorigin, integrity, type', () => {
    const out = buildPreloadTags([
      {
        href: '/x.js',
        as: 'script',
        crossorigin: 'anonymous',
        integrity: 'sha384-abc',
        type: 'module',
      },
    ]);
    expect(out).toContain('crossorigin="anonymous"');
    expect(out).toContain('integrity="sha384-abc"');
    expect(out).toContain('type="module"');
  });

  it('escapes href to prevent attribute injection', () => {
    const out = buildPreloadTags([{ href: '/x"><script>alert(1)</script>', as: 'script' }]);
    expect(out).not.toContain('<script>alert');
    expect(out).toContain('&quot;');
  });

  it('joins multiple links with newline', () => {
    const out = buildPreloadTags([
      { href: '/a.js', as: 'script' },
      { href: '/b.css', as: 'style' },
    ]);
    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('remoteEntryPreloads', () => {
  it('default is preload as=script (classic-script container)', () => {
    const out = remoteEntryPreloads([{ name: 'a', entryUrl: 'http://x/r.js' }]);
    expect(out[0]).toMatchObject({
      href: 'http://x/r.js',
      rel: 'preload',
      as: 'script',
      crossorigin: 'anonymous',
    });
  });

  it('produces modulepreload links when format: "esm"', () => {
    const out = remoteEntryPreloads(
      [{ name: 'a', entryUrl: 'http://x/r.js' }],
      { format: 'esm' },
    );
    expect(out[0]).toMatchObject({
      href: 'http://x/r.js',
      rel: 'modulepreload',
      crossorigin: 'anonymous',
    });
    // modulepreload doesn't take an `as` attribute.
    expect(out[0].as).toBeUndefined();
  });

  it('passes through integrity when provided', () => {
    const out = remoteEntryPreloads([
      { name: 'a', entryUrl: 'http://x/r.js', integrity: 'sha384-zz' },
    ]);
    expect(out[0].integrity).toBe('sha384-zz');
  });

  it('omits integrity when absent', () => {
    const out = remoteEntryPreloads([{ name: 'a', entryUrl: 'http://x/r.js' }]);
    expect(out[0].integrity).toBeUndefined();
  });
});
