/**
 * Tests for @jorvel/adapter-vercel (handler + deploy scaffold).
 *
 * Lives under libs/ssr/test because adapter packages do not ship their own
 * vitest setup. Imports the adapter via relative path.
 */

import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createVercelHandler, vercelConfig } from '../../adapter-vercel/src/index.js';
import { scaffoldDeploy } from '../../adapter-vercel/src/deploy.js';
import type { SsrRoute } from '../src/types.js';

function App() {
  return React.createElement('h1', null, 'hello');
}

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;
const ROUTES: SsrRoute[] = [{ path: '/' }, { path: '/about' }];

describe('createVercelHandler', () => {
  it('renders HTML 200 for matching route', async () => {
    const fetch = createVercelHandler({ App, template: TEMPLATE, routes: ROUTES });
    const res = await fetch(new Request('https://x/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('hello');
  });

  it('returns 404 for unmatched route', async () => {
    const fetch = createVercelHandler({ App, template: TEMPLATE, routes: ROUTES });
    const res = await fetch(new Request('https://x/missing'));
    expect(res.status).toBe(404);
  });

  it('passes request method through', async () => {
    const fetch = createVercelHandler({ App, template: TEMPLATE, routes: ROUTES });
    const res = await fetch(new Request('https://x/', { method: 'HEAD' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('lowercases header keys when forwarding', async () => {
    const fetch = createVercelHandler({
      App,
      template: TEMPLATE,
      routes: ROUTES,
      headers: { 'X-Jorvel': '1' },
    });
    const res = await fetch(new Request('https://x/'));
    expect(res.headers.get('x-jorvel')).toBe('1');
  });

  it('returns a 304 (not a 500) on a matching If-None-Match', async () => {
    // Regression: a 304 carries no body, and `new Response('', { status: 304 })`
    // throws TypeError — which turned every ETag revalidation into a 500.
    const fetch = createVercelHandler({ App, template: TEMPLATE, routes: ROUTES, etag: true });
    const first = await fetch(new Request('https://x/'));
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const revalidated = await fetch(
      new Request('https://x/', { headers: { 'If-None-Match': etag! } }),
    );
    expect(revalidated.status).toBe(304);
    expect(await revalidated.text()).toBe('');
  });
});

describe('vercelConfig', () => {
  it('exposes edge + node runtime presets', () => {
    expect(vercelConfig.edge.runtime).toBe('edge');
    expect(vercelConfig.node.runtime).toMatch(/^nodejs/);
  });
});

describe('scaffoldDeploy (vercel)', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes vercel.json into cwd', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-vercel-'));
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.files).toHaveLength(1);
    expect(r.files[0].written).toBe(true);
    const contents = await fs.readFile(path.join(dir, 'vercel.json'), 'utf8');
    expect(contents.length).toBeGreaterThan(0);
  });

  it('skips existing vercel.json', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-vercel-'));
    await fs.writeFile(path.join(dir, 'vercel.json'), '{}');
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.files[0].written).toBe(false);
  });

  it('dry-run does not write', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-vercel-'));
    const r = await scaffoldDeploy({ cwd: dir, dryRun: true });
    expect(r.files[0].written).toBe(true); // reported as would-write
    await expect(fs.access(path.join(dir, 'vercel.json'))).rejects.toThrow();
  });

  it('nextHint mentions vercel deploy', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-vercel-'));
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.nextHint).toMatch(/vercel/i);
  });
});
