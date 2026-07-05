import { describe, expect, it } from 'vitest';
import {
  asServerModule,
  composeFragments,
  hydrateFragments,
  isServerModule,
  readSSRState,
  renderFragment,
  serializeState,
  FRAGMENT_ATTR,
  SSR_STATE_ID,
  type JorvelServerModule,
} from '../src/index.js';

const ctx = { subpath: '/', basePath: '/app', params: {} };

describe('isServerModule / asServerModule', () => {
  it('detects a server module by renderToString', () => {
    expect(isServerModule({ renderToString: () => '' })).toBe(true);
    expect(isServerModule({})).toBe(false);
    expect(asServerModule({ default: { renderToString: () => '' } })).not.toBeNull();
    expect(asServerModule({ default: () => null })).toBeNull();
  });
});

describe('renderFragment', () => {
  it('normalizes a bare-string result', async () => {
    const server: JorvelServerModule = { renderToString: () => '<p>hi</p>' };
    expect(await renderFragment('a', server, ctx)).toEqual({ id: 'a', html: '<p>hi</p>' });
  });
  it('passes through head + state', async () => {
    const server: JorvelServerModule = {
      renderToString: async () => ({ html: '<p>x</p>', head: '<style>.x{}</style>', state: { n: 1 } }),
    };
    const f = await renderFragment('b', server, ctx);
    expect(f).toEqual({ id: 'b', html: '<p>x</p>', head: '<style>.x{}</style>', state: { n: 1 } });
  });
});

describe('serializeState', () => {
  it('escapes </script>-breaking characters', () => {
    const out = serializeState({ x: '</script><b>&' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u0026');
    // still valid JSON once unescaped by the JS parser
    expect(JSON.parse(JSON.parse(`"${out.replace(/"/g, '\\"')}"`))).toBeDefined;
  });
});

describe('composeFragments', () => {
  const fragments = [
    { id: 'pricing', html: '<h1>Vue</h1>', head: '<style>.v{}</style>', state: { tier: 'pro' } },
    { id: 'reports', html: '<h1>Ng</h1>' },
  ];

  it('wraps each fragment in a marked mount point', () => {
    const r = composeFragments(fragments);
    expect(r.body).toContain(`${FRAGMENT_ATTR}="pricing"`);
    expect(r.body).toContain('<h1>Vue</h1>');
    expect(r.body).toContain(`${FRAGMENT_ATTR}="reports"`);
  });

  it('collects heads and emits a keyed state script', () => {
    const r = composeFragments(fragments);
    expect(r.head).toContain('.v{}');
    expect(r.state).toContain(SSR_STATE_ID);
    expect(r.state).toContain('pricing');
  });

  it('fills a document template', () => {
    const r = composeFragments(fragments, {
      template: '<!doctype html><head>{{head}}{{state}}</head><body>{{body}}</body>',
    });
    expect(r.html).toContain('<!doctype html>');
    expect(r.html).toContain('<h1>Vue</h1>');
    expect(r.html).toContain(SSR_STATE_ID);
  });

  it('round-trips state through readSSRState', () => {
    const r = composeFragments(fragments);
    // jsdom document — inject the state script and read it back.
    document.body.innerHTML = r.state;
    expect(readSSRState()).toEqual({ pricing: { tier: 'pro' } });
    document.body.innerHTML = '';
  });

  it('stamps routing context as data-attributes when fragment.ctx is set', () => {
    const r = composeFragments([
      { id: 'x', html: '<i>hi</i>', ctx: { subpath: '/a', basePath: '/x', params: { id: '9' } } },
    ]);
    expect(r.body).toContain('data-subpath="/a"');
    expect(r.body).toContain('data-basepath="/x"');
    expect(r.body).toContain('data-params="{&quot;id&quot;:&quot;9&quot;}"');
  });
});

describe('hydrateFragments', () => {
  it('mounts each fragment with hydrate:true + stamped context + state', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const remote = {
      mount(ctx: { el: HTMLElement; subpath: string; basePath: string; params: Record<string, string>; hydrate?: boolean; initialState?: unknown }) {
        seen.push({ subpath: ctx.subpath, basePath: ctx.basePath, params: ctx.params, hydrate: ctx.hydrate, initialState: ctx.initialState });
        return () => {};
      },
    };

    const r = composeFragments([
      { id: 'pricing', html: '<em>vue</em>', state: { tier: 'pro' }, ctx: { subpath: '/plans', basePath: '/pricing', params: { p: '1' } } },
    ]);
    document.body.innerHTML = r.body + r.state;

    const dispose = await hydrateFragments({ pricing: async () => ({ default: remote }) });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      subpath: '/plans',
      basePath: '/pricing',
      params: { p: '1' },
      hydrate: true,
      initialState: { tier: 'pro' },
    });
    expect(typeof dispose).toBe('function');
    dispose();
    document.body.innerHTML = '';
  });

  it('skips fragments with no registered loader', async () => {
    const r = composeFragments([{ id: 'unknown', html: '<i>x</i>' }]);
    document.body.innerHTML = r.body;
    const dispose = await hydrateFragments({});
    expect(typeof dispose).toBe('function');
    document.body.innerHTML = '';
  });
});
