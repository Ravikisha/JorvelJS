/**
 * Minimal token-based syntax highlighter.
 *
 * Hand-rolled because the registry's SSL is flaky in this environment and we
 * don't want to ship Shiki's WASM payload to every page either. Token classes
 * map onto the palette in `globals.css` (`.tk-*`).
 *
 * Supported grammars: ts, tsx, js, jsx, json, bash, html, text.
 */
import * as React from 'react';

export type Grammar = 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'bash' | 'html' | 'text';

type TokenKind =
  | 'comment'
  | 'string'
  | 'template'
  | 'number'
  | 'boolean'
  | 'keyword'
  | 'type'
  | 'builtin'
  | 'fn'
  | 'tag'
  | 'attr'
  | 'punct'
  | 'operator'
  | 'jsx-text'
  | 'plain';

interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set(
  'as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while with yield'.split(
    ' ',
  ),
);
const TYPES = new Set(
  'string number boolean any unknown never void object Promise Array Map Set ReadonlyArray Record Partial Required Pick Omit Exclude Extract Parameters ReturnType Awaited NonNullable React HTMLElement HTMLDivElement HTMLInputElement Element Node Event MouseEvent KeyboardEvent Date RegExp Error TypeError'.split(
    ' ',
  ),
);
const BUILTINS = new Set(
  'console window document globalThis process JSON Math Object Array String Number Boolean Symbol require module exports'.split(
    ' ',
  ),
);

function highlightTsLike(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const N = src.length;

  const push = (kind: TokenKind, text: string) => {
    if (text) out.push({ kind, text });
  };

  while (i < N) {
    const c = src[i]!;
    const c2 = src.slice(i, i + 2);

    // Line comment
    if (c2 === '//') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? N : end;
      push('comment', src.slice(i, stop));
      i = stop;
      continue;
    }
    // Block comment
    if (c2 === '/*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? N : end + 2;
      push('comment', src.slice(i, stop));
      i = stop;
      continue;
    }
    // Strings: ' " `
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      while (j < N) {
        const ch = src[j]!;
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === quote) {
          j++;
          break;
        }
        if (ch === '\n') break;
        j++;
      }
      push('string', src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      while (j < N) {
        const ch = src[j]!;
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === '`') {
          j++;
          break;
        }
        j++;
      }
      push('template', src.slice(i, j));
      i = j;
      continue;
    }
    // Numbers
    if (/[0-9]/.test(c)) {
      const m = /^(0[xXoObB][0-9a-fA-F_]+|[0-9_]+(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?)n?/.exec(
        src.slice(i),
      );
      if (m) {
        push('number', m[0]);
        i += m[0].length;
        continue;
      }
    }
    // Identifiers
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))!;
      const word = m[0];
      const next = src[i + word.length] ?? '';
      let kind: TokenKind = 'plain';
      if (KEYWORDS.has(word)) kind = 'keyword';
      else if (word === 'true' || word === 'false' || word === 'null' || word === 'undefined')
        kind = 'boolean';
      else if (TYPES.has(word) || /^[A-Z][A-Za-z0-9_]*$/.test(word)) kind = 'type';
      else if (BUILTINS.has(word)) kind = 'builtin';
      else if (next === '(') kind = 'fn';
      push(kind, word);
      i += word.length;
      continue;
    }
    // JSX-ish tags: simplistic — `<Foo` or `</Foo` after whitespace or start.
    if (c === '<') {
      const tagMatch = /^<\/?([A-Za-z][A-Za-z0-9.\-]*)?/.exec(src.slice(i));
      if (tagMatch && /[A-Za-z]/.test(src[i + 1] ?? '') === true) {
        // also allow </
        push('punct', tagMatch[0][0]!);
        if (tagMatch[0][1] === '/') push('punct', '/');
        const rest = tagMatch[1] ?? '';
        if (rest) push('tag', rest);
        i += tagMatch[0].length;
        continue;
      }
    }
    // Punctuation / operators
    if (/[{}()\[\];,.:?]/.test(c)) {
      push('punct', c);
      i++;
      continue;
    }
    if (/[+\-*/%=<>!&|^~]/.test(c)) {
      push('operator', c);
      i++;
      continue;
    }
    // Whitespace + everything else
    push('plain', c);
    i++;
  }
  return out;
}

function highlightJson(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const N = src.length;
  const push = (kind: TokenKind, text: string) => text && out.push({ kind, text });
  while (i < N) {
    const c = src[i]!;
    if (c === '"') {
      let j = i + 1;
      while (j < N) {
        const ch = src[j]!;
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === '"') {
          j++;
          break;
        }
        j++;
      }
      // Property names: a string immediately followed by ':' is a property.
      let k = j;
      while (k < N && /\s/.test(src[k]!)) k++;
      const isKey = src[k] === ':';
      push(isKey ? 'attr' : 'string', src.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9-]/.test(c)) {
      const m = /^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i));
      if (m) {
        push('number', m[0]);
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z_]+/.exec(src.slice(i))!;
      const w = m[0];
      push(w === 'true' || w === 'false' || w === 'null' ? 'boolean' : 'plain', w);
      i += w.length;
      continue;
    }
    if (/[{}\[\],:]/.test(c)) {
      push('punct', c);
      i++;
      continue;
    }
    push('plain', c);
    i++;
  }
  return out;
}

function highlightBash(src: string): Token[] {
  const out: Token[] = [];
  const lines = src.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    if (line.trimStart().startsWith('#')) {
      out.push({ kind: 'comment', text: line });
    } else {
      let i = 0;
      const N = line.length;
      while (i < N) {
        const c = line[i]!;
        if (c === '"' || c === "'") {
          const quote = c;
          let j = i + 1;
          while (j < N) {
            if (line[j] === '\\') {
              j += 2;
              continue;
            }
            if (line[j] === quote) {
              j++;
              break;
            }
            j++;
          }
          out.push({ kind: 'string', text: line.slice(i, j) });
          i = j;
          continue;
        }
        if (/[A-Za-z_]/.test(c)) {
          const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(line.slice(i));
          if (m) {
            const w = m[0];
            // First word of line → command (function color); flags `--foo` or `-f` → attr
            const isFirst = !line.slice(0, i).trim();
            out.push({ kind: isFirst ? 'fn' : 'plain', text: w });
            i += w.length;
            continue;
          }
        }
        if (c === '-' && /[-A-Za-z]/.test(line[i + 1] ?? '')) {
          const m = /^-{1,2}[A-Za-z][A-Za-z0-9-]*/.exec(line.slice(i));
          if (m) {
            out.push({ kind: 'attr', text: m[0] });
            i += m[0].length;
            continue;
          }
        }
        if (c === '$' && /[A-Za-z_{]/.test(line[i + 1] ?? '')) {
          const m = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/.exec(line.slice(i));
          if (m) {
            out.push({ kind: 'builtin', text: m[0] });
            i += m[0].length;
            continue;
          }
        }
        out.push({ kind: 'plain', text: c });
        i++;
      }
    }
    if (li < lines.length - 1) out.push({ kind: 'plain', text: '\n' });
  }
  return out;
}

function highlightHtml(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const N = src.length;
  while (i < N) {
    if (src.slice(i, i + 4) === '<!--') {
      const end = src.indexOf('-->', i + 4);
      const stop = end === -1 ? N : end + 3;
      out.push({ kind: 'comment', text: src.slice(i, stop) });
      i = stop;
      continue;
    }
    if (src[i] === '<') {
      const close = src.indexOf('>', i);
      const stop = close === -1 ? N : close + 1;
      const segment = src.slice(i, stop);
      // Crudely tag the whole segment, then re-tokenize attributes.
      const m = /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(segment);
      if (m) {
        out.push({ kind: 'punct', text: '<' });
        if (segment[1] === '/') out.push({ kind: 'punct', text: '/' });
        out.push({ kind: 'tag', text: m[1]! });
        let p = m[0].length;
        while (p < segment.length - 1) {
          const ch = segment[p]!;
          if (/\s/.test(ch)) {
            out.push({ kind: 'plain', text: ch });
            p++;
            continue;
          }
          if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = p + 1;
            while (j < segment.length && segment[j] !== quote) j++;
            j++;
            out.push({ kind: 'string', text: segment.slice(p, j) });
            p = j;
            continue;
          }
          if (ch === '=') {
            out.push({ kind: 'operator', text: '=' });
            p++;
            continue;
          }
          if (/[A-Za-z]/.test(ch)) {
            const am = /^[A-Za-z_:][A-Za-z0-9_:.\-]*/.exec(segment.slice(p))!;
            out.push({ kind: 'attr', text: am[0] });
            p += am[0].length;
            continue;
          }
          out.push({ kind: 'plain', text: ch });
          p++;
        }
        out.push({ kind: 'punct', text: '>' });
        i = stop;
        continue;
      }
    }
    // text outside tags
    let j = i;
    while (j < N && src[j] !== '<') j++;
    out.push({ kind: 'jsx-text', text: src.slice(i, j) });
    i = j;
  }
  return out;
}

function tokenize(code: string, grammar: Grammar): Token[] {
  switch (grammar) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return highlightTsLike(code);
    case 'json':
      return highlightJson(code);
    case 'bash':
      return highlightBash(code);
    case 'html':
      return highlightHtml(code);
    default:
      return [{ kind: 'plain', text: code }];
  }
}

const KIND_CLASS: Record<TokenKind, string> = {
  comment: 'tk-comment',
  string: 'tk-string',
  template: 'tk-string',
  number: 'tk-number',
  boolean: 'tk-bool',
  keyword: 'tk-keyword',
  type: 'tk-type',
  builtin: 'tk-builtin',
  fn: 'tk-fn',
  tag: 'tk-tag',
  attr: 'tk-attr',
  punct: 'tk-punct',
  operator: 'tk-op',
  'jsx-text': 'tk-plain',
  plain: 'tk-plain',
};

export function highlight(code: string, grammar: Grammar = 'text'): React.ReactNode {
  const tokens = tokenize(code, grammar);
  // Merge adjacent tokens with same class to keep DOM small.
  const merged: Token[] = [];
  for (const t of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.kind === t.kind) last.text += t.text;
    else merged.push({ ...t });
  }
  return merged.map((t, idx) => (
    <span key={idx} className={KIND_CLASS[t.kind]}>
      {t.text}
    </span>
  ));
}

export function languageFromString(input?: string): Grammar {
  if (!input) return 'text';
  const s = input.toLowerCase();
  if (s === 'ts' || s === 'typescript') return 'ts';
  if (s === 'tsx') return 'tsx';
  if (s === 'js' || s === 'javascript') return 'js';
  if (s === 'jsx') return 'jsx';
  if (s === 'json') return 'json';
  if (s === 'bash' || s === 'sh' || s === 'shell' || s === 'console') return 'bash';
  if (s === 'html' || s === 'xml') return 'html';
  return 'text';
}
