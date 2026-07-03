import { describe, expect, it } from 'vitest';
import { createBunHandler, serveBun } from '../src/index.js';

describe('adapter-bun', () => {
  it('exports a handler factory', () => {
    expect(typeof createBunHandler).toBe('function');
  });

  it('serveBun throws without the Bun runtime', () => {
    expect(() => serveBun({} as never)).toThrow(/Bun runtime/);
  });
});
