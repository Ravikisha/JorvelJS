// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, useQuery, useMutation, useQueryClient } from '../src/query.js';

afterEach(() => { document.body.innerHTML = ''; });

function mount(el: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => { act(() => root.unmount()); host.remove(); } };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('QueryClient', () => {
  it('dedupes concurrent fetches for the same key', async () => {
    const client = new QueryClient();
    const fn = vi.fn(async () => 'v');
    const [a, b] = [client.fetchQuery(['k'], fn), client.fetchQuery(['k'], fn)];
    await Promise.all([a, b]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('setQueryData seeds the cache', () => {
    const client = new QueryClient();
    client.setQueryData(['user', 1], { name: 'Ada' });
    expect(client.getEntry<{ name: string }>(['user', 1]).data).toEqual({ name: 'Ada' });
    expect(client.isStale(['user', 1], 1000)).toBe(false);
  });

  it('invalidate marks matching queries stale by prefix', () => {
    const client = new QueryClient();
    client.setQueryData(['posts', 1], 'a');
    client.setQueryData(['posts', 2], 'b');
    client.setQueryData(['users', 1], 'c');
    client.invalidate(['posts']);
    expect(client.isStale(['posts', 1])).toBe(true);
    expect(client.isStale(['posts', 2])).toBe(true);
  });
});

describe('useQuery', () => {
  it('loads then renders data, calling queryFn once', async () => {
    const client = new QueryClient({ staleTime: 10_000 });
    const fn = vi.fn(async () => 'hello');
    function C() {
      const { data, isLoading } = useQuery({ queryKey: ['greeting'], queryFn: fn });
      return <span data-testid="v">{isLoading ? 'loading' : data}</span>;
    }
    const m = mount(<QueryProvider client={client}><C /></QueryProvider>);
    expect(m.host.querySelector('[data-testid="v"]')?.textContent).toBe('loading');
    await flush();
    expect(m.host.querySelector('[data-testid="v"]')?.textContent).toBe('hello');
    expect(fn).toHaveBeenCalledTimes(1);
    m.unmount();
  });

  it('serves cached data without refetching when fresh', async () => {
    const client = new QueryClient({ staleTime: 10_000 });
    client.setQueryData(['x'], 'cached');
    const fn = vi.fn(async () => 'fresh');
    function C() {
      const { data } = useQuery({ queryKey: ['x'], queryFn: fn });
      return <span data-testid="v">{data}</span>;
    }
    const m = mount(<QueryProvider client={client}><C /></QueryProvider>);
    await flush();
    expect(m.host.querySelector('[data-testid="v"]')?.textContent).toBe('cached');
    expect(fn).not.toHaveBeenCalled();
    m.unmount();
  });
});

describe('useMutation', () => {
  it('starts idle, runs, and can invalidate a query', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidate');
    let api: { run?: () => void } = {};
    function C() {
      const qc = useQueryClient();
      const m = useMutation({
        mutationFn: async (n: number) => n * 2,
        onSuccess: () => qc.invalidate(['nums']),
      });
      api.run = () => m.mutate(21);
      return <span data-testid="v">{m.isPending ? 'pending' : String(m.data ?? m.status)}</span>;
    }
    const view = mount(<QueryProvider client={client}><C /></QueryProvider>);
    expect(view.host.querySelector('[data-testid="v"]')?.textContent).toBe('idle');
    await act(async () => { api.run!(); await Promise.resolve(); await Promise.resolve(); });
    expect(view.host.querySelector('[data-testid="v"]')?.textContent).toBe('42');
    expect(invalidate).toHaveBeenCalledWith(['nums']);
    view.unmount();
  });
});

// local provider wrapper (avoids importing the JSX-heavy provider name twice)
import { QueryClientProvider } from '../src/query.js';
function QueryProvider({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
