import { describe, expect, it } from 'vitest';
import { securityHeaders } from '../src/headers.js';

describe('securityHeaders', () => {
  it('emits a secure-by-default set', () => {
    const h = securityHeaders();
    expect(h['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    // MFE-friendly defaults: CORP cross-origin, COEP off.
    expect(h['cross-origin-resource-policy']).toBe('cross-origin');
    expect(h['cross-origin-embedder-policy']).toBeUndefined();
  });

  it('HSTS options + preload', () => {
    const h = securityHeaders({ hsts: { maxAge: 100, includeSubDomains: false, preload: true } });
    expect(h['strict-transport-security']).toBe('max-age=100; preload');
  });

  it('omits headers set to false', () => {
    const h = securityHeaders({
      hsts: false,
      noSniff: false,
      frameOptions: false,
      referrerPolicy: false,
      permissionsPolicy: false,
      coop: false,
      corp: false,
    });
    expect(Object.keys(h)).toHaveLength(0);
  });

  it('builds Permissions-Policy from a feature map', () => {
    const h = securityHeaders({ permissionsPolicy: { geolocation: ['self'], camera: [] } });
    expect(h['permissions-policy']).toBe('geolocation=(self), camera=()');
  });

  it('opts into COEP when requested', () => {
    expect(securityHeaders({ coep: 'require-corp' })['cross-origin-embedder-policy']).toBe('require-corp');
  });

  it('accepts a raw Permissions-Policy string', () => {
    expect(securityHeaders({ permissionsPolicy: 'fullscreen=*' })['permissions-policy']).toBe('fullscreen=*');
  });
});
