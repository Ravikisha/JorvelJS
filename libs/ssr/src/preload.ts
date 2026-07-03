import { escapeHtml } from '@jorvel/security';

export interface PreloadLink {
  href: string;
  as?: 'script' | 'style' | 'font' | 'image' | 'fetch';
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;
  rel?: 'preload' | 'modulepreload' | 'prefetch';
  type?: string;
}

export function buildPreloadTags(links: PreloadLink[]): string {
  return links.map(linkTag).join('\n');
}

function linkTag(l: PreloadLink): string {
  const rel = l.rel ?? (l.as === 'script' ? 'modulepreload' : 'preload');
  const attrs: string[] = [`rel="${escapeHtml(rel)}"`, `href="${escapeHtml(l.href)}"`];
  if (l.as && rel !== 'modulepreload') attrs.push(`as="${escapeHtml(l.as)}"`);
  if (l.crossorigin) attrs.push(`crossorigin="${escapeHtml(l.crossorigin)}"`);
  if (l.integrity) attrs.push(`integrity="${escapeHtml(l.integrity)}"`);
  if (l.type) attrs.push(`type="${escapeHtml(l.type)}"`);
  return `<link ${attrs.join(' ')}>`;
}

export interface RemoteEntryPreloadOptions {
  /**
   * Module format of the remote container.
   * - 'classic' (default) — `<link rel="preload" as="script">`. Matches the
   *   default Module Federation container, which is a classic global script.
   * - 'esm' — `<link rel="modulepreload">`. Use only when remotes ship as ESM
   *   containers (Module Federation 2 with `library.type: 'module'`).
   */
  format?: 'classic' | 'esm';
}

export function remoteEntryPreloads(
  remotes: Array<{ name: string; entryUrl: string; integrity?: string }>,
  opts: RemoteEntryPreloadOptions = {},
): PreloadLink[] {
  const isEsm = opts.format === 'esm';
  return remotes.map((r) => {
    const link: PreloadLink = {
      href: r.entryUrl,
      rel: isEsm ? 'modulepreload' : 'preload',
      crossorigin: 'anonymous',
    };
    if (!isEsm) link.as = 'script';
    if (r.integrity) link.integrity = r.integrity;
    return link;
  });
}
