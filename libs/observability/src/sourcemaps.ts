/**
 * Sentry source map uploader.
 *
 * Scans a `dist` directory for `.map` files and uploads each to a Sentry
 * release's "files" API via `fetch`. The filesystem and `fetch` are injectable
 * so this runs (and is tested) without touching Node's `fs` or the network.
 *
 * This is intentionally a thin helper — for large/complex pipelines use
 * `sentry-cli`. Here we cover the common case: "ship the maps for a release".
 *
 * Sentry release files API:
 *   POST {url}/api/0/organizations/{org}/releases/{release}/files/
 *   Authorization: Bearer {authToken}
 *   multipart/form-data: file=<contents>, name=~/<path>
 */

export type SourcemapFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
) => Promise<{ ok: boolean; status: number }>;

/** Injectable filesystem seam. All paths use forward slashes internally. */
export interface SourcemapFs {
  /** Recursively list file paths under `dir` (relative or absolute). */
  readDir(dir: string): Promise<string[]> | string[];
  /** Read a file's text contents. */
  readFile(path: string): Promise<string> | string;
}

export interface UploadSourcemapsOptions {
  /** Directory to scan for `.map` files. */
  distDir: string;
  /** Sentry org slug. */
  org: string;
  /** Sentry project slug (recorded for reporting; not part of the URL). */
  project?: string;
  /** Release identifier the maps belong to. */
  release: string;
  /** Sentry auth token (Bearer). */
  authToken: string;
  /** Sentry API base. Default: `https://sentry.io`. */
  url?: string;
  /**
   * URL prefix recorded for each uploaded artifact (the `name` field). Sentry
   * convention is `~/` meaning "host-relative". Default: `'~/'`.
   */
  urlPrefix?: string;
  /** Inject `fetch` (defaults to global `fetch`). */
  fetch?: SourcemapFetch;
  /** Inject the filesystem reader (required — no default Node `fs` import). */
  fs: SourcemapFs;
  /** Called per-file on failure. Default: collect into the result. */
  onError?: (file: string, err: unknown) => void;
}

export interface UploadSourcemapsResult {
  /** Artifact names (URLs) successfully uploaded. */
  uploaded: string[];
  /** `.map` files discovered in `distDir`. */
  found: string[];
  /** Per-file failures. */
  failed: Array<{ file: string; error: unknown }>;
}

function resolveFetch(injected: SourcemapFetch | undefined): SourcemapFetch {
  if (injected) return injected;
  const f = (globalThis as { fetch?: SourcemapFetch }).fetch;
  if (typeof f === 'function') return f;
  throw new Error('[jorvel/observability] no fetch available; pass `fetch` to uploadSourcemaps');
}

/** Join two path-ish segments with a single forward slash. */
function joinUrl(prefix: string, file: string): string {
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const f = file.replace(/^\.?\//, '');
  return `${p}${f}`;
}

/**
 * Scan `distDir` for `*.map` files and upload them to a Sentry release.
 * Resolves to a summary; never throws for individual file failures (those go
 * into `result.failed` and `onError`). Throws only for unrecoverable setup
 * problems (missing fetch).
 */
export async function uploadSourcemaps(opts: UploadSourcemapsOptions): Promise<UploadSourcemapsResult> {
  const fetchImpl = resolveFetch(opts.fetch);
  const base = (opts.url ?? 'https://sentry.io').replace(/\/$/, '');
  const urlPrefix = opts.urlPrefix ?? '~/';
  const endpoint = `${base}/api/0/organizations/${encodeURIComponent(opts.org)}/releases/${encodeURIComponent(
    opts.release,
  )}/files/`;

  const entries = await opts.fs.readDir(opts.distDir);
  const found = entries.filter((p) => p.endsWith('.map')).sort();

  const result: UploadSourcemapsResult = { uploaded: [], found, failed: [] };

  for (const file of found) {
    try {
      const contents = await opts.fs.readFile(file);
      // Derive the artifact name from the path relative to distDir.
      const rel = relativeTo(opts.distDir, file);
      const name = joinUrl(urlPrefix, rel);

      const form = new FormData();
      form.append('name', name);
      form.append('file', new Blob([contents], { type: 'application/json' }), basename(rel));

      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.authToken}` },
        body: form,
      });

      if (res.ok) {
        result.uploaded.push(name);
      } else {
        const err = new Error(`Sentry upload failed (${res.status}) for ${name}`);
        result.failed.push({ file, error: err });
        opts.onError?.(file, err);
      }
    } catch (err) {
      result.failed.push({ file, error: err });
      opts.onError?.(file, err);
    }
  }

  return result;
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

function relativeTo(dir: string, file: string): string {
  const d = normalize(dir).replace(/\/$/, '');
  const f = normalize(file);
  if (f.startsWith(`${d}/`)) return f.slice(d.length + 1);
  return f;
}

function basename(p: string): string {
  const norm = normalize(p);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.slice(idx + 1);
}
