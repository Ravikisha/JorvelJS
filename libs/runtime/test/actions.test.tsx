// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  defineAction,
  useAction,
  useFormAction,
  Form,
} from '../src/actions.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('defineAction', () => {
  it('is an identity wrapper that preserves behavior', async () => {
    const action = defineAction(async (n: number) => n * 2);
    expect(await action(21)).toBe(42);
  });
});

function renderHook<T>(useHook: () => T): { current: T; unmount: () => void } {
  const box = { current: undefined as unknown as T };
  function Probe() {
    box.current = useHook();
    return null;
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  act(() => root.render(<Probe />));
  return {
    get current() { return box.current; },
    unmount: () => { act(() => root.unmount()); host.remove(); },
  };
}

describe('useAction', () => {
  it('tracks pending → data on success', async () => {
    const action = defineAction(async (n: number) => n + 1);
    const hook = renderHook(() => useAction(action));

    expect(hook.current.pending).toBe(false);
    expect(hook.current.data).toBeNull();

    await act(async () => { await hook.current.submit(41); });
    expect(hook.current.pending).toBe(false);
    expect(hook.current.data).toBe(42);
    expect(hook.current.error).toBeNull();
    hook.unmount();
  });

  it('captures errors and rethrows from submit', async () => {
    const action = defineAction(async () => { throw new Error('nope'); });
    const hook = renderHook(() => useAction(action));

    await act(async () => {
      await expect(hook.current.submit(undefined)).rejects.toThrow('nope');
    });
    expect((hook.current.error as Error).message).toBe('nope');
    expect(hook.current.pending).toBe(false);
    hook.unmount();
  });

  it('last-wins: a stale submission does not clobber a newer result', async () => {
    let resolveSlow!: (v: string) => void;
    const slow = new Promise<string>((r) => { resolveSlow = r; });
    let call = 0;
    const action = defineAction(async (_in: string) => {
      call += 1;
      return call === 1 ? slow : 'fast';
    });
    const hook = renderHook(() => useAction(action));

    let slowPromise!: Promise<string>;
    await act(async () => { slowPromise = hook.current.submit('a'); });
    await act(async () => { await hook.current.submit('b'); });
    expect(hook.current.data).toBe('fast');

    await act(async () => { resolveSlow('slow'); await slowPromise; });
    // Slow resolved last but is stale → must NOT overwrite 'fast'.
    expect(hook.current.data).toBe('fast');
    hook.unmount();
  });

  it('reset clears state', async () => {
    const action = defineAction(async (n: number) => n);
    const hook = renderHook(() => useAction(action));
    await act(async () => { await hook.current.submit(5); });
    expect(hook.current.data).toBe(5);
    act(() => hook.current.reset());
    expect(hook.current.data).toBeNull();
    hook.unmount();
  });
});

describe('useFormAction', () => {
  it('reads FormData on submit and runs the action', async () => {
    const seen: Record<string, unknown> = {};
    const action = defineAction(async (fd: FormData) => {
      seen.name = fd.get('name');
      return 'saved';
    });

    let formRef!: HTMLFormElement;
    function Form() {
      const { onSubmit, data } = useFormAction(action);
      return (
        <form ref={(el) => { if (el) formRef = el; }} onSubmit={onSubmit}>
          <input name="name" defaultValue="ada" readOnly />
          <span data-testid="result">{data}</span>
        </form>
      );
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    act(() => root.render(<Form />));

    await act(async () => {
      formRef.requestSubmit();
      await Promise.resolve();
    });

    expect(seen.name).toBe('ada');
    act(() => root.unmount());
    host.remove();
  });
});

describe('<Form>', () => {
  it('injects a hidden CSRF field and submits FormData', async () => {
    const seen: Record<string, unknown> = {};
    const action = defineAction(async (fd: FormData) => {
      seen.csrf = fd.get('_csrf');
      seen.email = fd.get('email');
      return 'ok';
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    act(() =>
      root.render(
        <Form action={action} csrf={{ token: 'tok-123' }} data-testid="f">
          {(state) => (
            <>
              <input name="email" defaultValue="a@b.c" readOnly />
              <button data-testid="submit" disabled={state.pending}>go</button>
            </>
          )}
        </Form>,
      ),
    );

    const hidden = host.querySelector('input[name="_csrf"]') as HTMLInputElement;
    expect(hidden.value).toBe('tok-123');
    expect(hidden.type).toBe('hidden');

    const form = host.querySelector('[data-testid="f"]') as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
      await Promise.resolve();
    });
    expect(seen.csrf).toBe('tok-123');
    expect(seen.email).toBe('a@b.c');

    act(() => root.unmount());
    host.remove();
  });

  it('renders a native POST target as the no-JS fallback', () => {
    const action = defineAction(async () => 'ok');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    act(() => root.render(<Form action={action} formAction="/api/x" data-testid="f2" />));
    const form = host.querySelector('[data-testid="f2"]') as HTMLFormElement;
    expect(form.getAttribute('action')).toBe('/api/x');
    expect(form.getAttribute('method')).toBe('post');
    act(() => root.unmount());
    host.remove();
  });
});
