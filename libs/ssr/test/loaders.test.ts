import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  _clearLoaderSlot,
  defineLoader,
  requireLoaderData,
  runLoaders,
  setLoaderData,
  useLoaderData,
} from '../src/loaders.js';
import {
  runWithRequestContext,
  buildRequestContext,
  setRequestContextStore,
  type RequestContext,
} from '../src/request-context.js';
import type { EdgeRequest } from '../src/types.js';

const req: EdgeRequest = { url: 'https://x/users/42?tab=billing', method: 'GET', headers: {} };

afterEach(() => _clearLoaderSlot());

describe('defineLoader', () => {
  it('preserves the loader return type via TypeScript inference', async () => {
    const userLoader = defineLoader({
      key: 'user',
      load: () => ({ id: 'u1', name: 'Ada' }),
    });
    const r = await runLoaders({ loaders: [userLoader], request: req });
    expect(r.data.user).toEqual({ id: 'u1', name: 'Ada' });
  });
});

describe('runLoaders', () => {
  it('runs loaders concurrently and aggregates data', async () => {
    const a = defineLoader({ key: 'a', load: async () => 1 });
    const b = defineLoader({ key: 'b', load: async () => 'two' });
    const r = await runLoaders({ loaders: [a, b], request: req });
    expect(r.data).toEqual({ a: 1, b: 'two' });
  });

  it('exposes URL, params, and setHeader to the loader', async () => {
    const seen: { url?: string; params?: Record<string, string>; setHeader?: boolean } = {};
    const l = defineLoader({
      key: 'k',
      load: (c) => {
        seen.url = c.url.toString();
        seen.params = c.params;
        seen.setHeader = typeof c.setHeader === 'function';
        c.setHeader('Set-Cookie', 'sid=abc');
        return {};
      },
    });
    const r = await runLoaders({ loaders: [l], request: req, params: { id: '42' } });
    expect(seen.url).toBe('https://x/users/42?tab=billing');
    expect(seen.params).toEqual({ id: '42' });
    expect(seen.setHeader).toBe(true);
    expect(r.headers['set-cookie']).toBe('sid=abc');
  });

  it('propagates getRequestContext when the loader runs inside runWithRequestContext', async () => {
    const ctx = buildRequestContext({ url: req.url, headers: { cookie: 'sid=xyz' } });
    const l = defineLoader({
      key: 'session',
      load: (c) => c.ctx?.cookies['sid'] ?? null,
    });
    const r = await runWithRequestContext(ctx, () => runLoaders({ loaders: [l], request: req }));
    expect(r.data.session).toBe('xyz');
  });

  it('cacheControl bubbles to the result (most-conservative wins on first)', async () => {
    const a = defineLoader({ key: 'a', load: () => 1, cacheControl: 'public, max-age=60' });
    const b = defineLoader({ key: 'b', load: () => 2, cacheControl: 'public, max-age=600' });
    const r = await runLoaders({ loaders: [a, b], request: req });
    expect(r.cacheControl).toBe('public, max-age=60');
  });

  it('rejects when any loader throws (control-flow errors must propagate)', async () => {
    const a = defineLoader({ key: 'a', load: () => 1 });
    const bad = defineLoader({
      key: 'b',
      load: () => {
        throw new Error('boom');
      },
    });
    await expect(runLoaders({ loaders: [a, bad], request: req })).rejects.toThrow('boom');
  });

  it('writes results into the slot so useLoaderData can read them', async () => {
    const a = defineLoader({ key: 'pageData', load: () => ({ ok: true }) });
    await runLoaders({ loaders: [a], request: req });
    expect(useLoaderData<{ ok: boolean }>('pageData')).toEqual({ ok: true });
  });

  // Concurrency isolation requires a store that survives `await` — the default
  // sync slot intentionally does not (that's why Node concurrent deployments opt
  // into AsyncLocalStorage). With ALS installed, two interleaved requests must
  // never see each other's loader data.
  describe('per-request isolation under AsyncLocalStorage (concurrent renders)', () => {
    const als = new AsyncLocalStorage<RequestContext>();
    beforeAll(() => {
      setRequestContextStore({
        get: () => als.getStore(),
        set: () => {},
        run: (ctx, fn) => als.run(ctx, fn),
      });
    });
    afterAll(() => {
      // Restore a sync-slot store equivalent to the module default.
      let current: RequestContext | undefined;
      setRequestContextStore({
        get: () => current,
        set: (c) => {
          current = c;
        },
        run: (ctx, fn) => {
          const prev = current;
          current = ctx;
          try {
            return fn();
          } finally {
            current = prev;
          }
        },
      });
    });

    it('isolates loader data per request context (no cross-request bleed)', async () => {
      const loader = defineLoader({
        key: 'user',
        // Simulate async work so the two requests genuinely interleave.
        load: async (c) => {
          await new Promise((r) => setTimeout(r, c.ctx?.cookies['sid'] === 'alice' ? 5 : 1));
          return c.ctx?.cookies['sid'] ?? null;
        },
      });

      const ctxA = buildRequestContext({ url: req.url, headers: { cookie: 'sid=alice' } });
      const ctxB = buildRequestContext({ url: req.url, headers: { cookie: 'sid=bob' } });

      const [readA, readB] = await Promise.all([
        runWithRequestContext(ctxA, async () => {
          await runLoaders({ loaders: [loader], request: req });
          return useLoaderData<string>('user');
        }),
        runWithRequestContext(ctxB, async () => {
          await runLoaders({ loaders: [loader], request: req });
          return useLoaderData<string>('user');
        }),
      ]);

      expect(readA).toBe('alice');
      expect(readB).toBe('bob');
      // Slots live on the contexts, not a shared global.
      expect((ctxA.locals['__JORVEL_LOADER_SLOT__'] as { data: Record<string, unknown> }).data.user).toBe('alice');
      expect((ctxB.locals['__JORVEL_LOADER_SLOT__'] as { data: Record<string, unknown> }).data.user).toBe('bob');
    });
  });
});

describe('useLoaderData / requireLoaderData', () => {
  it('useLoaderData returns undefined when slot is unset', () => {
    expect(useLoaderData('absent')).toBeUndefined();
  });

  it('requireLoaderData throws when key missing', () => {
    expect(() => requireLoaderData('absent')).toThrow(/No loader data for key/);
  });

  it('setLoaderData seeds the slot (e.g. from a hydration payload)', () => {
    setLoaderData({ a: 1, b: 'two' });
    expect(useLoaderData('a')).toBe(1);
    expect(requireLoaderData<string>('b')).toBe('two');
  });
});
