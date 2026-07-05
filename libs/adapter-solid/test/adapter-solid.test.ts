import { describe, expect, it } from 'vitest';
import { defineSolidRemote, type SolidRemoteProps } from '../src/index.js';
import { defineSolidServerRemote } from '../src/server.js';
import { isMountModule, isServerModule } from '@jorvel/mount';

// A live Solid render needs vite-plugin-solid + the browser export condition,
// which is out of scope for a unit test. We assert the contract shape and the
// safe teardown path; end-to-end rendering is covered by the generated app.
const Root = (_props: SolidRemoteProps) => null as never;

describe('defineSolidRemote', () => {
  it('produces a valid mount module with mount + unmount', () => {
    const mod = defineSolidRemote(Root);
    expect(isMountModule(mod)).toBe(true);
    expect(typeof mod.mount).toBe('function');
    expect(typeof mod.unmount).toBe('function');
  });

  it('unmount(el) is a no-op for a node that was never mounted', () => {
    const mod = defineSolidRemote(Root);
    const el = document.createElement('div');
    expect(() => mod.unmount?.(el)).not.toThrow();
  });
});

describe('defineSolidServerRemote', () => {
  it('produces a server module', () => {
    expect(isServerModule(defineSolidServerRemote(Root))).toBe(true);
  });
});
