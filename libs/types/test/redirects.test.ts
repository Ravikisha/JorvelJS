import { describe, expect, it } from 'vitest';
import {
  matchRedirect,
  matchRewrite,
  type RedirectRule,
  type RewriteRule,
} from '../src/redirects.js';

describe('matchRedirect', () => {
  it('returns null when nothing matches', () => {
    const rules: RedirectRule[] = [{ source: '/old', destination: '/new' }];
    expect(matchRedirect(rules, '/nope')).toBeNull();
  });

  it('resolves a static redirect (temporary by default)', () => {
    const rules: RedirectRule[] = [{ source: '/old', destination: '/new' }];
    expect(matchRedirect(rules, '/old')).toEqual({ destination: '/new', permanent: false });
  });

  it('honors permanent: true', () => {
    const rules: RedirectRule[] = [{ source: '/a', destination: '/b', permanent: true }];
    expect(matchRedirect(rules, '/a')).toEqual({ destination: '/b', permanent: true });
  });

  it('substitutes named params into the destination', () => {
    const rules: RedirectRule[] = [{ source: '/blog/:slug', destination: '/posts/:slug' }];
    expect(matchRedirect(rules, '/blog/hello-world')).toEqual({
      destination: '/posts/hello-world',
      permanent: false,
    });
  });

  it('substitutes multiple params', () => {
    const rules: RedirectRule[] = [
      { source: '/u/:user/p/:post', destination: '/users/:user/posts/:post' },
    ];
    expect(matchRedirect(rules, '/u/42/p/7')?.destination).toBe('/users/42/posts/7');
  });

  it('substitutes a splat', () => {
    const rules: RedirectRule[] = [{ source: '/docs/*', destination: '/help/*' }];
    expect(matchRedirect(rules, '/docs/getting/started')?.destination).toBe('/help/getting/started');
  });

  it('uses the first matching rule', () => {
    const rules: RedirectRule[] = [
      { source: '/x', destination: '/first' },
      { source: '/x', destination: '/second' },
    ];
    expect(matchRedirect(rules, '/x')?.destination).toBe('/first');
  });

  it('ignores query strings when matching', () => {
    const rules: RedirectRule[] = [{ source: '/old', destination: '/new' }];
    expect(matchRedirect(rules, '/old?ref=x')?.destination).toBe('/new');
  });

  it('preserves a query string present on the destination', () => {
    const rules: RedirectRule[] = [{ source: '/go', destination: '/dest?utm=1' }];
    expect(matchRedirect(rules, '/go')?.destination).toBe('/dest?utm=1');
  });

  it('leaves an unmatched destination token verbatim', () => {
    const rules: RedirectRule[] = [{ source: '/x', destination: '/y/:missing' }];
    expect(matchRedirect(rules, '/x')?.destination).toBe('/y/:missing');
  });
});

describe('matchRewrite', () => {
  it('returns null when nothing matches', () => {
    const rules: RewriteRule[] = [{ source: '/api/*', destination: '/internal/*' }];
    expect(matchRewrite(rules, '/web')).toBeNull();
  });

  it('rewrites a splat path', () => {
    const rules: RewriteRule[] = [{ source: '/api/*', destination: '/internal/*' }];
    expect(matchRewrite(rules, '/api/users/1')).toBe('/internal/users/1');
  });

  it('rewrites with a named param', () => {
    const rules: RewriteRule[] = [{ source: '/p/:id', destination: '/product?id=:id' }];
    // :id inside the query is not a path segment, so it stays literal — only
    // path segments are substituted. Document that boundary here.
    expect(matchRewrite(rules, '/p/9')).toBe('/product?id=:id');
  });

  it('handles an empty splat capture gracefully', () => {
    const rules: RewriteRule[] = [{ source: '/api/*', destination: '/internal/*' }];
    expect(matchRewrite(rules, '/api')).toBe('/internal');
  });
});
