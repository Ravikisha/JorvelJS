// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useOptimistic } from '../src/optimistic.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(el: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  act(() => root.render(el));
  return { host, root, unmount: () => { act(() => root.unmount()); host.remove(); } };
}

describe('useOptimistic', () => {
  it('applies an optimistic overlay immediately, then clears when base state changes', () => {
    const api: { add?: (n: string) => void } = {};
    function List({ items }: { items: string[] }) {
      const [optimistic, addOptimistic] = useOptimistic<string[], string>(
        items,
        (cur, next) => [...cur, next],
      );
      api.add = addOptimistic;
      return <ul>{optimistic.map((i, k) => <li key={k}>{i}</li>)}</ul>;
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    act(() => root.render(<List items={['a']} />));
    expect(host.querySelectorAll('li')).toHaveLength(1);

    // optimistic add — shows before the "server" confirms
    act(() => api.add!('b'));
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(host.textContent).toContain('b');

    // base state updates (server confirmed) → overlay cleared, no duplicate
    act(() => root.render(<List items={['a', 'b']} />));
    expect(host.querySelectorAll('li')).toHaveLength(2);

    act(() => root.unmount());
    host.remove();
  });

  it('reduces multiple optimistic actions in order', () => {
    const api: { add?: (n: number) => void } = {};
    function Counter({ base }: { base: number }) {
      const [val, add] = useOptimistic<number, number>(base, (cur, delta) => cur + delta);
      api.add = add;
      return <span data-testid="v">{val}</span>;
    }
    const m = mount(<Counter base={10} />);
    act(() => { api.add!(1); api.add!(2); });
    expect(m.host.querySelector('[data-testid="v"]')?.textContent).toBe('13');
    m.unmount();
  });
});
