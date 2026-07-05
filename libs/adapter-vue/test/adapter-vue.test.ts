import { describe, expect, it } from 'vitest';
import { h, defineComponent } from 'vue';
import { defineVueRemote } from '../src/index.js';
import { isMountModule, type JorvelMountContext } from '@jorvel/mount';

function ctx(el: HTMLElement, over: Partial<JorvelMountContext> = {}): JorvelMountContext {
  return { el, subpath: '/', basePath: '/app', params: {}, ...over };
}

// A render-function component — no SFC compiler needed in tests.
const Root = defineComponent({
  props: { subpath: { type: String, default: '' }, params: { type: Object, default: () => ({}) } },
  setup(props) {
    return () => h('span', { 'data-testid': 'vue' }, props.subpath);
  },
});

describe('defineVueRemote', () => {
  it('produces a valid mount module', () => {
    expect(isMountModule(defineVueRemote(Root))).toBe(true);
  });

  it('mounts a Vue app into the host node with mapped props', () => {
    const el = document.createElement('div');
    const mod = defineVueRemote(Root);
    mod.mount(ctx(el, { subpath: '/reports/42' }));
    expect(el.querySelector('[data-testid="vue"]')?.textContent).toBe('/reports/42');
  });

  it('unmounts on dispose, clearing the node', () => {
    const el = document.createElement('div');
    const mod = defineVueRemote(Root);
    const dispose = mod.mount(ctx(el)) as () => void;
    expect(el.querySelector('[data-testid="vue"]')).toBeTruthy();
    dispose();
    expect(el.querySelector('[data-testid="vue"]')).toBeNull();
  });

  it('runs the setup hook with the app + context', () => {
    const el = document.createElement('div');
    let sawSubpath = '';
    const mod = defineVueRemote(Root, {
      setup: (app, c) => {
        sawSubpath = c.subpath;
        expect(typeof app.use).toBe('function');
      },
    });
    mod.mount(ctx(el, { subpath: '/x' }));
    expect(sawSubpath).toBe('/x');
  });
});
