/**
 * Pure docs-access core for the JORVEL docs MCP server. No MCP SDK, no globals —
 * `fetch` is injected so this is fully unit-testable. The server (index.ts)
 * wires these into MCP tools.
 *
 * Source of truth: the docs site's `/llms.txt` (generated from the nav) lists
 * every authoritative doc URL; individual pages are fetched + reduced to text.
 */

export const DEFAULT_DOCS_BASE = 'https://jorveljs.vercel.app';

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface DocLink {
  section: string;
  label: string;
  url: string;
}

/** Parse an llms.txt body into flat doc links. */
export function parseLlmsTxt(body: string): DocLink[] {
  const links: DocLink[] = [];
  let section = 'General';
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const sec = /^##\s+(.+)$/.exec(line);
    if (sec) {
      section = sec[1]!.trim();
      continue;
    }
    const link = /^-\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line);
    if (link) {
      links.push({ section, label: link[1]!.trim(), url: link[2]!.trim() });
    }
  }
  return links;
}

export interface ListDocsOptions {
  base?: string;
  fetchImpl?: FetchLike;
}

function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  const f = fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) throw new Error('[mcp-docs] no fetch available — pass fetchImpl');
  return f;
}

/** Fetch + parse the docs index from `/llms.txt`. */
export async function listDocs(opts: ListDocsOptions = {}): Promise<DocLink[]> {
  const base = (opts.base ?? DEFAULT_DOCS_BASE).replace(/\/$/, '');
  const fetchImpl = resolveFetch(opts.fetchImpl);
  const res = await fetchImpl(`${base}/llms.txt`);
  if (!res.ok) throw new Error(`[mcp-docs] llms.txt ${res.status}`);
  return parseLlmsTxt(await res.text());
}

/** Rank doc links against a query (label + section token overlap). */
export function searchDocs(query: string, links: DocLink[], limit = 10): DocLink[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return links.slice(0, limit);
  const scored = links.map((l) => {
    const hay = `${l.label} ${l.section} ${l.url}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 1;
      if (l.label.toLowerCase().includes(t)) score += 2; // label match weighs more
    }
    return { l, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.l);
}

/** Reduce fetched HTML to readable text (strip tags/scripts/styles). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export interface GetDocOptions {
  base?: string;
  fetchImpl?: FetchLike;
  /** Max characters returned. Default 12000. */
  maxChars?: number;
}

/** Fetch a doc page (absolute URL or `/docs/...` path) as plain text. */
export async function getDoc(pathOrUrl: string, opts: GetDocOptions = {}): Promise<string> {
  const base = (opts.base ?? DEFAULT_DOCS_BASE).replace(/\/$/, '');
  const fetchImpl = resolveFetch(opts.fetchImpl);
  const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`[mcp-docs] ${url} → ${res.status}`);
  const text = htmlToText(await res.text());
  const max = opts.maxChars ?? 12000;
  return text.length > max ? text.slice(0, max) + '\n\n…(truncated)' : text;
}
