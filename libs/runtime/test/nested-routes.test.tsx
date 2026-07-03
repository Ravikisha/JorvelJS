// @vitest-environment jsdom

import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  NestedRouter,
  Outlet,
  resolveChain,
  useOutletParams,
  type NestedRoute,
} from '../src/nested-routes.js';
import { dispatchJorvelNavigate } from '../src/router.js';

function mount(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  root.render(element);
  return {
    host,
    root,
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}

async function waitFor(check: () => boolean, timeout = 500) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('waitFor timed out');
}

afterEach(() => {
  document.body.innerHTML = '';
  // Reset URL between tests so getRouter() pathname stays predictable.
  window.history.replaceState({}, '', '/');
});

describe('resolveChain', () => {
  it('returns an empty chain when no route matches', () => {
    const routes: NestedRoute[] = [{ path: '/about', element: <p>about</p> }];
    expect(resolveChain(routes, '/missing')).toEqual([]);
  });

  it('matches a single static route', () => {
    const routes: NestedRoute[] = [{ path: '/about', element: <p>about</p> }];
    const chain = resolveChain(routes, '/about');
    expect(chain).toHaveLength(1);
    expect(chain[0].route.path).toBe('/about');
  });

  it('walks parent → child and collects both matches', () => {
    const routes: NestedRoute[] = [
      {
        path: '/app',
        element: <p>app</p>,
        children: [{ path: '/settings', element: <p>settings</p> }],
      },
    ];
    const chain = resolveChain(routes, '/app/settings');
    expect(chain.map((m) => m.route.path)).toEqual(['/app', '/settings']);
  });

  it('extracts :param values into each segment’s params', () => {
    const routes: NestedRoute[] = [
      {
        path: '/users/:userId',
        children: [{ path: '/posts/:postId', element: <p>post</p> }],
      },
    ];
    const chain = resolveChain(routes, '/users/42/posts/7');
    expect(chain[0].params).toEqual({ userId: '42' });
    expect(chain[1].params).toEqual({ postId: '7' });
  });

  it('matches an index route under a parent for the exact parent path', () => {
    const routes: NestedRoute[] = [
      {
        path: '/app',
        children: [{ index: true, element: <p>dash</p> }, { path: '/profile', element: <p>profile</p> }],
      },
    ];
    const chain = resolveChain(routes, '/app');
    expect(chain).toHaveLength(2);
    expect(chain[1].route.index).toBe(true);
  });
});

describe('NestedRouter', () => {
  it('renders the matched leaf route', async () => {
    window.history.replaceState({}, '', '/about');
    dispatchJorvelNavigate({ to: '/about', mode: 'replace' });
    const routes: NestedRoute[] = [{ path: '/about', element: <p data-testid="about">about-page</p> }];

    const { host, unmount } = mount(<NestedRouter routes={routes} />);
    await waitFor(() => !!host.querySelector('[data-testid="about"]'));
    unmount();
  });

  it('renders parent layout with the child via <Outlet />', async () => {
    function Layout() {
      return (
        <section>
          <h1 data-testid="layout">app-shell</h1>
          <Outlet />
        </section>
      );
    }

    window.history.replaceState({}, '', '/app/settings');
    dispatchJorvelNavigate({ to: '/app/settings', mode: 'replace' });

    const routes: NestedRoute[] = [
      {
        path: '/app',
        element: <Layout />,
        children: [{ path: '/settings', element: <p data-testid="settings">settings-page</p> }],
      },
    ];

    const { host, unmount } = mount(<NestedRouter routes={routes} />);
    await waitFor(
      () =>
        !!host.querySelector('[data-testid="layout"]') &&
        !!host.querySelector('[data-testid="settings"]'),
    );
    unmount();
  });

  it('renders the notFound element when nothing matches', async () => {
    window.history.replaceState({}, '', '/nope');
    dispatchJorvelNavigate({ to: '/nope', mode: 'replace' });
    const routes: NestedRoute[] = [{ path: '/about', element: <p>about</p> }];

    const { host, unmount } = mount(
      <NestedRouter routes={routes} notFound={<p data-testid="nf">missing</p>} />,
    );
    await waitFor(() => !!host.querySelector('[data-testid="nf"]'));
    unmount();
  });

  it('useOutletParams exposes merged params to descendant components', async () => {
    function Child() {
      const params = useOutletParams<{ userId: string; postId: string }>();
      return (
        <p data-testid="params">
          {params.userId}-{params.postId}
        </p>
      );
    }

    function Layout() {
      return (
        <div>
          <Outlet />
        </div>
      );
    }

    window.history.replaceState({}, '', '/users/42/posts/7');
    dispatchJorvelNavigate({ to: '/users/42/posts/7', mode: 'replace' });

    const routes: NestedRoute[] = [
      {
        path: '/users/:userId',
        element: <Layout />,
        children: [{ path: '/posts/:postId', element: <Child /> }],
      },
    ];

    const { host, unmount } = mount(<NestedRouter routes={routes} />);
    await waitFor(() => host.querySelector('[data-testid="params"]')?.textContent === '42-7');
    unmount();
  });

  it('renders the segment errorElement when the segment throws (error.tsx)', async () => {
    function Boom(): React.ReactElement {
      throw new Error('segment-exploded');
    }

    window.history.replaceState({}, '', '/app/boom');
    dispatchJorvelNavigate({ to: '/app/boom', mode: 'replace' });

    const routes: NestedRoute[] = [
      {
        path: '/app',
        element: (
          <section>
            <h1 data-testid="layout">shell</h1>
            <Outlet />
          </section>
        ),
        children: [
          {
            path: '/boom',
            element: <Boom />,
            errorElement: ({ error }) => (
              <p data-testid="seg-error">{(error as Error).message}</p>
            ),
          },
        ],
      },
    ];

    const { host, unmount } = mount(<NestedRouter routes={routes} />);
    // Layout survives; only the failing child segment is replaced.
    await waitFor(
      () =>
        !!host.querySelector('[data-testid="layout"]') &&
        host.querySelector('[data-testid="seg-error"]')?.textContent === 'segment-exploded',
    );
    unmount();
  });

  it('shows the segment loading fallback while its lazy element resolves (loading.tsx)', async () => {
    let resolveLazy!: (m: { default: React.ComponentType }) => void;
    const pending = new Promise<{ default: React.ComponentType }>((r) => { resolveLazy = r; });

    window.history.replaceState({}, '', '/slow');
    dispatchJorvelNavigate({ to: '/slow', mode: 'replace' });

    const routes: NestedRoute[] = [
      {
        path: '/slow',
        loading: <p data-testid="seg-loading">loading-segment</p>,
        lazy: () => pending,
      },
    ];

    const { host, unmount } = mount(<NestedRouter routes={routes} />);
    await waitFor(() => !!host.querySelector('[data-testid="seg-loading"]'));
    resolveLazy({ default: () => <p data-testid="slow">slow-done</p> });
    await waitFor(() => !!host.querySelector('[data-testid="slow"]'));
    unmount();
  });

  it('resolves a lazily-loaded route element via the `lazy` loader', async () => {
    function LazyLeaf() {
      return <p data-testid="lazy">lazy-leaf</p>;
    }

    window.history.replaceState({}, '', '/lazy');
    dispatchJorvelNavigate({ to: '/lazy', mode: 'replace' });

    const routes: NestedRoute[] = [
      { path: '/lazy', lazy: async () => ({ default: LazyLeaf }) },
    ];

    const { host, unmount } = mount(<NestedRouter routes={routes} fallback={<p data-testid="fb">loading</p>} />);
    await waitFor(() => !!host.querySelector('[data-testid="lazy"]'));
    unmount();
  });
});
