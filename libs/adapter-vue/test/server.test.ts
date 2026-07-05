import { describe, expect, it } from 'vitest';
import { h, defineComponent } from 'vue';
import { defineVueServerRemote } from '../src/server.js';
import { isServerModule, type JorvelSSRContext } from '@jorvel/mount';

const ctx: JorvelSSRContext = { subpath: '/plans', basePath: '/pricing', params: { tier: 'pro' } };

const Root = defineComponent({
  props: { subpath: { type: String, default: '' } },
  setup(props) {
    return () => h('span', { class: 'v' }, props.subpath);
  },
});

describe('defineVueServerRemote', () => {
  it('is a server module', () => {
    expect(isServerModule(defineVueServerRemote(Root))).toBe(true);
  });

  it('renders the component to an HTML string', async () => {
    const server = defineVueServerRemote(Root);
    const out = await server.renderToString(ctx);
    const html = typeof out === 'string' ? out : out.html;
    expect(html).toContain('/plans');
    expect(html).toContain('class="v"');
  });

  it('carries head + state from options', async () => {
    const server = defineVueServerRemote(Root, { head: '<style>.v{}</style>', getState: () => ({ n: 3 }) });
    const out = await server.renderToString(ctx);
    if (typeof out === 'string') throw new Error('expected object');
    expect(out.head).toContain('.v{}');
    expect(out.state).toEqual({ n: 3 });
  });
});
