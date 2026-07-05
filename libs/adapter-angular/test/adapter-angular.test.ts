import { describe, expect, it } from 'vitest';
import { defineAngularRemote } from '../src/index.js';
import { defineAngularServerRemote } from '../src/server.js';
import { isMountModule, isServerModule, type JorvelMountModule } from '@jorvel/mount';

// The Angular runtime (@angular/*) is a peer dependency and isn't installed in
// this workspace, so we assert the contract shape and lazy-load boundary rather
// than a live bootstrap. `import` of Angular only happens inside mount().
const FakeRoot = class {} as never;

describe('defineAngularRemote', () => {
  it('produces a valid mount module with mount + unmount', () => {
    const mod: JorvelMountModule = defineAngularRemote(FakeRoot);
    expect(isMountModule(mod)).toBe(true);
    expect(typeof mod.mount).toBe('function');
    expect(typeof mod.unmount).toBe('function');
  });

  it('unmount(el) is a no-op for a node that was never mounted', () => {
    const mod = defineAngularRemote(FakeRoot);
    const el = document.createElement('div');
    expect(() => mod.unmount?.(el)).not.toThrow();
  });
});

describe('defineAngularServerRemote', () => {
  it('produces a server module (Angular runtime imported lazily)', () => {
    expect(isServerModule(defineAngularServerRemote(FakeRoot))).toBe(true);
  });
});
