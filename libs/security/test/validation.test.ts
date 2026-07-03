import { describe, expect, it } from 'vitest';
import { v, validate, ValidationError } from '../src/index.js';

describe('validation', () => {
  it('parses a valid object', () => {
    const schema = v.object({ name: v.string(), age: v.number().optional() });
    expect(schema.parse({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
    expect(schema.parse({ name: 'Ada' })).toEqual({ name: 'Ada' });
  });

  it('throws ValidationError on wrong type', () => {
    const schema = v.object({ age: v.number() });
    expect(() => schema.parse({ age: 'nope' })).toThrow(ValidationError);
  });

  it('safeParse returns a tagged result', () => {
    const schema = v.string();
    expect(schema.safeParse('x')).toEqual({ success: true, data: 'x' });
    const bad = schema.safeParse(5);
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.issues.length).toBeGreaterThan(0);
  });

  it('validates arrays', () => {
    const schema = v.array(v.string());
    expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(() => schema.parse(['a', 1])).toThrow(ValidationError);
  });

  it('validate() helper wraps a schema', () => {
    const r = validate(v.number(), 42);
    expect(r).toEqual({ success: true, data: 42 });
  });

  it('ValidationError carries status 400 + issues', () => {
    try {
      v.object({ n: v.number() }).parse({ n: 'x' });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(400);
      expect((e as ValidationError).issues[0]?.path).toContain('n');
    }
  });
});
