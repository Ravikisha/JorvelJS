/**
 * Dependency-free `multipart/form-data` parser for file uploads.
 *
 * Browsers/edge runtimes expose `Request.formData()`, but it's not universally
 * available (and gives `File` objects, not raw bytes). This parser works on a
 * raw body + content-type, returning plain string fields and file parts as
 * `Uint8Array` — runtime-agnostic, zero-dependency, byte-exact.
 *
 * Robust to CRLF line endings and the trailing `--boundary--` terminator. Parts
 * without a `filename` are treated as fields; parts with one are files.
 */

export interface MultipartFile {
  /** The form field name. */
  name: string;
  /** The client-supplied filename. */
  filename: string;
  /** The part's `Content-Type`, or `application/octet-stream` if absent. */
  contentType: string;
  /** Raw file bytes. */
  data: Uint8Array;
}

export interface MultipartResult {
  /** Non-file parts, decoded as UTF-8 text. */
  fields: Record<string, string>;
  /** File parts (those with a `filename`). */
  files: MultipartFile[];
}

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

function toUint8(body: Uint8Array | ArrayBuffer): Uint8Array {
  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

/** Extract the `boundary` token from a `multipart/form-data` content-type. */
export function parseBoundary(contentType: string): string | null {
  // boundary=... optionally quoted; stop at ; or whitespace for the unquoted form.
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const raw = m?.[1] ?? m?.[2];
  return raw ? raw.trim() : null;
}

/** Find the next occurrence of `needle` in `hay` at or after `from`, else -1. */
function indexOf(hay: Uint8Array, needle: Uint8Array, from: number): number {
  if (needle.length === 0) return -1;
  const last = hay.length - needle.length;
  const first = needle[0] as number;
  outer: for (let i = from; i <= last; i++) {
    if (hay[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

interface ParsedHeaders {
  name?: string;
  filename?: string;
  contentType?: string;
}

function parseHeaders(block: string): ParsedHeaders {
  const out: ParsedHeaders = {};
  for (const line of block.split('\r\n')) {
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'content-disposition') {
      const name = /;\s*name="?([^"\r\n;]*)"?/i.exec(value);
      const filename = /;\s*filename="?([^"\r\n;]*)"?/i.exec(value);
      if (name?.[1] != null) out.name = name[1];
      if (filename?.[1] != null) out.filename = filename[1];
    } else if (key === 'content-type') {
      out.contentType = value;
    }
  }
  return out;
}

/**
 * Parse a raw `multipart/form-data` body. Throws `Error` if no boundary can be
 * read from `contentType`.
 */
export function parseMultipart(
  body: Uint8Array | ArrayBuffer,
  contentType: string,
): MultipartResult {
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    throw new Error('[jorvel/security] parseMultipart: no boundary in content-type');
  }

  const bytes = toUint8(body);
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  const delimiter = ENCODER.encode(`--${boundary}`);
  const CRLF = ENCODER.encode('\r\n');
  const HEADER_END = ENCODER.encode('\r\n\r\n');

  // Walk delimiter-to-delimiter.
  let pos = indexOf(bytes, delimiter, 0);
  if (pos < 0) return { fields, files };

  while (pos >= 0 && pos < bytes.length) {
    let start = pos + delimiter.length;
    // Trailing terminator: `--boundary--` → done.
    if (bytes[start] === 0x2d && bytes[start + 1] === 0x2d) break;
    // Skip the CRLF after the delimiter.
    if (bytes[start] === 0x0d && bytes[start + 1] === 0x0a) start += 2;

    const headerEnd = indexOf(bytes, HEADER_END, start);
    if (headerEnd < 0) break;

    const headerText = DECODER.decode(bytes.subarray(start, headerEnd));
    const headers = parseHeaders(headerText);
    const dataStart = headerEnd + HEADER_END.length;

    // The part body runs up to the CRLF that precedes the next delimiter.
    const nextDelim = indexOf(bytes, delimiter, dataStart);
    if (nextDelim < 0) break;
    let dataEnd = nextDelim;
    // Strip the CRLF separating the body from the next delimiter.
    if (
      dataEnd >= CRLF.length &&
      bytes[dataEnd - 2] === 0x0d &&
      bytes[dataEnd - 1] === 0x0a
    ) {
      dataEnd -= 2;
    }

    const data = bytes.slice(dataStart, dataEnd);

    if (headers.filename != null && headers.filename !== '') {
      files.push({
        name: headers.name ?? '',
        filename: headers.filename,
        contentType: headers.contentType ?? 'application/octet-stream',
        data,
      });
    } else if (headers.name != null) {
      fields[headers.name] = DECODER.decode(data);
    }

    pos = nextDelim;
  }

  return { fields, files };
}

/**
 * Convenience: parse a `Request` whose body is `multipart/form-data` by reading
 * its `arrayBuffer()` and `Content-Type` header.
 */
export async function parseMultipartRequest(req: Request): Promise<MultipartResult> {
  const contentType = req.headers.get('content-type') ?? '';
  const buf = await req.arrayBuffer();
  return parseMultipart(buf, contentType);
}
