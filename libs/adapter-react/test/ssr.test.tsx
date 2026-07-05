import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { defineReactRemote, type ReactRemoteProps } from '../src/index.js';
import { defineReactServerRemote } from '../src/server.js';
import { isServerModule, type JorvelMountContext, type JorvelSSRContext } from '@jorvel/mount';

const ssrCtx: JorvelSSRContext = { subpath: '/plans', basePath: '/pricing', params: { tier: 'pro' } };

function Root(p: ReactRemoteProps) {
  return <span data-testid="v">{p.subpath}:{String((p.initialState as { n?: number } | undefined)?.n ?? '-')}</span>;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('defineReactServerRemote', () => {
  it('produces a server module that renders to a string', async () => {
    const server = defineReactServerRemote(Root);
    expect(isServerModule(server)).toBe(true);
    const out = await server.renderToString(ssrCtx);
    const html = typeof out === 'string' ? out : out.html;
    expect(html).toContain('/plans');
  });

  it('carries getState output as fragment state', async () => {
    const server = defineReactServerRemote(Root, { getState: () => ({ n: 42 }), head: '<style>.x{}</style>' });
    const out = await server.renderToString(ssrCtx);
    if (typeof out === 'string') throw new Error('expected object');
    expect(out.state).toEqual({ n: 42 });
    expect(out.head).toContain('.x{}');
    // React separates text segments with comment markers, so assert the pieces.
    expect(out.html).toContain('/plans');
    expect(out.html).toContain('42');
  });
});

describe('SSR → hydrate loop', () => {
  it('hydrates server-rendered markup instead of a fresh render', async () => {
    // 1. Server render.
    const server = defineReactServerRemote(Root, { getState: () => ({ n: 7 }) });
    const rendered = await server.renderToString(ssrCtx);
    const { html, state } = typeof rendered === 'string' ? { html: rendered, state: undefined } : rendered;

    // 2. Put the server HTML into a host-owned node.
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    const serverNode = el.querySelector('[data-testid="v"]');
    expect(serverNode?.textContent).toBe('/plans:7');

    // 3. Client hydrates the SAME markup (no warning path when matched).
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = defineReactRemote(Root);
    const ctx: JorvelMountContext = {
      el,
      subpath: '/plans',
      basePath: '/pricing',
      params: { tier: 'pro' },
      hydrate: true,
      ...(state !== undefined ? { initialState: state } : {}),
    };
    const dispose = client.mount(ctx) as () => void;
    await flush();

    expect(el.querySelector('[data-testid="v"]')?.textContent).toBe('/plans:7');
    // No hydration-mismatch errors were logged.
    const mismatch = errSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes('hydrat'));
    expect(mismatch).toBe(false);
    errSpy.mockRestore();

    dispose();
    await flush();
    el.remove();
  });
});
