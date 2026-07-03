import { describe, expect, it } from 'vitest';
import { eventToEdgeRequest, cfToEdgeRequest, edgeBodyToString } from '../src/index.js';

describe('adapter-aws-lambda mapping', () => {
  it('maps an API Gateway v2 event to an EdgeRequest', () => {
    const er = eventToEdgeRequest({
      rawPath: '/dashboard',
      rawQueryString: 'tab=a',
      headers: { Host: 'api.test', 'X-Y': 'z' },
      requestContext: { http: { method: 'GET' }, domainName: 'api.test' },
      cookies: ['session=abc', 'theme=dark'],
    });
    expect(er.url).toBe('https://api.test/dashboard?tab=a');
    expect(er.method).toBe('GET');
    expect(er.headers['x-y']).toBe('z');
    expect(er.headers['cookie']).toBe('session=abc; theme=dark');
  });

  it('decodes a base64 API Gateway body', () => {
    const er = eventToEdgeRequest({
      rawPath: '/',
      headers: {},
      requestContext: { http: { method: 'POST' }, domainName: 'x.test' },
      body: btoa('hello'),
      isBase64Encoded: true,
    });
    expect(er.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(er.body as Uint8Array)).toBe('hello');
  });

  it('maps a CloudFront origin-request to an EdgeRequest', () => {
    const er = cfToEdgeRequest({
      uri: '/p',
      querystring: 'x=1',
      method: 'GET',
      headers: { host: [{ key: 'Host', value: 'cf.test' }] },
    });
    expect(er.url).toBe('https://cf.test/p?x=1');
    expect(er.headers['host']).toBe('cf.test');
  });

  it('edgeBodyToString base64-encodes binary bodies', () => {
    const str = edgeBodyToString('plain');
    expect(str).toEqual({ body: 'plain', isBase64Encoded: false });
    const bin = edgeBodyToString(new Uint8Array([104, 105]));
    expect(bin.isBase64Encoded).toBe(true);
    expect(atob(bin.body)).toBe('hi');
  });
});
