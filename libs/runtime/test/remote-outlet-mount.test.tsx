// @vitest-environment jsdom

import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteOutlet, getRouter, _resetRouter } from '../src/routing.js';
import type { JorvelMountContext, JorvelMountModule } from '@jorvel/mount';

function mount(element: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = ReactDOM.createRoot(div);
  root.render(element);
  return {
    div,
    unmount: () => {
      root.unmount();
      div.remove();
    },
  };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  _resetRouter();
});

describe('RemoteOutlet — framework-neutral mount modules', () => {
  it('mounts a non-React remote via the mount(ctx) contract', async () => {
    getRouter();
    window.history.replaceState(null, '', '/widget/reports/42');

    const seen: JorvelMountContext[] = [];
    // A "vanilla" remote — no React. Writes plain DOM into the node it's given.
    const vanillaRemote: JorvelMountModule = {
      mount(ctx) {
        seen.push(ctx);
        ctx.el.innerHTML = `<em data-testid="vanilla">${ctx.subpath}</em>`;
        return () => {
          ctx.el.innerHTML = '';
        };
      },
    };

    const importer = async () => ({ default: vanillaRemote });

    const { div, unmount } = mount(
      <RemoteOutlet
        routes={[{ path: '/widget/*', remote: 'widget', module: './App' }]}
        remotes={{ widget: importer }}
      />,
    );

    await vi.waitFor(() => {
      const el = div.querySelector('[data-testid="vanilla"]');
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe('/reports/42');
    });

    // Host handed the remote the right neutral context.
    expect(seen[0]!.subpath).toBe('/reports/42');
    expect(seen[0]!.basePath).toBe('/widget');
    expect(seen[0]!.signal).toBeInstanceOf(AbortSignal);

    unmount();
  });

  it('still renders a legacy React-component default (back-compat)', async () => {
    getRouter();
    window.history.replaceState(null, '', '/dashboard');

    const ReactRemote: React.FC<{ subpath?: string }> = ({ subpath }) => (
      <span data-testid="react-remote">{subpath}</span>
    );
    const importer = async () => ({ default: ReactRemote });

    const { div, unmount } = mount(
      <RemoteOutlet
        routes={[{ path: '/dashboard/*', remote: 'dashboard', module: './App' }]}
        remotes={{ dashboard: importer }}
      />,
    );

    await vi.waitFor(() => {
      expect(div.querySelector('[data-testid="react-remote"]')).toBeTruthy();
    });

    unmount();
  });
});
