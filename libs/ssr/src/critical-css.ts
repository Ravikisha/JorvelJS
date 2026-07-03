/**
 * @jorvel/ssr — best-effort critical-CSS inliner.
 *
 * Given rendered HTML + a stylesheet, keep only the rules whose selectors
 * reference a class / id / tag actually present in the HTML, inline those into
 * `<head>`, and (optionally) defer the full sheet. Pure string work — edge-safe,
 * no DOM, no PostCSS. A heuristic, not a full CSS parser: it handles the common
 * `.class`, `#id`, `tag`, and comma-lists; it deliberately keeps `@media` /
 * `@keyframes` / `:root` blocks (cheap + usually needed above the fold).
 */

export interface CriticalCssResult {
  /** The rules kept as critical (joined CSS). */
  critical: string;
  /** Rules dropped (not referenced in the HTML). */
  rest: string;
}

function collectTokens(html: string): { classes: Set<string>; ids: Set<string>; tags: Set<string> } {
  const classes = new Set<string>();
  const ids = new Set<string>();
  const tags = new Set<string>();
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1]!.split(/\s+/)) if (c) classes.add(c);
  }
  for (const m of html.matchAll(/id="([^"]*)"/g)) if (m[1]) ids.add(m[1]);
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)) tags.add(m[1]!.toLowerCase());
  return { classes, ids, tags };
}

function selectorUsed(
  selector: string,
  tok: { classes: Set<string>; ids: Set<string>; tags: Set<string> },
): boolean {
  // Split comma-lists; a rule is kept if ANY of its selectors is used.
  return selector.split(',').some((sel) => {
    const s = sel.trim();
    if (!s) return false;
    // Always keep pseudo/root/universal safety nets.
    if (s.startsWith(':root') || s === '*' || s.startsWith('html') || s.startsWith('body')) return true;
    const cls = [...s.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!);
    const ids = [...s.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!);
    const tags = [...s.matchAll(/(?:^|[\s>+~])([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1]!.toLowerCase());
    if (cls.length && cls.every((c) => tok.classes.has(c))) return true;
    if (ids.length && ids.every((i) => tok.ids.has(i))) return true;
    if (!cls.length && !ids.length && tags.length && tags.every((t) => tok.tags.has(t))) return true;
    return false;
  });
}

/** Split CSS into critical (used) + rest, based on selectors present in `html`. */
export function extractCriticalCss(html: string, css: string): CriticalCssResult {
  const tok = collectTokens(html);
  const critical: string[] = [];
  const rest: string[] = [];

  // Walk top-level blocks. At-rules (@media/@keyframes/@font-face) are kept
  // whole as critical (conservative). Plain rules are filtered by selector.
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i]!)) i++;
    if (i >= n) break;
    if (css[i] === '@') {
      // Consume the entire at-rule (balanced braces, or until ';' for @import).
      const start = i;
      const braceIdx = css.indexOf('{', i);
      const semiIdx = css.indexOf(';', i);
      if (braceIdx === -1 || (semiIdx !== -1 && semiIdx < braceIdx)) {
        i = semiIdx === -1 ? n : semiIdx + 1;
      } else {
        let depth = 0;
        let j = braceIdx;
        for (; j < n; j++) {
          if (css[j] === '{') depth++;
          else if (css[j] === '}' && --depth === 0) { j++; break; }
        }
        i = j;
      }
      critical.push(css.slice(start, i).trim());
      continue;
    }
    // Plain rule: `selector { ... }`.
    const braceIdx = css.indexOf('{', i);
    if (braceIdx === -1) break;
    const selector = css.slice(i, braceIdx).trim();
    const end = css.indexOf('}', braceIdx);
    const block = css.slice(i, end === -1 ? n : end + 1).trim();
    (selectorUsed(selector, tok) ? critical : rest).push(block);
    i = end === -1 ? n : end + 1;
  }

  return { critical: critical.join('\n'), rest: rest.join('\n') };
}

export interface InlineCriticalOptions {
  /** URL of the full stylesheet to defer-load after paint. */
  href?: string;
}

/**
 * Inline critical CSS into `<head>` and, when `href` is given, defer the full
 * sheet with a `media=print → onload` swap. Returns the modified HTML.
 */
export function inlineCriticalCss(html: string, css: string, opts: InlineCriticalOptions = {}): string {
  const { critical } = extractCriticalCss(html, css);
  const tags = [`<style data-critical>${critical}</style>`];
  if (opts.href) {
    tags.push(
      `<link rel="stylesheet" href="${opts.href}" media="print" onload="this.media='all'">` +
        `<noscript><link rel="stylesheet" href="${opts.href}"></noscript>`,
    );
  }
  const inject = tags.join('');
  return html.includes('</head>') ? html.replace('</head>', `${inject}</head>`) : inject + html;
}
