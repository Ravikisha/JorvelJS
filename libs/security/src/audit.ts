/**
 * Structured audit logger.
 *
 * Captures auth/admin events for compliance trails. Each entry has a stable
 * shape (timestamp, actor, action, resource, outcome) and pluggable sinks.
 * PII fields can be redacted before they leave the process via a `redactKeys`
 * list — handy when piping into shared logging infra.
 */

export interface AuditEntry {
  /** Unix milliseconds. */
  time: number;
  /** ISO-8601 string of `time`. Set automatically. */
  timeIso: string;
  /** Who acted. Free-form id (user id, service account, etc.). */
  actor: string;
  /** What they did. Recommended verb form: `user.login`, `org.invite.create`. */
  action: string;
  /** Object acted on. */
  resource: { type: string; id?: string };
  /** Result of the action. */
  outcome: 'success' | 'failure' | 'denied';
  /** Optional reason — typically populated on `failure` / `denied`. */
  reason?: string;
  /** Optional caller IP — usually `x-forwarded-for`. */
  ip?: string;
  /** Optional request id for correlation with traces. */
  requestId?: string;
  /** Optional arbitrary structured metadata. Redaction applies before emit. */
  metadata?: Record<string, unknown>;
}

export type AuditSink = (entry: AuditEntry) => void | Promise<void>;

export interface AuditLoggerOptions {
  /** One or more sinks. Default: a single console-JSON sink. */
  sinks?: AuditSink[];
  /** Field names anywhere in `metadata` to scrub before emit. Default redacts `password`, `token`, `secret`, `apiKey`. */
  redactKeys?: string[];
  /** Replacement value for redacted fields. Default: `'[REDACTED]'`. */
  redactionValue?: string;
  /** Time source — used to make tests deterministic. */
  now?: () => number;
}

// All entries MUST be lowercase: lookups go through `k.toLowerCase()`, so a
// mixed-case key here (the old `'apiKey'`) would never match and silently leak.
const DEFAULT_REDACT = new Set([
  'password',
  'pass',
  'pwd',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'set-cookie',
]);

const consoleJsonSink: AuditSink = (entry) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
};

export class AuditLogger {
  private readonly sinks: AuditSink[];
  private readonly redact: Set<string>;
  private readonly redactionValue: string;
  private readonly now: () => number;

  constructor(opts: AuditLoggerOptions = {}) {
    this.sinks = opts.sinks?.length ? opts.sinks : [consoleJsonSink];
    const extra = opts.redactKeys ?? [];
    this.redact = new Set([...DEFAULT_REDACT, ...extra.map((k) => k.toLowerCase())]);
    this.redactionValue = opts.redactionValue ?? '[REDACTED]';
    this.now = opts.now ?? Date.now;
  }

  /** Emit a structured audit entry. Returns the entry that was emitted (post-redaction). */
  async log(input: Omit<AuditEntry, 'time' | 'timeIso'>): Promise<AuditEntry> {
    const time = this.now();
    const entry: AuditEntry = {
      ...input,
      time,
      timeIso: new Date(time).toISOString(),
      ...(input.metadata ? { metadata: this.scrub(input.metadata) as Record<string, unknown> } : {}),
    };
    for (const sink of this.sinks) {
      try {
        await sink(entry);
      } catch {
        /* sinks must never break the caller; swallow per-sink failures */
      }
    }
    return entry;
  }

  /** Convenience: success outcome. */
  success(input: Omit<AuditEntry, 'time' | 'timeIso' | 'outcome'>): Promise<AuditEntry> {
    return this.log({ ...input, outcome: 'success' });
  }

  /** Convenience: failure outcome with reason. */
  failure(input: Omit<AuditEntry, 'time' | 'timeIso' | 'outcome'>): Promise<AuditEntry> {
    return this.log({ ...input, outcome: 'failure' });
  }

  /** Convenience: denied outcome (authz refusal). */
  denied(input: Omit<AuditEntry, 'time' | 'timeIso' | 'outcome'>): Promise<AuditEntry> {
    return this.log({ ...input, outcome: 'denied' });
  }

  private scrub(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => this.scrub(v));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (this.redact.has(k.toLowerCase())) {
        out[k] = this.redactionValue;
        continue;
      }
      out[k] = this.scrub(v);
    }
    return out;
  }
}

/** Build a sink that appends NDJSON to an in-memory buffer (for tests). */
export function bufferSink(): { sink: AuditSink; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return { sink: (e) => void entries.push(e), entries };
}
