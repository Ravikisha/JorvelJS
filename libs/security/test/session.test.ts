import { describe, expect, it } from 'vitest';
import {
  SessionManager,
  SessionRequiredError,
  getSession,
  requireUser,
} from '../src/index.js';

const SECRET = 'test-secret-please-rotate-0123456789';

interface User { id: string; role: string }

describe('SessionManager', () => {
  it('round-trips a signed session', async () => {
    const mgr = new SessionManager<User>({ secret: SECRET });
    const token = await mgr.sign({ id: '7', role: 'admin' });
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const data = await mgr.verify(token);
    expect(data).toEqual({ id: '7', role: 'admin' });
  });

  it('rejects a tampered payload', async () => {
    const mgr = new SessionManager<User>({ secret: SECRET });
    const token = await mgr.sign({ id: '7', role: 'user' });
    const [payload, sig] = token.split('.');
    // Flip the role inside the payload but keep the old signature.
    const forged = Buffer.from(JSON.stringify({ iat: 0, exp: 9e9, data: { id: '7', role: 'admin' } }))
      .toString('base64url');
    expect(await mgr.verify(`${forged}.${sig}`)).toBeNull();
    expect(await mgr.verify(`${payload}.deadbeef`)).toBeNull();
  });

  it('rejects an expired session', async () => {
    let t = 1_000_000;
    const mgr = new SessionManager<User>({ secret: SECRET, maxAge: 10, now: () => t });
    const token = await mgr.sign({ id: '1', role: 'user' });
    expect(await mgr.verify(token)).not.toBeNull();
    t += 11_000; // 11s later, maxAge was 10s
    expect(await mgr.verify(token)).toBeNull();
  });

  it('accepts a rotated secret on verify', async () => {
    const old = new SessionManager<User>({ secret: 'old-secret-aaaaaaaaaaaaaaaaaaaaaaaa' });
    const token = await old.sign({ id: '5', role: 'user' });
    const rotated = new SessionManager<User>({
      secret: 'new-secret-bbbbbbbbbbbbbbbbbbbbbbbb',
      verifySecrets: ['old-secret-aaaaaaaaaaaaaaaaaaaaaaaa'],
    });
    expect(await rotated.verify(token)).toEqual({ id: '5', role: 'user' });
  });

  it('seal() produces an HttpOnly Secure SameSite=Lax cookie', async () => {
    const mgr = new SessionManager<User>({ secret: SECRET, maxAge: 3600 });
    const setCookie = await mgr.seal({ id: '9', role: 'user' });
    expect(setCookie).toContain('jorvel_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Max-Age=3600');
  });

  it('destroy() clears the cookie with Max-Age=0', () => {
    const mgr = new SessionManager<User>({ secret: SECRET });
    expect(mgr.destroy()).toContain('Max-Age=0');
  });

  it('reads from a Cookie header and a Request', async () => {
    const mgr = new SessionManager<User>({ secret: SECRET });
    const token = await mgr.sign({ id: '3', role: 'user' });
    const header = `other=x; jorvel_session=${token}`;
    expect(await mgr.read(header)).toEqual({ id: '3', role: 'user' });
    const req = new Request('https://x.test', { headers: { cookie: header } });
    expect(await mgr.read(req)).toEqual({ id: '3', role: 'user' });
  });

  it('requireUser throws SessionRequiredError (401) when absent', async () => {
    const mgr = new SessionManager<User>({ secret: SECRET });
    await expect(mgr.requireUser('')).rejects.toBeInstanceOf(SessionRequiredError);
    try {
      await mgr.requireUser('');
    } catch (e) {
      expect((e as SessionRequiredError).status).toBe(401);
    }
  });

  it('rejects construction without a secret', () => {
    expect(() => new SessionManager({ secret: '' })).toThrow(/secret/);
  });
});

describe('functional shorthands', () => {
  it('getSession / requireUser work without holding a manager', async () => {
    const mgr = new SessionManager<User>({ secret: SECRET });
    const token = await mgr.sign({ id: '2', role: 'user' });
    const header = `jorvel_session=${token}`;
    expect(await getSession<User>(header, { secret: SECRET })).toEqual({ id: '2', role: 'user' });
    expect(await requireUser<User>(header, { secret: SECRET })).toEqual({ id: '2', role: 'user' });
    await expect(requireUser('', { secret: SECRET })).rejects.toBeInstanceOf(SessionRequiredError);
  });
});
