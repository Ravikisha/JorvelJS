// Internal base64 encoder shared by csp.ts (nonces) and sri.ts (integrity hashes).
// Avoids Buffer (absent on Workers) and large `fromCharCode(...spread)` calls.

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64Char(idx: number): string {
  // idx is always 0..63; the assertion silences noUncheckedIndexedAccess.
  return B64_ALPHABET[idx] as string;
}

export function base64FromBytes(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = bytes[i + 1] as number;
    const c = bytes[i + 2] as number;
    out +=
      b64Char(a >> 2) +
      b64Char(((a & 0x03) << 4) | (b >> 4)) +
      b64Char(((b & 0x0f) << 2) | (c >> 6)) +
      b64Char(c & 0x3f);
  }
  if (i < bytes.length) {
    const a = bytes[i] as number;
    if (i + 1 === bytes.length) {
      out += b64Char(a >> 2) + b64Char((a & 0x03) << 4) + '==';
    } else {
      const b = bytes[i + 1] as number;
      out += b64Char(a >> 2) + b64Char(((a & 0x03) << 4) | (b >> 4)) + b64Char((b & 0x0f) << 2) + '=';
    }
  }
  return out;
}
