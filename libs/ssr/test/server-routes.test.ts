import { describe, expect, it } from 'vitest';
import { createApiRouter, defineRoute, json } from '../src/server-routes.js';

describe('server routes', () => {
  const router = createApiRouter([
    defineRoute('GET', '/health', () => json({ ok: true })),
    defineRoute('GET', '/users/:id', ({ params }) => json({ id: params.id })),
    defineRoute('POST', '/users', () => json({ created: true }, { status: 201 })),
  ], { prefix: '/api' });

  it('matches method + path and extracts params', async () => {
    const res = await router.handle(new Request('https://x.test/api/users/42'));
    expect(res).not.toBeNull();
    expect(await res!.json()).toEqual({ id: '42' });
  });

  it('honors the method', async () => {
    const res = await router.handle(new Request('https://x.test/api/users', { method: 'POST' }));
    expect(res!.status).toBe(201);
  });

  it('returns null on no match (fall through to SSR)', async () => {
    expect(await router.handle(new Request('https://x.test/dashboard'))).toBeNull();
    expect(await router.handle(new Request('https://x.test/api/nope'))).toBeNull();
  });

  it('mounts a fallback (tRPC/Hono) handler under the prefix', async () => {
    const r = createApiRouter([], { prefix: '/trpc', fallback: () => new Response('trpc', { status: 200 }) });
    const res = await r.handle(new Request('https://x.test/trpc/anything'));
    expect(await res!.text()).toBe('trpc');
    expect(await r.handle(new Request('https://x.test/other'))).toBeNull();
  });
});
