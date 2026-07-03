import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createCloudflareWorker,
  createPagesFunction,
} from '../../adapter-cloudflare/src/index.js';
import { scaffoldDeploy } from '../../adapter-cloudflare/src/deploy.js';
import type { SsrRoute } from '../src/types.js';

function App() {
  return React.createElement('h1', null, 'cf');
}

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;
const ROUTES: SsrRoute[] = [{ path: '/' }];

describe('createCloudflareWorker', () => {
  it('returns a worker with fetch method', async () => {
    const w = createCloudflareWorker({ App, template: TEMPLATE, routes: ROUTES });
    expect(typeof w.fetch).toBe('function');
    const res = await w.fetch(new Request('https://x/'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('cf');
  });

  it('404 on unmatched route', async () => {
    const w = createCloudflareWorker({ App, template: TEMPLATE, routes: ROUTES });
    const res = await w.fetch(new Request('https://x/none'));
    expect(res.status).toBe(404);
  });

  it('returns a 304 (not a 500) on a matching If-None-Match', async () => {
    // Regression: `new Response('', { status: 304 })` throws TypeError, so every
    // ETag revalidation on a Worker became a 500.
    const w = createCloudflareWorker({ App, template: TEMPLATE, routes: ROUTES, etag: true });
    const first = await w.fetch(new Request('https://x/'));
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const revalidated = await w.fetch(
      new Request('https://x/', { headers: { 'If-None-Match': etag! } }),
    );
    expect(revalidated.status).toBe(304);
    expect(await revalidated.text()).toBe('');
  });
});

describe('createPagesFunction', () => {
  it('returns an onRequest(ctx) handler', async () => {
    const onRequest = createPagesFunction({ App, template: TEMPLATE, routes: ROUTES });
    const res = await onRequest({ request: new Request('https://x/') });
    expect(res.status).toBe(200);
  });
});

describe('scaffoldDeploy (cloudflare)', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes wrangler.toml', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cf-'));
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.files[0].written).toBe(true);
    expect((await fs.readFile(path.join(dir, 'wrangler.toml'), 'utf8')).length).toBeGreaterThan(0);
  });

  it('skips when wrangler.toml present', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cf-'));
    await fs.writeFile(path.join(dir, 'wrangler.toml'), 'name = "x"');
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.files[0].written).toBe(false);
  });

  it('nextHint mentions wrangler', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cf-'));
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.nextHint).toMatch(/wrangler/i);
  });
});
