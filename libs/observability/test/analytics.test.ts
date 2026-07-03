import { describe, expect, it, vi } from 'vitest';
import { posthogAdapter, plausibleAdapter, vercelAnalyticsAdapter } from '../src/index.js';

function fakeFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchLike = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    return new Response('{}', { status: 200 });
  });
  return { fetchLike, calls };
}

describe('analytics adapters', () => {
  it('posthog posts a capture event', async () => {
    const { fetchLike, calls } = fakeFetch();
    const a = posthogAdapter({ apiKey: 'phc_x', fetch: fetchLike as unknown as typeof fetch });
    await a.track({ name: 'signup', properties: { plan: 'pro' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(/capture/);
  });

  it('plausible posts a pageview', async () => {
    const { fetchLike, calls } = fakeFetch();
    const a = plausibleAdapter({ domain: 'x.test', fetch: fetchLike as unknown as typeof fetch });
    await a.pageview('https://x.test/dashboard');
    expect(calls).toHaveLength(1);
  });

  it('vercel adapter exposes track + pageview', async () => {
    const { fetchLike } = fakeFetch();
    const a = vercelAnalyticsAdapter({ fetch: fetchLike as unknown as typeof fetch });
    expect(typeof a.track).toBe('function');
    expect(typeof a.pageview).toBe('function');
    await a.track({ name: 'evt' });
  });
});
