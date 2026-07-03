import { describe, expect, it, vi } from 'vitest';
import { LruHtmlCache } from '../src/html-cache.js';
import { serveWithISR, awaitIsrRevalidation } from '../src/isr.js';

describe('serveWithISR', () => {
  it('renders + caches on a miss', async () => {
    const cache = new LruHtmlCache();
    const render = vi.fn(async () => ({ html: '<p>v1</p>' }));
    const r = await serveWithISR({ cache, key: '/a', render, revalidateMs: 1000, now: () => 0 });
    expect(r.cached).toBe(false);
    expect(r.html).toBe('<p>v1</p>');
    expect(r.etag).toMatch(/^W\//);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('serves fresh cache without re-rendering', async () => {
    const cache = new LruHtmlCache();
    const render = vi.fn(async () => ({ html: 'x' }));
    await serveWithISR({ cache, key: '/b', render, revalidateMs: 1000, now: () => 0 });
    const r = await serveWithISR({ cache, key: '/b', render, revalidateMs: 1000, now: () => 500 });
    expect(r.cached).toBe(true);
    expect(r.stale).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('serves stale + regenerates in the background', async () => {
    const cache = new LruHtmlCache();
    let n = 0;
    const render = vi.fn(async () => ({ html: `v${++n}` }));
    await serveWithISR({ cache, key: '/c', render, revalidateMs: 100, now: () => 0 });
    // now well past revalidateMs → stale
    const r = await serveWithISR({ cache, key: '/c', render, revalidateMs: 100, now: () => 1000 });
    expect(r.stale).toBe(true);
    expect(r.html).toBe('v1'); // stale served immediately
    await awaitIsrRevalidation('/c');
    const fresh = await cache.get('/c');
    expect(fresh?.html).toBe('v2'); // background regenerated
    expect(render).toHaveBeenCalledTimes(2);
  });
});
