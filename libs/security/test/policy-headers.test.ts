import { describe, expect, it } from 'vitest';
import { permissionsPolicy, referrerPolicy, policyHeaders } from '../src/index.js';

describe('policy headers', () => {
  it('permissionsPolicy denies sensitive features by default', () => {
    const v = permissionsPolicy();
    expect(v).toMatch(/camera=\(\)/);
    expect(v).toMatch(/microphone=\(\)/);
    expect(v).toMatch(/geolocation=\(\)/);
  });

  it('permissionsPolicy honors overrides', () => {
    const v = permissionsPolicy({ camera: ['self'] });
    expect(v).toMatch(/camera=\(self\)|camera=\(["']?self["']?\)/);
    expect(v).not.toMatch(/camera=\(\)/);
  });

  it('referrerPolicy defaults to strict-origin-when-cross-origin', () => {
    expect(referrerPolicy()).toBe('strict-origin-when-cross-origin');
    expect(referrerPolicy('no-referrer')).toBe('no-referrer');
  });

  it('policyHeaders returns both header names', () => {
    const h = policyHeaders();
    expect(h['Permissions-Policy']).toBeTruthy();
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
