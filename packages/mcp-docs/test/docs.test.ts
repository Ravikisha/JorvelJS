import { describe, expect, it, vi } from 'vitest';
import { parseLlmsTxt, listDocs, searchDocs, getDoc, htmlToText } from '../src/docs.js';

const LLMS = `# JORVEL

> Micro-frontend framework.

Docs base: https://jorveljs.vercel.app

## Get started

- [Getting started](https://jorveljs.vercel.app/docs/getting-started)
- [Tutorial](https://jorveljs.vercel.app/docs/tutorial)

## Core

- [Middleware](https://jorveljs.vercel.app/docs/middleware)
- [Loaders & actions](https://jorveljs.vercel.app/docs/actions)
`;

function fakeFetch(map: Record<string, string>) {
  return vi.fn(async (url: string) => {
    const body = map[url];
    return { ok: body !== undefined, status: body !== undefined ? 200 : 404, text: async () => body ?? '' };
  });
}

describe('parseLlmsTxt', () => {
  it('extracts section + label + url', () => {
    const links = parseLlmsTxt(LLMS);
    expect(links).toHaveLength(4);
    expect(links[0]).toEqual({ section: 'Get started', label: 'Getting started', url: 'https://jorveljs.vercel.app/docs/getting-started' });
    expect(links[2]).toMatchObject({ section: 'Core', label: 'Middleware' });
  });
});

describe('listDocs', () => {
  it('fetches + parses /llms.txt', async () => {
    const fetchImpl = fakeFetch({ 'https://jorveljs.vercel.app/llms.txt': LLMS });
    const links = await listDocs({ fetchImpl });
    expect(links).toHaveLength(4);
  });
});

describe('searchDocs', () => {
  it('ranks label matches highest', () => {
    const links = parseLlmsTxt(LLMS);
    const hits = searchDocs('middleware', links);
    expect(hits[0]!.label).toBe('Middleware');
  });
  it('returns [] on no match', () => {
    expect(searchDocs('nonexistentxyz', parseLlmsTxt(LLMS))).toEqual([]);
  });
});

describe('getDoc', () => {
  it('fetches a path and reduces HTML to text', async () => {
    const fetchImpl = fakeFetch({
      'https://jorveljs.vercel.app/docs/middleware': '<html><body><h1>Middleware</h1><p>Runs before a route.</p><script>x=1</script></body></html>',
    });
    const text = await getDoc('/docs/middleware', { fetchImpl });
    expect(text).toContain('Middleware');
    expect(text).toContain('Runs before a route.');
    expect(text).not.toContain('x=1');
  });
});

describe('htmlToText', () => {
  it('strips tags + decodes entities', () => {
    expect(htmlToText('<p>a &amp; b &lt;c&gt;</p>')).toBe('a & b <c>');
  });
});
