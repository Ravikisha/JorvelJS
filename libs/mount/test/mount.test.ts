import { describe, expect, it, vi } from 'vitest';
import {
  asMountModule,
  isMountModule,
  mountRemoteModule,
  type JorvelMountContext,
  type JorvelMountModule,
} from '../src/index.js';

function ctx(el: HTMLElement): JorvelMountContext {
  return { el, subpath: '/', basePath: '/app', params: {} };
}

describe('isMountModule', () => {
  it('accepts an object with a mount function', () => {
    expect(isMountModule({ mount() {} })).toBe(true);
  });
  it('rejects non-mount values', () => {
    expect(isMountModule(null)).toBe(false);
    expect(isMountModule(() => null)).toBe(false); // a React component is a function, not a mount module
    expect(isMountModule({})).toBe(false);
    expect(isMountModule({ default: {} })).toBe(false);
  });
});

describe('asMountModule', () => {
  it('unwraps a namespace default', () => {
    const m: JorvelMountModule = { mount() {} };
    expect(asMountModule({ default: m })).toBe(m);
  });
  it('accepts a bare mount module', () => {
    const m: JorvelMountModule = { mount() {} };
    expect(asMountModule(m)).toBe(m);
  });
  it('returns null for a legacy component default', () => {
    expect(asMountModule({ default: () => null })).toBeNull();
  });
});

describe('mountRemoteModule', () => {
  it('calls mount with the context and disposes the returned teardown', () => {
    const el = document.createElement('div');
    const dispose = vi.fn();
    const mount = vi.fn(() => dispose);
    const disposer = mountRemoteModule({ mount }, ctx(el));

    expect(mount).toHaveBeenCalledOnce();
    expect(mount.mock.calls[0]![0]!.el).toBe(el);
    expect(dispose).not.toHaveBeenCalled();

    disposer();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('also calls module.unmount(el) on dispose', () => {
    const el = document.createElement('div');
    const unmount = vi.fn();
    const disposer = mountRemoteModule({ mount() {}, unmount }, ctx(el));
    disposer();
    expect(unmount).toHaveBeenCalledWith(el);
  });

  it('is idempotent — a second dispose is a no-op', () => {
    const el = document.createElement('div');
    const dispose = vi.fn();
    const disposer = mountRemoteModule({ mount: () => dispose }, ctx(el));
    disposer();
    disposer();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('disposes an async mount that resolves after teardown', async () => {
    const el = document.createElement('div');
    const dispose = vi.fn();
    let resolveMount: (d: () => void) => void = () => {};
    const mount = () => new Promise<() => void>((r) => { resolveMount = r; });
    const disposer = mountRemoteModule({ mount }, ctx(el));

    // Tear down before the async mount resolves.
    disposer();
    resolveMount(dispose);
    await Promise.resolve();
    await Promise.resolve();

    // The late-resolved disposer must still run.
    expect(dispose).toHaveBeenCalledOnce();
  });
});
