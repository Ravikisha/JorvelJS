import { describe, expect, it } from 'vitest';
import { toEdgeRequest, toResponse, netlifyToml } from '../src/index.js';

describe('adapter-netlify mapping', () => {
  it('maps a Request to an EdgeRequest with lower-cased headers', () => {
    const req = new Request('https://x.test/dashboard?a=1', {
      method: 'POST',
      headers: { 'X-Test': 'yes', 'Content-Type': 'application/json' },
    });
    const er = toEdgeRequest(req);
    expect(er.url).toBe('https://x.test/dashboard?a=1');
    expect(er.method).toBe('POST');
    expect(er.headers['x-test']).toBe('yes');
    expect(er.headers['content-type']).toBe('application/json');
  });

  it('maps an EdgeResponse to a Response', async () => {
    const res = toResponse({ status: 201, headers: { 'x-a': '1' }, body: 'hello' });
    expect(res.status).toBe(201);
    expect(res.headers.get('x-a')).toBe('1');
    expect(await res.text()).toBe('hello');
  });

  it('uses a null body for 304 (Fetch spec)', () => {
    const res = toResponse({ status: 304, headers: {}, body: '' });
    expect(res.status).toBe(304);
    expect(res.body).toBeNull();
  });

  it('ships a netlify.toml template', () => {
    expect(netlifyToml).toContain('[[edge_functions]]');
    expect(netlifyToml).toContain('function = "ssr"');
  });
});
