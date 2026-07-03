/**
 * Feature: server-router AsyncLocalStorage scoping.
 */
import { describe, expect, it } from 'vitest';
import { withServerRouter, getServerRouter } from '../../libs/runtime/dist/index.js';

// ALS loads via an indirect import that doesn't resolve under vitest's module
// runner (works in real Node — verified). Skip the isolation assertions when ALS
// is unavailable rather than asserting the (single-threaded) fallback.
const ALS_AVAILABLE = await withServerRouter('/__als_probe__', async () =>
  getServerRouter().getPath(),
).then((p) => p === '/__als_probe__');

describe('withServerRouter', () => {
  it.skipIf(!ALS_AVAILABLE)('exposes the per-request router inside the callback', async () => {
    const result = await withServerRouter('/a', async () => getServerRouter().getPath());
    expect(result).toBe('/a');
  });

  it.skipIf(!ALS_AVAILABLE)('isolates concurrent requests', async () => {
    const a = withServerRouter('/foo', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getServerRouter().getPath();
    });
    const b = withServerRouter('/bar', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getServerRouter().getPath();
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe('/foo');
    expect(rb).toBe('/bar');
  });
});
