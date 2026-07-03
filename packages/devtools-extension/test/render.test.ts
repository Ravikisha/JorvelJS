import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM module, no d.ts
import { renderSnapshot, escapeHtml } from '../render.mjs';

describe('renderSnapshot', () => {
  it('shows an empty state without a runtime', () => {
    expect(renderSnapshot(null)).toContain('No JORVEL runtime');
  });

  it('renders remotes, timings, and share scope', () => {
    const html = renderSnapshot({
      version: '0.2.0',
      remotes: { dashboard: { entryUrl: 'https://cdn/remoteEntry.js', integrity: 'sha384-x', loadedAtMs: 0 } },
      shareScope: { react: {}, 'react-dom': {} },
      timings: [{ name: 'dashboard', durationMs: 42.7, ts: 0 }],
    });
    expect(html).toContain('v0.2.0');
    expect(html).toContain('dashboard');
    expect(html).toContain('remoteEntry.js');
    expect(html).toContain('43ms');
    expect(html).toContain('react');
    expect(html).toContain('✓'); // SRI present
  });

  it('escapes HTML in untrusted fields', () => {
    const html = renderSnapshot({ version: '1', remotes: { '<img>': { entryUrl: '"x' } }, timings: [], shareScope: {} });
    expect(html).not.toContain('<img>');
    expect(html).toContain('&lt;img&gt;');
    expect(escapeHtml('<a>')).toBe('&lt;a&gt;');
  });
});
