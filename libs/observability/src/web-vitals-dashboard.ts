/**
 * @jorvel/observability — Web Vitals dashboard aggregator.
 *
 * Subscribes to reported metrics (`onMetric`), keeps per-metric samples, and
 * computes a p75 + Core-Web-Vitals rating (good / needs-improvement / poor).
 * Framework-agnostic: consume `getSummary()` from any UI, or render the built-in
 * `toHTML()` string into a dashboard panel. No React dependency.
 */

import { onMetric, type MetricEvent } from './hooks.js';

export type Rating = 'good' | 'needs-improvement' | 'poor';

/** Core Web Vitals thresholds [good ≤, needs-improvement ≤] (ms, or unitless for CLS). */
const THRESHOLDS: Record<string, [number, number]> = {
  lcp: [2500, 4000],
  fid: [100, 300],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

export function rate(metric: string, value: number): Rating {
  const t = THRESHOLDS[metric.toLowerCase()];
  if (!t) return 'good';
  if (value <= t[0]) return 'good';
  if (value <= t[1]) return 'needs-improvement';
  return 'poor';
}

export interface MetricSummary {
  name: string;
  count: number;
  p75: number;
  latest: number;
  rating: Rating;
  unit?: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export interface WebVitalsDashboard {
  /** Feed a metric in manually (also wired to `onMetric` automatically). */
  record(m: MetricEvent): void;
  /** Per-metric summaries, sorted by name. */
  getSummary(): MetricSummary[];
  /** Render an HTML fragment (inline styles, no deps) for a dashboard panel. */
  toHTML(): string;
  /** Stop listening to `onMetric`. */
  stop(): void;
  reset(): void;
}

export interface WebVitalsDashboardOptions {
  /** Max samples kept per metric (ring). Default 500. */
  maxSamples?: number;
  /** Auto-subscribe to `onMetric`. Default true. */
  subscribe?: boolean;
}

export function createWebVitalsDashboard(opts: WebVitalsDashboardOptions = {}): WebVitalsDashboard {
  const maxSamples = opts.maxSamples ?? 500;
  interface Sample { values: number[]; latest: number; unit?: string }
  const samples = new Map<string, Sample>();

  const record = (m: MetricEvent) => {
    const key = m.name.toLowerCase();
    let s = samples.get(key);
    if (!s) { s = { values: [], latest: m.value }; samples.set(key, s); }
    s.values.push(m.value);
    if (s.values.length > maxSamples) s.values.shift();
    s.latest = m.value;
    if (m.unit) s.unit = m.unit;
  };

  const unsub = opts.subscribe === false ? () => {} : onMetric(record);

  const getSummary = (): MetricSummary[] =>
    [...samples.entries()]
      .map(([name, s]) => {
        const sorted = [...s.values].sort((a, b) => a - b);
        const p75 = percentile(sorted, 75);
        return {
          name,
          count: s.values.length,
          p75,
          latest: s.latest,
          rating: rate(name, p75),
          ...(s.unit ? { unit: s.unit } : {}),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  const COLOR: Record<Rating, string> = {
    good: '#16a34a',
    'needs-improvement': '#d97706',
    poor: '#dc2626',
  };

  const toHTML = (): string => {
    const rows = getSummary()
      .map(
        (m) =>
          `<tr><td style="text-transform:uppercase">${m.name}</td>` +
          `<td>${m.p75.toFixed(m.name === 'cls' ? 3 : 0)}${m.unit ?? ''}</td>` +
          `<td style="color:${COLOR[m.rating]};font-weight:600">${m.rating}</td>` +
          `<td>${m.count}</td></tr>`,
      )
      .join('');
    return (
      `<table style="border-collapse:collapse;font-family:system-ui;font-size:13px">` +
      `<thead><tr><th>Metric</th><th>p75</th><th>Rating</th><th>Samples</th></tr></thead>` +
      `<tbody>${rows || '<tr><td colspan="4">No metrics yet</td></tr>'}</tbody></table>`
    );
  };

  return {
    record,
    getSummary,
    toHTML,
    stop: () => unsub(),
    reset: () => samples.clear(),
  };
}
