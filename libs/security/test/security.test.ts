import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  generateNonce,
  RemoteAllowlist,
  escapeHtml,
  safeJsonForScript,
  isSafePathname,
  pruneProtoKeys,
  safeObjectAssign,
  sriHash,
} from '../src/index.js';

describe('csp', () => {
  it('emits a baseline policy', () => {
    const csp = buildCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('rejects invalid nonce characters', () => {
    expect(() => buildCsp({}, { nonce: 'abc"; xss' })).toThrow();
  });

  it('adds nonce + strict-dynamic when nonce is set', () => {
    const csp = buildCsp({}, { nonce: 'abc123' });
    expect(csp).toContain("'nonce-abc123'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it('strict-styles drops unsafe-inline from baseline style-src', () => {
    const csp = buildCsp({}, { strictStyles: true });
    expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
  });

  it('generates a base64-style nonce of expected length', () => {
    const n = generateNonce(16);
    expect(typeof n).toBe('string');
    expect(n.length).toBeGreaterThanOrEqual(20); // 16 bytes → ~24 base64 chars
  });
});

describe('allowlist', () => {
  it('allows exact origin', () => {
    const al = new RemoteAllowlist({ origins: ['https://cdn.example.com'] });
    expect(al.isAllowed('https://cdn.example.com/remoteEntry.js')).toBe(true);
    expect(al.isAllowed('https://evil.com/remoteEntry.js')).toBe(false);
  });

  it('matches single-label * wildcard', () => {
    const al = new RemoteAllowlist({ origins: ['https://*.example.com'] });
    expect(al.isAllowed('https://api.example.com/remote.js')).toBe(true);
    expect(al.isAllowed('https://a.b.example.com/remote.js')).toBe(false);
  });

  it('matches multi-label ** wildcard', () => {
    const al = new RemoteAllowlist({ origins: ['https://**.example.com'] });
    expect(al.isAllowed('https://a.b.example.com/remote.js')).toBe(true);
  });

  it('rejects javascript: scheme even when origin allowlist is permissive', () => {
    const al = new RemoteAllowlist({ origins: ['https://anything.example.com'] });
    expect(al.isAllowed('javascript:alert(1)')).toBe(false);
  });

  it('is case-insensitive for the origin entry', () => {
    const al = new RemoteAllowlist({ origins: ['https://Example.COM'] });
    expect(al.isAllowed('https://example.com/x.js')).toBe(true);
  });
});

describe('sanitize', () => {
  it('escapes HTML special chars', () => {
    expect(escapeHtml('<b>"&\'</b>')).toBe('&lt;b&gt;&quot;&amp;&#39;&lt;/b&gt;');
  });

  it('safely encodes JSON for inline scripts', () => {
    const out = safeJsonForScript({ html: '</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
  });

  it('rejects path traversal', () => {
    expect(isSafePathname('/foo/bar')).toBe(true);
    expect(isSafePathname('/foo/../etc')).toBe(false);
  });

  it('rejects percent-encoded traversal (%2e%2e and double-encoded)', () => {
    expect(isSafePathname('/foo/%2e%2e/etc')).toBe(false);
    expect(isSafePathname('/foo/%2E%2E/etc')).toBe(false);
    expect(isSafePathname('/foo/%252e%252e/etc')).toBe(false);
    expect(isSafePathname('/foo/%2e%2e%2fetc')).toBe(false);
  });

  it('strips proto-pollution keys', () => {
    const cleaned = pruneProtoKeys({ a: 1, __proto__: { evil: true } } as Record<string, unknown>);
    expect(cleaned).toHaveProperty('a', 1);
    expect(cleaned).not.toHaveProperty('__proto__');
  });

  it('safeObjectAssign refuses prototype keys', () => {
    const target: Record<string, unknown> = {};
    safeObjectAssign(target, { __proto__: { polluted: true }, ok: 1 } as Record<string, unknown>);
    expect(target['ok']).toBe(1);
    expect((Object.prototype as unknown as { polluted?: boolean }).polluted).not.toBe(true);
  });
});

describe('sri', () => {
  it('produces a sha384- prefixed hash for known input', async () => {
    const hash = await sriHash('hello world', 'sha384');
    expect(hash.startsWith('sha384-')).toBe(true);
  });
});
