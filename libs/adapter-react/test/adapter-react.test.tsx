import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { defineReactRemote, type ReactRemoteProps } from '../src/index.js';
import { isMountModule, type JorvelMountContext } from '@jorvel/mount';

function ctx(el: HTMLElement, over: Partial<JorvelMountContext> = {}): JorvelMountContext {
  return { el, subpath: '/', basePath: '/app', params: {}, ...over };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('defineReactRemote', () => {
  it('produces a valid mount module', () => {
    const mod = defineReactRemote(() => <div>hi</div>);
    expect(isMountModule(mod)).toBe(true);
  });

  it('renders the component into the host node with mapped props', async () => {
    const el = document.createElement('div');
    const seen: ReactRemoteProps[] = [];
    const mod = defineReactRemote((p) => {
      seen.push(p);
      return <span data-testid="v">{p.subpath}</span>;
    });

    mod.mount(ctx(el, { subpath: '/reports/42', params: { id: '42' } }));
    await flush();

    expect(el.textContent).toBe('/reports/42');
    expect(seen[0]!.params).toEqual({ id: '42' });
    expect(seen[0]!.basePath).toBe('/app');
  });

  it('unmounts on dispose, clearing the node', async () => {
    const el = document.createElement('div');
    const mod = defineReactRemote(() => <p>content</p>);
    const dispose = mod.mount(ctx(el)) as () => void;
    await flush();
    expect(el.textContent).toBe('content');

    dispose();
    await flush();
    expect(el.textContent).toBe('');
  });

  it('applies the wrap option', async () => {
    const el = document.createElement('div');
    const mod = defineReactRemote(() => <span>inner</span>, {
      wrap: (node) => <div data-wrapped="1">{node}</div>,
    });
    mod.mount(ctx(el));
    await flush();
    expect(el.querySelector('[data-wrapped="1"]')?.textContent).toBe('inner');
  });
});
