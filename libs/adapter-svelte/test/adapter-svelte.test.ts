import { describe, expect, it } from 'vitest';
import { defineSvelteRemote } from '../src/index.js';
import { defineSvelteServerRemote } from '../src/server.js';
import { isMountModule, isServerModule } from '@jorvel/mount';

// Rendering a real Svelte 5 component needs the compiler (.svelte → JS), which
// is out of scope for a unit test. We assert the contract shape and the safe
// teardown path; end-to-end mounting is covered by the generated app's tests.
const FakeRoot = (() => {}) as never;

describe('defineSvelteRemote', () => {
  it('produces a valid mount module with mount + unmount', () => {
    const mod = defineSvelteRemote(FakeRoot);
    expect(isMountModule(mod)).toBe(true);
    expect(typeof mod.mount).toBe('function');
    expect(typeof mod.unmount).toBe('function');
  });

  it('unmount(el) is a no-op for a node that was never mounted', () => {
    const mod = defineSvelteRemote(FakeRoot);
    const el = document.createElement('div');
    expect(() => mod.unmount?.(el)).not.toThrow();
  });
});

describe('defineSvelteServerRemote', () => {
  it('produces a server module', () => {
    expect(isServerModule(defineSvelteServerRemote(FakeRoot))).toBe(true);
  });
});
