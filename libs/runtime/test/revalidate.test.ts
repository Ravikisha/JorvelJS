import { beforeEach, describe, expect, it } from 'vitest';
import {
  prefetchRemoteData,
  revalidateTag,
  revalidatePath,
  invalidateRemoteData,
  clearRemoteDataCache,
} from '../src/use-remote-data.js';

beforeEach(() => {
  clearRemoteDataCache();
});

describe('cache tags + revalidation', () => {
  it('serves from cache until the tag is revalidated', async () => {
    let calls = 0;
    const fetcher = async () => ++calls;

    await prefetchRemoteData('posts:list', fetcher, 60_000, ['posts']);
    await prefetchRemoteData('posts:list', fetcher, 60_000, ['posts']);
    expect(calls).toBe(1); // second call served from cache

    revalidateTag('posts');
    await prefetchRemoteData('posts:list', fetcher, 60_000, ['posts']);
    expect(calls).toBe(2); // purged → refetched
  });

  it('revalidateTag only purges entries carrying that tag', async () => {
    let a = 0;
    let b = 0;
    await prefetchRemoteData('a', async () => ++a, 60_000, ['users']);
    await prefetchRemoteData('b', async () => ++b, 60_000, ['posts']);

    revalidateTag('users');
    await prefetchRemoteData('a', async () => ++a, 60_000, ['users']);
    await prefetchRemoteData('b', async () => ++b, 60_000, ['posts']);
    expect(a).toBe(2); // users purged → refetched
    expect(b).toBe(1); // posts untouched
  });

  it('revalidatePath purges entries tagged with the path', async () => {
    let calls = 0;
    await prefetchRemoteData('dash', async () => ++calls, 60_000, ['/dashboard']);
    revalidatePath('/dashboard');
    await prefetchRemoteData('dash', async () => ++calls, 60_000, ['/dashboard']);
    expect(calls).toBe(2);
  });

  it('invalidateRemoteData purges a single key and clears its tag membership', async () => {
    let calls = 0;
    await prefetchRemoteData('k', async () => ++calls, 60_000, ['t']);
    invalidateRemoteData('k');
    await prefetchRemoteData('k', async () => ++calls, 60_000, ['t']);
    expect(calls).toBe(2);
    // tag bucket now empty → revalidating it is a no-op (no throw)
    expect(() => revalidateTag('t')).not.toThrow();
  });
});
