import { describe, expect, it } from 'vitest';
import {
  defineMiddleware,
  next,
  redirect,
  rewrite,
  respond,
  runMiddleware,
  type Middleware,
} from '../src/middleware.js';

describe('runMiddleware', () => {
  it('returns next when the chain is empty', async () => {
    const d = await runMiddleware([], { pathname: '/' });
    expect(d).toEqual({ type: 'next' });
  });

  it('treats a void return as next()', async () => {
    const mw: Middleware = () => {};
    const d = await runMiddleware([mw], { pathname: '/x' });
    expect(d.type).toBe('next');
  });

  it('short-circuits on the first redirect', async () => {
    let secondRan = false;
    const chain: Middleware[] = [
      () => redirect('/login'),
      () => { secondRan = true; },
    ];
    const d = await runMiddleware(chain, { pathname: '/dashboard' });
    expect(d).toEqual({ type: 'redirect', to: '/login', status: 307 });
    expect(secondRan).toBe(false);
  });

  it('honors an explicit redirect status', async () => {
    const d = await runMiddleware([() => redirect('/new', 308)], { pathname: '/old' });
    expect(d).toEqual({ type: 'redirect', to: '/new', status: 308 });
  });

  it('supports rewrite and respond decisions', async () => {
    const rw = await runMiddleware([() => rewrite('/internal')], { pathname: '/public' });
    expect(rw).toEqual({ type: 'rewrite', to: '/internal' });

    const res = new Response('ok', { status: 200 });
    const rp = await runMiddleware([() => respond(res)], { pathname: '/ping' });
    expect(rp).toEqual({ type: 'respond', response: res });
  });

  it('coalesces headers from passing middlewares', async () => {
    const d = await runMiddleware(
      [() => next({ 'x-a': '1' }), () => next({ 'x-b': '2' })],
      { pathname: '/' },
    );
    expect(d).toEqual({ type: 'next', headers: { 'x-a': '1', 'x-b': '2' } });
  });

  it('only runs middlewares whose matcher matches', async () => {
    const hit: string[] = [];
    const chain = [
      { matcher: '/admin/**', handler: defineMiddleware(() => { hit.push('admin'); }) },
      { matcher: '/public/*', handler: defineMiddleware(() => { hit.push('public'); }) },
      { handler: defineMiddleware(() => { hit.push('all'); }) },
    ];
    await runMiddleware(chain, { pathname: '/admin/users/42' });
    expect(hit).toEqual(['admin', 'all']);
  });

  it('matches a single-segment glob without crossing slashes', async () => {
    const hit: string[] = [];
    const chain = [{ matcher: '/blog/*', handler: () => { hit.push('x'); } }];
    await runMiddleware(chain, { pathname: '/blog/post' });
    await runMiddleware(chain, { pathname: '/blog/post/comments' });
    expect(hit).toEqual(['x']); // second path has two segments → no match
  });

  it('exposes searchParams and a shared state bag', async () => {
    const chain: Middleware[] = [
      (ctx) => { ctx.state.tier = ctx.searchParams.get('tier'); },
      (ctx) => (ctx.state.tier === 'pro' ? next() : redirect('/upgrade')),
    ];
    const ok = await runMiddleware(chain, {
      pathname: '/feature',
      searchParams: new URLSearchParams('tier=pro'),
    });
    expect(ok.type).toBe('next');
    const blocked = await runMiddleware(chain, {
      pathname: '/feature',
      searchParams: new URLSearchParams('tier=free'),
    });
    expect(blocked).toMatchObject({ type: 'redirect', to: '/upgrade' });
  });
});
