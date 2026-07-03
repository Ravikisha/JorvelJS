import { describe, expect, it } from 'vitest';
import { issueCsrfToken, verifyCsrf, csrfFieldName } from '../src/index.js';

function reqWith(method: string, headers: Record<string, string>) {
  return {
    method,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  };
}

describe('CSRF double-submit', () => {
  it('issues a non-HttpOnly cookie + matching token', async () => {
    const { token, setCookie } = await issueCsrfToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(setCookie).toContain('jorvel_csrf=');
    expect(setCookie).not.toContain('HttpOnly'); // page must read it
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('passes safe methods without a token', async () => {
    const res = await verifyCsrf(reqWith('GET', {}));
    expect(res.ok).toBe(true);
  });

  it('accepts a matching cookie + header on POST', async () => {
    const { token } = await issueCsrfToken();
    const res = await verifyCsrf(
      reqWith('POST', { cookie: `jorvel_csrf=${token}`, 'x-csrf-token': token }),
    );
    expect(res.ok).toBe(true);
  });

  it('accepts a token submitted via form field', async () => {
    const { token } = await issueCsrfToken();
    const res = await verifyCsrf(reqWith('POST', { cookie: `jorvel_csrf=${token}` }), {}, token);
    expect(res.ok).toBe(true);
  });

  it('rejects when the cookie is missing', async () => {
    const res = await verifyCsrf(reqWith('POST', { 'x-csrf-token': 'abc' }));
    expect(res).toEqual({ ok: false, reason: 'missing-cookie' });
  });

  it('rejects when the echoed token is missing', async () => {
    const { token } = await issueCsrfToken();
    const res = await verifyCsrf(reqWith('POST', { cookie: `jorvel_csrf=${token}` }));
    expect(res).toEqual({ ok: false, reason: 'missing-token' });
  });

  it('rejects a mismatched token', async () => {
    const { token } = await issueCsrfToken();
    const res = await verifyCsrf(
      reqWith('POST', { cookie: `jorvel_csrf=${token}`, 'x-csrf-token': 'different' }),
    );
    expect(res).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('signed mode rejects a forged cookie-only pair', async () => {
    const secret = 'csrf-secret-xxxxxxxxxxxxxxxxxxxxxxxx';
    // Attacker sets BOTH cookie and header to the same unsigned value.
    const forged = 'attackervalue';
    const res = await verifyCsrf(
      reqWith('POST', { cookie: `jorvel_csrf=${forged}`, 'x-csrf-token': forged }),
      { secret },
    );
    expect(res).toEqual({ ok: false, reason: 'bad-signature' });

    // A legitimately issued signed token passes.
    const { token } = await issueCsrfToken({ secret });
    const good = await verifyCsrf(
      reqWith('POST', { cookie: `jorvel_csrf=${token}`, 'x-csrf-token': token }),
      { secret },
    );
    expect(good.ok).toBe(true);
  });

  it('csrfFieldName reflects options', () => {
    expect(csrfFieldName()).toBe('_csrf');
    expect(csrfFieldName({ fieldName: 'csrf_token' })).toBe('csrf_token');
  });
});
