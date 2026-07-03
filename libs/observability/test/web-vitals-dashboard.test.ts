import { describe, expect, it } from 'vitest';
import { createWebVitalsDashboard, rate } from '../src/index.js';

describe('web vitals dashboard', () => {
  it('rates Core Web Vitals against thresholds', () => {
    expect(rate('lcp', 2000)).toBe('good');
    expect(rate('lcp', 3000)).toBe('needs-improvement');
    expect(rate('lcp', 5000)).toBe('poor');
    expect(rate('cls', 0.05)).toBe('good');
    expect(rate('cls', 0.3)).toBe('poor');
  });

  it('aggregates p75 + rating per metric', () => {
    const d = createWebVitalsDashboard({ subscribe: false });
    for (const v of [1000, 1500, 2000, 2400, 6000]) d.record({ name: 'lcp', value: v, unit: 'ms' });
    const summary = d.getSummary();
    const lcp = summary.find((m) => m.name === 'lcp')!;
    expect(lcp.count).toBe(5);
    expect(lcp.p75).toBeGreaterThanOrEqual(2400);
    expect(['good', 'needs-improvement', 'poor']).toContain(lcp.rating);
    d.stop();
  });

  it('renders an HTML panel', () => {
    const d = createWebVitalsDashboard({ subscribe: false });
    d.record({ name: 'cls', value: 0.05 });
    const html = d.toHTML();
    expect(html).toContain('<table');
    expect(html).toMatch(/CLS/i);
    expect(html).toContain('good');
    d.stop();
  });
});
