export interface AllowlistOptions {
  /**
   * Allowed origins. Supports a single-label `*` subdomain wildcard
   * (`https://*.example.com` matches `https://api.example.com` but not
   * `https://a.b.example.com`). For multi-label, use multiple entries or `**`.
   */
  origins: string[];
  /** Allowed remote names. If unset, any name permitted as long as origin matches. */
  names?: string[];
  /**
   * Reject schemes other than `http:`/`https:`. Default true. Set false only
   * for explicit `data:` / `blob:` use cases.
   */
  httpOnly?: boolean;
}

export class RemoteAllowlist {
  private origins: Array<RegExp | string>;
  private names: Set<string> | null;
  private httpOnly: boolean;

  constructor(opts: AllowlistOptions) {
    this.origins = opts.origins.map(normalizeAndCompile);
    this.names = opts.names?.length ? new Set(opts.names) : null;
    this.httpOnly = opts.httpOnly ?? true;
  }

  isAllowed(url: string, remoteName?: string): boolean {
    // When a name allowlist is configured, an unnamed lookup cannot be verified
    // against it — reject rather than silently bypassing the name restriction.
    if (this.names && (!remoteName || !this.names.has(remoteName))) return false;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (this.httpOnly && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    return this.origins.some((m) => (typeof m === 'string' ? m === origin : m.test(origin)));
  }

  assertAllowed(url: string, remoteName?: string): void {
    if (!this.isAllowed(url, remoteName)) {
      throw new Error(
        `[jorvel/security] Remote "${remoteName ?? 'unknown'}" at "${url}" is not in the allowlist.`,
      );
    }
  }
}

function normalizeAndCompile(origin: string): RegExp | string {
  // Lowercase scheme + host so case mismatches in user config don't reject
  // valid origins (URL.host is lowercased on parse).
  const lower = origin.replace(/\/$/, '').toLowerCase();
  if (!lower.includes('*')) return lower;
  // `**` matches any number of subdomain labels (including dots); `*` matches
  // a single label. Order matters — replace `**` placeholder first.
  const placeholder = 'MULTI';
  let working = lower.replace(/\*\*/g, placeholder);
  working = working
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.]+')
    .replace(new RegExp(placeholder, 'g'), '.+');
  return new RegExp(`^${working}$`);
}
