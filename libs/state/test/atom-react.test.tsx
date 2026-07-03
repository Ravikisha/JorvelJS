// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atom, derivedAtom } from '../src/atom.js';
import { useAtom, useAtomValue, useSetAtom } from '../src/react.js';

afterEach(() => { document.body.innerHTML = ''; });

function mount(el: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => { act(() => root.unmount()); host.remove(); } };
}

describe('useAtom / useAtomValue / useSetAtom', () => {
  it('renders an atom value and updates on set', () => {
    const count = atom(0);
    function C() {
      const [n, setN] = useAtom(count);
      return <button data-testid="b" onClick={() => setN((p) => p + 1)}>{n}</button>;
    }
    const m = mount(<C />);
    const btn = m.host.querySelector('[data-testid="b"]') as HTMLButtonElement;
    expect(btn.textContent).toBe('0');
    act(() => btn.click());
    expect(btn.textContent).toBe('1');
    m.unmount();
  });

  it('useAtomValue re-renders on derived-atom change', () => {
    const price = atom(100);
    const withTax = derivedAtom([price], ([p]) => p * 1.1);
    function C() {
      const v = useAtomValue(withTax);
      return <span data-testid="v">{v.toFixed(1)}</span>;
    }
    const m = mount(<C />);
    expect(m.host.querySelector('[data-testid="v"]')?.textContent).toBe('110.0');
    act(() => price.set(200));
    expect(m.host.querySelector('[data-testid="v"]')?.textContent).toBe('220.0');
    m.unmount();
  });

  it('useSetAtom does not subscribe (no re-render on change)', () => {
    const a = atom(0);
    const renders = vi.fn();
    function Setter() {
      renders();
      const set = useSetAtom(a);
      return <button data-testid="s" onClick={() => set(5)}>set</button>;
    }
    const m = mount(<Setter />);
    expect(renders).toHaveBeenCalledTimes(1);
    act(() => (m.host.querySelector('[data-testid="s"]') as HTMLButtonElement).click());
    // value changed but this component doesn't read it → no extra render
    expect(renders).toHaveBeenCalledTimes(1);
    expect(a.get()).toBe(5);
    m.unmount();
  });
});
