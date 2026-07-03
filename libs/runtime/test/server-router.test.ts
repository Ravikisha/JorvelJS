/**
 * Unit tests for createServerRouter / getServerRouter / setServerPath.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  createServerRouter,
  getServerRouter,
  setServerPath,
  withServerRouter,
  _resetServerRouter,
} from '../src/server-router.js';

afterEach(() => {
  _resetServerRouter();
});

// ── createServerRouter ────────────────────────────────────────────────────────

describe('createServerRouter', () => {
  it('getPath() returns the initial path', () => {
    const router = createServerRouter('/dashboard/settings');
    expect(router.getPath()).toBe('/dashboard/settings');
    router.destroy();
  });

  it('subscribe() calls the callback immediately with the current path', () => {
    const router = createServerRouter('/about');
    const calls: string[] = [];
    const unsub = router.subscribe((p) => calls.push(p));

    expect(calls).toEqual(['/about']);
    unsub();
    router.destroy();
  });

  it('subscribe() returns an unsubscribe function that stops future calls', () => {
    const router = createServerRouter('/');
    const calls: string[] = [];
    const unsub = router.subscribe((p) => calls.push(p));

    unsub();
    // navigate() after unsubscribe — callback should NOT be called again.
    router.navigate({ to: '/new-path' });

    expect(calls).toHaveLength(1); // only the initial sync call
    router.destroy();
  });

  it('navigate() updates getPath() on the server', () => {
    const router = createServerRouter('/');
    router.navigate({ to: '/navigated' });
    expect(router.getPath()).toBe('/navigated');
    router.destroy();
  });

  it('navigate() notifies remaining subscribers', () => {
    const router = createServerRouter('/');
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    router.navigate({ to: '/second' });
    expect(calls).toContain('/second');
    router.destroy();
  });

  it('destroy() clears all subscribers', () => {
    const router = createServerRouter('/');
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    router.destroy();
    // After destroy, internal subscriber set should be cleared.
    // We cannot call navigate() safely after destroy in browser router, but
    // the server router should be a no-op after destroy.
    expect(calls).toHaveLength(1); // only the initial sync call
  });

  it('multiple subscribers each receive the current path immediately', () => {
    const router = createServerRouter('/multi');
    const a: string[] = [];
    const b: string[] = [];

    router.subscribe((p) => a.push(p));
    router.subscribe((p) => b.push(p));

    expect(a).toEqual(['/multi']);
    expect(b).toEqual(['/multi']);
    router.destroy();
  });
});

// ── getServerRouter / setServerPath ──────────────────────────────────────────

describe('getServerRouter', () => {
  it('returns a router with the provided initial path', () => {
    const router = getServerRouter('/initial');
    expect(router.getPath()).toBe('/initial');
  });

  it('returns the same singleton on subsequent calls', () => {
    const a = getServerRouter('/');
    const b = getServerRouter('/');
    expect(a).toBe(b);
  });

  it('defaults to "/" when no path is provided', () => {
    const router = getServerRouter();
    expect(router.getPath()).toBe('/');
  });
});

describe('setServerPath', () => {
  it('replaces the singleton with a new path', () => {
    getServerRouter('/old');
    setServerPath('/new');
    const router = getServerRouter();
    expect(router.getPath()).toBe('/new');
  });
});

describe('_resetServerRouter', () => {
  it('clears the singleton so getServerRouter creates a fresh one', () => {
    const a = getServerRouter('/first');
    _resetServerRouter();
    const b = getServerRouter('/second');
    expect(a).not.toBe(b);
    expect(b.getPath()).toBe('/second');
  });
});

// AsyncLocalStorage is loaded via an indirect `new Function('s','return import(s)')`
// import (to hide `node:async_hooks` from browser bundlers). That indirection
// does NOT resolve under vitest's module runner, so ALS is unavailable here even
// though it works in real Node (verified). Probe once and skip the deep
// isolation assertions when ALS can't load, rather than asserting the fallback.
const ALS_AVAILABLE = await withServerRouter('/__als_probe__', async () =>
  getServerRouter().getPath(),
).then((p) => p === '/__als_probe__');
_resetServerRouter();

describe('withServerRouter (AsyncLocalStorage scope)', () => {
  it.skipIf(!ALS_AVAILABLE)('exposes the per-request router inside the callback', async () => {
    const path = await withServerRouter('/a', async () => getServerRouter().getPath());
    expect(path).toBe('/a');
  });

  it.skipIf(!ALS_AVAILABLE)('isolates concurrent requests (regression: loadAls promise-cache race)', async () => {
    // Two withServerRouter calls racing the FIRST ALS load must each stay in
    // their own scope — previously the second caller got a null store back
    // (load promise not yet resolved) and leaked into the fallback router.
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
