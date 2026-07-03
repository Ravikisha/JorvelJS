import { describe, expect, it } from 'vitest';
import { use } from '../src/use-promise.js';

describe('use(promise)', () => {
  it('throws the promise while pending', () => {
    const p = new Promise<number>(() => {});
    expect(() => use(p)).toThrow();
    try { use(p); } catch (e) { expect(e).toBeInstanceOf(Promise); }
  });

  it('returns the value once resolved (memoized on the promise)', async () => {
    const p = Promise.resolve(42);
    try { use(p); } catch (thrown) { await thrown; }
    expect(use(p)).toBe(42);
    expect(use(p)).toBe(42); // second read hits the cache, no re-suspend
  });

  it('throws the rejection reason once settled', async () => {
    const err = new Error('boom');
    const p = Promise.reject(err);
    try { use(p); } catch (thrown) { await Promise.allSettled([thrown]); }
    expect(() => use(p)).toThrow('boom');
  });
});
