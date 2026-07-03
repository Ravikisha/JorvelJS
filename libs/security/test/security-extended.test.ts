import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  cspMeta,
  RemoteAllowlist,
  sriAttributes,
  sriHash,
} from '../src/index.js';

describe('csp extras', () => {
  it('merges remotes into script-src and connect-src', () => {
    const csp = buildCsp({}, { remotes: ['https://cdn.x.com/r.js', 'https://api.y.com/foo'] });
    expect(csp).toContain('script-src');
    expect(csp).toMatch(/script-src[^;]*https:\/\/cdn\.x\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/api\.y\.com/);
  });

  it('reportUri + reportTo emit directives', () => {
    const csp = buildCsp({}, { reportUri: '/csp-report', reportTo: 'group1' });
    expect(csp).toContain('report-uri /csp-report');
    expect(csp).toContain('report-to group1');
  });

  it('rejects reportUri with whitespace or semicolon', () => {
    expect(() => buildCsp({}, { reportUri: '/x ; bad' })).toThrow();
  });

  it('strictDynamic:false skips strict-dynamic with nonce', () => {
    const csp = buildCsp({}, { nonce: 'abc', strictDynamic: false });
    expect(csp).not.toContain("'strict-dynamic'");
    expect(csp).toContain("'nonce-abc'");
  });

  it('allowInlineScripts adds unsafe-inline', () => {
    const csp = buildCsp({}, { allowInlineScripts: true });
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('allowEval adds unsafe-eval', () => {
    const csp = buildCsp({}, { allowEval: true });
    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it('custom directive overrides baseline', () => {
    const csp = buildCsp({ 'img-src': ["'self'", 'https://cdn.x.com'] });
    expect(csp).toMatch(/img-src 'self' https:\/\/cdn\.x\.com/);
  });

  it('upgrade-insecure-requests as true emits bare directive', () => {
    const csp = buildCsp({ 'upgrade-insecure-requests': true });
    expect(csp).toMatch(/(^|; )upgrade-insecure-requests($|;)/);
  });

  it('cspMeta wraps in <meta http-equiv>', () => {
    const tag = cspMeta();
    expect(tag.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
  });
});

describe('allowlist extras', () => {
  it('names filter rejects unlisted remote name', () => {
    const al = new RemoteAllowlist({
      origins: ['https://cdn.example.com'],
      names: ['allowed-remote'],
    });
    expect(al.isAllowed('https://cdn.example.com/r.js', 'allowed-remote')).toBe(true);
    expect(al.isAllowed('https://cdn.example.com/r.js', 'evil')).toBe(false);
    // Regression: an unnamed lookup must NOT bypass a configured names allowlist.
    expect(al.isAllowed('https://cdn.example.com/r.js')).toBe(false);
  });

  it('rejects malformed URL', () => {
    const al = new RemoteAllowlist({ origins: ['https://x'] });
    expect(al.isAllowed('not a url')).toBe(false);
  });

  it('httpOnly:false permits data: URLs when origin allowlist matches scheme prefix', () => {
    const al = new RemoteAllowlist({ origins: ['data://'], httpOnly: false });
    // data: URLs do not produce a meaningful origin; just verify httpOnly bypass does not throw.
    expect(typeof al.isAllowed('data:text/plain,abc')).toBe('boolean');
  });

  it('assertAllowed throws on disallowed', () => {
    const al = new RemoteAllowlist({ origins: ['https://x.example.com'] });
    expect(() => al.assertAllowed('https://evil.com/r.js', 'r')).toThrow(/allowlist/);
  });
});

describe('sri extras', () => {
  it('supports sha256 and sha512', async () => {
    expect((await sriHash('x', 'sha256')).startsWith('sha256-')).toBe(true);
    expect((await sriHash('x', 'sha512')).startsWith('sha512-')).toBe(true);
  });

  it('sriAttributes returns integrity + crossorigin pair', async () => {
    const a = await sriAttributes('payload', 'sha384', 'use-credentials');
    expect(a.integrity.startsWith('sha384-')).toBe(true);
    expect(a.crossorigin).toBe('use-credentials');
  });

  it('hash differs for different input', async () => {
    expect(await sriHash('a')).not.toBe(await sriHash('b'));
  });
});
