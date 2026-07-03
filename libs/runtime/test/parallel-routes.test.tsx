import React from 'react';
import { describe, expect, it } from 'vitest';
import { defineSlots, matchSlot } from '../src/parallel-routes.js';

describe('parallel routes', () => {
  const slots = defineSlots({
    modal: [
      { path: '/photos/:id', element: <div>photo</div>, intercept: true },
    ],
    sidebar: [
      { path: '/dashboard/*', element: <div>side</div> },
    ],
  });

  it('matchSlot resolves a matching route with params', () => {
    const m = matchSlot(slots.modal, '/photos/42');
    expect(m).not.toBeNull();
    expect(m!.params.id).toBe('42');
    expect(m!.intercepted).toBe(true);
  });

  it('returns null when no slot route matches', () => {
    expect(matchSlot(slots.modal, '/settings')).toBeNull();
  });

  it('non-intercepting slot matches without the intercept flag', () => {
    const m = matchSlot(slots.sidebar, '/dashboard/reports');
    expect(m).not.toBeNull();
    expect(m!.intercepted).toBe(false);
  });
});
