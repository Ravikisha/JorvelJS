// Run in a Node environment (no document/window) to exercise the SSR paths.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { usePathname, getRouter } from '../src/routing.js';
import { setServerPath, _resetServerRouter } from '../src/server-router.js';
import { matchPath } from '../src/route-matcher.js';

function Show() {
  const p = usePathname();
  return React.createElement('span', null, p);
}

describe('usePathname / getRouter under SSR (no window)', () => {
  it('getRouter returns a server router instead of throwing', () => {
    _resetServerRouter();
    setServerPath('/dashboard');
    // Must not throw (createRouter asserts window; the SSR path must avoid it).
    expect(() => getRouter().getPath()).not.toThrow();
    expect(getRouter().getPath()).toBe('/dashboard');
  });

  it('usePathname renders the server path without throwing during renderToString', () => {
    setServerPath('/dashboard/settings');
    const html = renderToString(React.createElement(Show));
    expect(html).toContain('/dashboard/settings');
  });
});

describe('matchPath safeDecode (malformed escapes must not throw)', () => {
  it('returns the raw segment for a malformed %-escape instead of throwing', () => {
    const m = matchPath('/reports/:id', '/reports/%');
    expect(m).not.toBeNull();
    // A lone "%" can't be decoded — the raw value is kept, no URIError.
    expect(m!.params['id']).toBe('%');
  });

  it('still decodes well-formed escapes', () => {
    const m = matchPath('/users/:name', '/users/ada%20lovelace');
    expect(m!.params['name']).toBe('ada lovelace');
  });
});
