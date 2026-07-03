/**
 * Feature: file-based routing primitives.
 */
import { describe, expect, it } from 'vitest';
import { resolveRoute, type RouteTarget } from '../../libs/runtime/dist/index.js';

const ROUTES: RouteTarget[] = [
  { path: '/', remote: 'shell', module: './Home' },
  { path: '/users', remote: 'shell', module: './Users' },
  { path: '/users/:id', remote: 'shell', module: './User' },
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
];

describe('routing', () => {
  it('matches the index route', () => {
    const r = resolveRoute(ROUTES, '/');
    expect(r?.target.remote).toBe('shell');
  });

  it('matches a dynamic param and exposes it', () => {
    const r = resolveRoute(ROUTES, '/users/42');
    expect(r?.target.remote).toBe('shell');
    expect(r?.params).toMatchObject({ id: '42' });
  });

  it('falls through to a splat route', () => {
    const r = resolveRoute(ROUTES, '/dashboard/anything/here');
    expect(r?.target.remote).toBe('dashboard');
  });

  it('returns null when no route matches', () => {
    expect(resolveRoute(ROUTES, '/no-such-path')).toBeNull();
  });

  it('exact static route wins over dynamic param', () => {
    const r = resolveRoute(ROUTES, '/users');
    expect(r?.target.module).toBe('./Users');
  });
});
