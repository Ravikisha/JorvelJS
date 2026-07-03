import { describe, expect, it } from 'vitest';
import { resolveJorvelBin } from '../src/index.js';

describe('create-jorvel', () => {
  it('resolves the jorvel CLI bin path from the jorvel dependency', () => {
    const bin = resolveJorvelBin();
    // jorvel links to packages/cli; its bin is dist/index.js.
    expect(bin).toMatch(/index\.js$/);
    expect(bin).toMatch(/[\\/]dist[\\/]/);
  });
});
