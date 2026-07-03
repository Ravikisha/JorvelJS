import { describe, expect, it, vi } from 'vitest';
import { uploadSourcemaps } from '../src/index.js';

describe('uploadSourcemaps', () => {
  it('uploads only .map files via injected fs + fetch', async () => {
    const fetchLike = vi.fn(async () => new Response('{}', { status: 201 }));
    const res = await uploadSourcemaps({
      distDir: 'dist',
      org: 'acme',
      release: 'v1',
      authToken: 'tok',
      fetch: fetchLike as unknown as typeof fetch,
      fs: {
        readDir: () => ['app.js', 'app.js.map', 'vendor.js.map', 'index.html'],
        readFile: () => '{"version":3}',
      },
    });
    // 2 .map files → 2 uploads
    expect(fetchLike).toHaveBeenCalledTimes(2);
    expect(res.uploaded).toHaveLength(2);
    const [url, init] = fetchLike.mock.calls[0]!;
    expect(String(url)).toMatch(/acme\/releases\/v1\/files/);
    expect((init as RequestInit).headers).toBeTruthy();
  });

  it('reports zero when no maps present', async () => {
    const fetchLike = vi.fn(async () => new Response('{}'));
    const res = await uploadSourcemaps({
      distDir: 'dist',
      org: 'a',
      release: 'r',
      authToken: 't',
      fetch: fetchLike as unknown as typeof fetch,
      fs: { readDir: () => ['app.js'], readFile: () => '' },
    });
    expect(res.uploaded).toHaveLength(0);
    expect(fetchLike).not.toHaveBeenCalled();
  });
});
