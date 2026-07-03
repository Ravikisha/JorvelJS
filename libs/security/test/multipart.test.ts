import { describe, expect, it } from 'vitest';
import { parseBoundary, parseMultipart } from '../src/index.js';

const CT = 'multipart/form-data; boundary=----test';

function buildBody(): Uint8Array {
  const parts = [
    '------test',
    'Content-Disposition: form-data; name="title"',
    '',
    'Hello',
    '------test',
    'Content-Disposition: form-data; name="file"; filename="a.txt"',
    'Content-Type: text/plain',
    '',
    'file-contents',
    '------test--',
    '',
  ];
  return new TextEncoder().encode(parts.join('\r\n'));
}

describe('multipart', () => {
  it('extracts the boundary token', () => {
    expect(parseBoundary(CT)).toBe('----test');
    expect(parseBoundary('multipart/form-data; boundary="q u o t e d"')).toBe('q u o t e d');
    expect(parseBoundary('application/json')).toBeNull();
  });

  it('parses fields and files', () => {
    const res = parseMultipart(buildBody(), CT);
    expect(res.fields.title).toBe('Hello');
    expect(res.files).toHaveLength(1);
    const f = res.files[0]!;
    expect(f.name).toBe('file');
    expect(f.filename).toBe('a.txt');
    expect(f.contentType).toBe('text/plain');
    expect(new TextDecoder().decode(f.data)).toBe('file-contents');
  });

  it('throws without a boundary', () => {
    expect(() => parseMultipart(new Uint8Array(), 'application/json')).toThrow();
  });
});
