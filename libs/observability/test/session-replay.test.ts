import { describe, expect, it, vi } from 'vitest';
import { createSessionReplay } from '../src/index.js';

describe('createSessionReplay', () => {
  it('buffers captured events and flushes to the sink', async () => {
    const sink = vi.fn(async () => {});
    const replay = createSessionReplay({ sink, flushIntervalMs: 0 });
    replay.capture({ type: 'click', ts: 1 });
    replay.capture({ type: 'scroll', ts: 2 });
    expect(replay.buffered).toBe(2);
    await replay.flush();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(replay.buffered).toBe(0);
    replay.stop();
  });

  it('bounds the buffer with a ring (drops oldest past bufferSize)', async () => {
    const sink = vi.fn(async () => {});
    const replay = createSessionReplay({ sink, flushIntervalMs: 0, bufferSize: 3 });
    for (let i = 0; i < 10; i++) replay.capture({ type: 'click', ts: i });
    expect(replay.buffered).toBeLessThanOrEqual(3);
    replay.stop();
  });
});
