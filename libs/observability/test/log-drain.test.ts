import { describe, expect, it, vi } from 'vitest';
import { datadogDrain, logtailDrain, httpDrain } from '../src/index.js';
import type { LogEntry } from '../src/logger.js';

const entry = (msg: string): LogEntry => ({ time: '2026-01-01T00:00:00Z', level: 'info', msg });

describe('log drains', () => {
  it('batches and flushes at batchSize', async () => {
    const fetchLike = vi.fn(async () => ({ ok: true, status: 202 }));
    const drain = httpDrain({ endpoint: 'https://logs.test', fetch: fetchLike, batchSize: 3 });
    drain.log(entry('a'));
    drain.log(entry('b'));
    expect(drain.pending).toBe(2);
    expect(fetchLike).not.toHaveBeenCalled();
    drain.log(entry('c')); // hits batchSize → auto-flush
    await Promise.resolve();
    expect(fetchLike).toHaveBeenCalledTimes(1);
    expect(drain.pending).toBe(0);
  });

  it('datadog posts to the intake with the API key header', async () => {
    const fetchLike = vi.fn(async () => ({ ok: true, status: 202 }));
    const drain = datadogDrain({ apiKey: 'dd-key', fetch: fetchLike });
    drain.log(entry('hi'));
    await drain.flush();
    const [url, init] = fetchLike.mock.calls[0]!;
    expect(String(url)).toContain('http-intake.logs.datadoghq.com');
    expect((init as RequestInit).headers).toMatchObject({ 'DD-API-KEY': 'dd-key' });
  });

  it('logtail posts with a bearer token', async () => {
    const fetchLike = vi.fn(async () => ({ ok: true, status: 202 }));
    const drain = logtailDrain({ token: 'tok', fetch: fetchLike });
    drain.log(entry('x'));
    await drain.flush();
    const [, init] = fetchLike.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer tok' });
  });

  it('flush is a no-op when empty', async () => {
    const fetchLike = vi.fn(async () => ({ ok: true, status: 202 }));
    await httpDrain({ endpoint: 'https://x', fetch: fetchLike }).flush();
    expect(fetchLike).not.toHaveBeenCalled();
  });
});
