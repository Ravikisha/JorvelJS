import { describe, expect, it } from 'vitest';
import { toEdgeRequest, toResponse, serveDeno } from '../src/index.js';

describe('adapter-deno mapping', () => {
  it('maps Request → EdgeRequest', () => {
    const er = toEdgeRequest(new Request('https://x.test/a', { headers: { 'X-Y': 'z' } }));
    expect(er.url).toBe('https://x.test/a');
    expect(er.headers['x-y']).toBe('z');
  });

  it('maps EdgeResponse → Response', async () => {
    const res = toResponse({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>hi</p>' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<p>hi</p>');
  });

  it('serveDeno throws without the Deno runtime', () => {
    expect(() => serveDeno({} as never)).toThrow(/Deno runtime/);
  });
});
