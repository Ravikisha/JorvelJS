import { describe, expect, it } from 'vitest';
import {
  buildTraceparent,
  generateTraceparent,
  parseTraceparent,
  propagateTraceparent,
  type RandomSource,
} from '../src/traceparent.js';

// A deterministic RandomSource that fills bytes with an incrementing counter.
const seqRandom = (start = 1): RandomSource => {
  let n = start;
  return {
    getRandomValues(arr: Uint8Array) {
      for (let i = 0; i < arr.length; i++) arr[i] = (n++ & 0xff);
      return arr;
    },
  };
};

describe('generateTraceparent', () => {
  it('produces a spec-shaped header that round-trips through parse', () => {
    const tp = generateTraceparent({ random: seqRandom() });
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    const parsed = parseTraceparent(tp);
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe('00');
    expect(parsed!.sampled).toBe(true);
  });

  it('honors sampled:false', () => {
    const tp = generateTraceparent({ random: seqRandom(), sampled: false });
    expect(tp.endsWith('-00')).toBe(true);
    expect(parseTraceparent(tp)!.sampled).toBe(false);
  });
});

describe('parseTraceparent', () => {
  it('parses a valid header', () => {
    const parsed = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(parsed).toEqual({
      version: '00',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      parentId: '00f067aa0ba902b7',
      sampled: true,
    });
  });

  it('rejects malformed values', () => {
    expect(parseTraceparent(null)).toBeNull();
    expect(parseTraceparent('')).toBeNull();
    expect(parseTraceparent('garbage')).toBeNull();
    // wrong field count
    expect(parseTraceparent('00-abc-def')).toBeNull();
    // all-zero trace id
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
    // all-zero parent id
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
    // invalid version ff
    expect(parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
    // bad trace id length
    expect(parseTraceparent('00-4bf92f-00f067aa0ba902b7-01')).toBeNull();
  });
});

describe('buildTraceparent', () => {
  it('lowercases and serializes', () => {
    const tp = buildTraceparent({
      traceId: '4BF92F3577B34DA6A3CE929D0E0E4736',
      parentId: '00F067AA0BA902B7',
      sampled: false,
    });
    expect(tp).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
  });

  it('throws on invalid ids', () => {
    expect(() => buildTraceparent({ traceId: 'zz', parentId: '00f067aa0ba902b7' })).toThrow(/trace id/);
    expect(() =>
      buildTraceparent({ traceId: '4bf92f3577b34da6a3ce929d0e0e4736', parentId: 'nope' }),
    ).toThrow(/parent id/);
  });
});

describe('propagateTraceparent', () => {
  const VALID = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  it('forwards an existing valid traceparent from a record', () => {
    const out = propagateTraceparent({ incoming: { traceparent: VALID } });
    expect(out['traceparent']).toBe(VALID);
  });

  it('reads case-insensitively from a record', () => {
    const out = propagateTraceparent({ incoming: { TraceParent: VALID } });
    expect(out['traceparent']).toBe(VALID);
  });

  it('reads from a Headers instance', () => {
    const h = new Headers();
    h.set('traceparent', VALID);
    const out = propagateTraceparent({ incoming: h });
    expect(out['traceparent']).toBe(VALID);
  });

  it('generates a fresh traceparent when none present', () => {
    const out = propagateTraceparent({ incoming: {}, random: seqRandom() });
    expect(out['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('does not generate when generateIfMissing is false', () => {
    const out = propagateTraceparent({ incoming: {}, generateIfMissing: false });
    expect(out['traceparent']).toBeUndefined();
  });

  it('regenerates rather than forwarding an invalid inbound value', () => {
    const out = propagateTraceparent({ incoming: { traceparent: 'broken' }, random: seqRandom() });
    expect(out['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});
