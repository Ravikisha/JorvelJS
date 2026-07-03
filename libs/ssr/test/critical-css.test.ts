import { describe, expect, it } from 'vitest';
import { extractCriticalCss, inlineCriticalCss } from '../src/critical-css.js';

const CSS = `
.hero { color: red; }
.unused { color: blue; }
#app { margin: 0; }
h1 { font-size: 2rem; }
@media (min-width: 700px) { .hero { color: green; } }
`;

const HTML = `<html><head></head><body><div id="app" class="hero"><h1>Hi</h1></div></body></html>`;

describe('critical CSS', () => {
  it('keeps used selectors, drops unused', () => {
    const { critical, rest } = extractCriticalCss(HTML, CSS);
    expect(critical).toContain('.hero');
    expect(critical).toContain('#app');
    expect(critical).toContain('h1');
    expect(rest).toContain('.unused');
    expect(critical).not.toContain('.unused');
  });

  it('keeps @media blocks (conservative)', () => {
    const { critical } = extractCriticalCss(HTML, CSS);
    expect(critical).toContain('@media');
  });

  it('inlines critical CSS into <head> and defers the full sheet', () => {
    const out = inlineCriticalCss(HTML, CSS, { href: '/assets/app.css' });
    expect(out).toContain('<style data-critical>');
    expect(out).toContain('.hero');
    expect(out).toContain("media=\"print\"");
    expect(out).toContain('<noscript>');
    expect(out.indexOf('<style')).toBeLessThan(out.indexOf('</head>'));
  });
});
