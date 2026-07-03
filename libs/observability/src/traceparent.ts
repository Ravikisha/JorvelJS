/**
 * W3C Trace Context helpers (https://www.w3.org/TR/trace-context/).
 *
 * Pure, dependency-free utilities for generating, parsing, building and
 * propagating the `traceparent` header so a host can stitch its trace together
 * with the remotes it loads. Randomness comes from `crypto.getRandomValues`
 * (Web Crypto, available in browsers, Node >= 19 globals, and workers) — never
 * `Math.random`, which is not suitable for trace IDs.
 *
 * traceparent format: `<version>-<trace-id>-<parent-id>-<trace-flags>`
 *   version    2 hex   (always "00" for this version of the spec)
 *   trace-id   32 hex  (16 bytes, MUST NOT be all-zero)
 *   parent-id  16 hex  (8 bytes, MUST NOT be all-zero) — a.k.a. span id
 *   trace-flags 2 hex  (bit 0 = sampled)
 */

export interface Traceparent {
  /** Spec version. Always `'00'` for the current version. */
  version: string;
  /** 32 lowercase hex chars (16 bytes). */
  traceId: string;
  /** 16 lowercase hex chars (8 bytes). The current span / parent id. */
  parentId: string;
  /** Whether the `sampled` flag (bit 0 of trace-flags) is set. */
  sampled: boolean;
}

const VERSION = '00';
const TRACE_ID_BYTES = 16;
const PARENT_ID_BYTES = 8;
const TRACE_ID_HEX = TRACE_ID_BYTES * 2;
const PARENT_ID_HEX = PARENT_ID_BYTES * 2;

const HEX_RE = /^[0-9a-f]+$/;

/** Source of randomness — overridable for deterministic tests. */
export interface RandomSource {
  /** Mirrors `crypto.getRandomValues`: fills `arr` with random bytes. */
  getRandomValues(arr: Uint8Array): Uint8Array;
}

function defaultRandom(): RandomSource {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    return { getRandomValues: (arr) => c.getRandomValues(arr) };
  }
  throw new Error(
    '[jorvel/observability] crypto.getRandomValues is unavailable; pass a `random` source to generate trace ids',
  );
}

function randomHex(bytes: number, rnd: RandomSource): string {
  const arr = new Uint8Array(bytes);
  rnd.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += (arr[i] as number).toString(16).padStart(2, '0');
  }
  return out;
}

/** True iff `hex` is `len` lowercase hex chars and not entirely zero. */
function isNonZeroHex(hex: string, len: number): boolean {
  if (hex.length !== len) return false;
  if (!HEX_RE.test(hex)) return false;
  return !/^0+$/.test(hex);
}

/**
 * Generate a brand-new, fully random traceparent (new trace + new span).
 * Sampled defaults to `true`.
 */
export function generateTraceparent(opts: { sampled?: boolean; random?: RandomSource } = {}): string {
  const rnd = opts.random ?? defaultRandom();
  return buildTraceparent({
    traceId: randomHex(TRACE_ID_BYTES, rnd),
    parentId: randomHex(PARENT_ID_BYTES, rnd),
    sampled: opts.sampled ?? true,
  });
}

/**
 * Parse a `traceparent` header value. Returns `null` for anything that does
 * not conform to the spec (wrong field count, bad lengths, all-zero ids, etc.)
 * so callers can fall back to starting a fresh trace.
 */
export function parseTraceparent(header: string | null | undefined): Traceparent | null {
  if (!header) return null;
  const parts = header.trim().split('-');
  if (parts.length !== 4) return null;
  const [version, traceId, parentId, flags] = parts as [string, string, string, string];

  // Reject the explicitly invalid version per spec; only "00" is understood.
  if (version.length !== 2 || !HEX_RE.test(version) || version === 'ff') return null;
  if (!isNonZeroHex(traceId, TRACE_ID_HEX)) return null;
  if (!isNonZeroHex(parentId, PARENT_ID_HEX)) return null;
  if (flags.length !== 2 || !HEX_RE.test(flags)) return null;

  const flagByte = parseInt(flags, 16);
  return {
    version,
    traceId,
    parentId,
    sampled: (flagByte & 0x01) === 0x01,
  };
}

/**
 * Serialize a traceparent. Validates the ids and normalizes hex to lowercase.
 * Throws on malformed ids so a bad value can't be silently propagated.
 */
export function buildTraceparent(tp: {
  traceId: string;
  parentId: string;
  sampled?: boolean;
  version?: string;
}): string {
  const traceId = tp.traceId.toLowerCase();
  const parentId = tp.parentId.toLowerCase();
  if (!isNonZeroHex(traceId, TRACE_ID_HEX)) {
    throw new Error(`[jorvel/observability] invalid trace id: ${tp.traceId}`);
  }
  if (!isNonZeroHex(parentId, PARENT_ID_HEX)) {
    throw new Error(`[jorvel/observability] invalid parent id: ${tp.parentId}`);
  }
  const version = tp.version ?? VERSION;
  const flags = tp.sampled ?? true ? '01' : '00';
  return `${version}-${traceId}-${parentId}-${flags}`;
}

/**
 * Host -> remote propagation helper.
 *
 * Reads an incoming `traceparent` (from `incoming`) and forwards it onto a new
 * headers object so a downstream remote fetch participates in the same trace.
 * When no valid incoming traceparent exists, a fresh one is generated so the
 * downstream request is still traceable.
 *
 * Accepts and returns plain header records (works with `fetch` `HeadersInit`
 * and with the WHATWG `Headers` class).
 */
export interface PropagateOptions {
  /** Existing/inbound headers to read a `traceparent` from. */
  incoming?: Headers | Record<string, string | undefined> | null;
  /** Generate a fresh traceparent if none is present. Default: true. */
  generateIfMissing?: boolean;
  /** Override randomness for generation. */
  random?: RandomSource;
  /** Default sampled flag for a freshly generated traceparent. Default: true. */
  sampled?: boolean;
}

function readHeader(
  src: Headers | Record<string, string | undefined> | null | undefined,
  name: string,
): string | null {
  if (!src) return null;
  if (typeof (src as Headers).get === 'function') {
    return (src as Headers).get(name);
  }
  const rec = src as Record<string, string | undefined>;
  // Header names are case-insensitive — check the lowercase form first, then
  // scan for any case variant.
  const direct = rec[name];
  if (direct !== undefined) return direct;
  for (const key of Object.keys(rec)) {
    if (key.toLowerCase() === name) {
      const v = rec[key];
      return v === undefined ? null : v;
    }
  }
  return null;
}

/**
 * Returns a new plain-object headers map containing a valid `traceparent` to
 * attach to an outbound request. Existing valid inbound traceparents are
 * forwarded verbatim (re-serialized in canonical form).
 */
export function propagateTraceparent(opts: PropagateOptions = {}): Record<string, string> {
  const inbound = parseTraceparent(readHeader(opts.incoming, 'traceparent'));
  const headers: Record<string, string> = {};

  if (inbound) {
    headers['traceparent'] = buildTraceparent(inbound);
    return headers;
  }
  if (opts.generateIfMissing ?? true) {
    const genOpts: { sampled?: boolean; random?: RandomSource } = {};
    if (opts.sampled !== undefined) genOpts.sampled = opts.sampled;
    if (opts.random !== undefined) genOpts.random = opts.random;
    headers['traceparent'] = generateTraceparent(genOpts);
  }
  return headers;
}
