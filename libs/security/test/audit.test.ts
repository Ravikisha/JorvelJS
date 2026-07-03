import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLogger, bufferSink } from '../src/audit.js';

const T0 = Date.UTC(2030, 0, 1, 0, 0, 0);

afterEach(() => vi.restoreAllMocks());

describe('AuditLogger', () => {
  it('emits an entry with time + ISO timestamp + outcome', async () => {
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({ sinks: [sink], now: () => T0 });
    await log.success({
      actor: 'u1',
      action: 'user.login',
      resource: { type: 'user', id: 'u1' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      time: T0,
      timeIso: '2030-01-01T00:00:00.000Z',
      outcome: 'success',
      actor: 'u1',
      action: 'user.login',
      resource: { type: 'user', id: 'u1' },
    });
  });

  it('failure / denied helpers set outcome accordingly', async () => {
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({ sinks: [sink], now: () => T0 });
    await log.failure({ actor: 'u1', action: 'user.login', resource: { type: 'user' }, reason: 'bad pw' });
    await log.denied({ actor: 'u1', action: 'org.delete', resource: { type: 'org', id: 'o1' } });
    expect(entries[0]!.outcome).toBe('failure');
    expect(entries[0]!.reason).toBe('bad pw');
    expect(entries[1]!.outcome).toBe('denied');
  });

  it('redacts default-sensitive keys in metadata', async () => {
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({ sinks: [sink], now: () => T0 });
    await log.success({
      actor: 'u1',
      action: 'session.create',
      resource: { type: 'session' },
      metadata: {
        ip: '1.2.3.4',
        token: 'tk-secret',
        password: 'hunter2',
        nested: { authorization: 'Bearer abc' },
      },
    });
    const m = entries[0]!.metadata as Record<string, unknown>;
    expect(m.token).toBe('[REDACTED]');
    expect(m.password).toBe('[REDACTED]');
    expect((m.nested as Record<string, unknown>).authorization).toBe('[REDACTED]');
    expect(m.ip).toBe('1.2.3.4'); // not in default redact set
  });

  it('redacts the mixed-case apiKey default key', async () => {
    // Regression: DEFAULT_REDACT held 'apiKey' but lookup lowercases the key, so
    // apiKey/ApiKey/APIKEY were never redacted despite being an advertised default.
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({ sinks: [sink], now: () => T0 });
    await log.success({
      actor: 'u1',
      action: 'integration.connect',
      resource: { type: 'integration' },
      metadata: { apiKey: 'sk-live-123', ApiKey: 'x', APIKEY: 'y', api_key: 'z' },
    });
    const m = entries[0]!.metadata as Record<string, unknown>;
    expect(m.apiKey).toBe('[REDACTED]');
    expect(m.ApiKey).toBe('[REDACTED]');
    expect(m.APIKEY).toBe('[REDACTED]');
    expect(m.api_key).toBe('[REDACTED]');
  });

  it('redactKeys + redactionValue customize scrubbing', async () => {
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({
      sinks: [sink],
      now: () => T0,
      redactKeys: ['ssn'],
      redactionValue: '***',
    });
    await log.success({
      actor: 'u1',
      action: 'kyc.submit',
      resource: { type: 'user', id: 'u1' },
      metadata: { ssn: '111-22-3333', token: 'x' },
    });
    const m = entries[0]!.metadata as Record<string, unknown>;
    expect(m.ssn).toBe('***');
    expect(m.token).toBe('***');
  });

  it('scrubs arrays of objects', async () => {
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({ sinks: [sink], now: () => T0 });
    await log.success({
      actor: 'u1',
      action: 'batch',
      resource: { type: 'batch' },
      metadata: { items: [{ token: 'a' }, { token: 'b' }] },
    });
    const items = (entries[0]!.metadata as { items: Array<Record<string, unknown>> }).items;
    expect(items.every((i) => i.token === '[REDACTED]')).toBe(true);
  });

  it('per-sink throws do not break the caller or other sinks', async () => {
    const bad = vi.fn(() => {
      throw new Error('sink down');
    });
    const { sink, entries } = bufferSink();
    const log = new AuditLogger({ sinks: [bad, sink], now: () => T0 });
    const entry = await log.success({ actor: 'u1', action: 'noop', resource: { type: 'x' } });
    expect(entry.timeIso).toBe('2030-01-01T00:00:00.000Z');
    expect(entries).toHaveLength(1);
  });

  it('default sink writes JSON to console.log when no sinks supplied', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = new AuditLogger({ now: () => T0 });
    await log.success({ actor: 'u1', action: 'noop', resource: { type: 'x' } });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(() => JSON.parse(spy.mock.calls[0]![0] as string)).not.toThrow();
  });

  it('returns the post-redaction entry from log()', async () => {
    const log = new AuditLogger({ sinks: [() => {}], now: () => T0 });
    const entry = await log.success({
      actor: 'u1',
      action: 'x',
      resource: { type: 'y' },
      metadata: { token: 'visible-source' },
    });
    expect((entry.metadata as { token: unknown }).token).toBe('[REDACTED]');
  });
});
