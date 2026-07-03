import { reportMetric } from './hooks.js';

export interface WebVitalsOptions {
  /** Report on every metric, not only when tab hides. Default: false. */
  reportAllChanges?: boolean;
}

/**
 * Minimal Core Web Vitals collector. Uses the PerformanceObserver API.
 * For richer reporting integrate the `web-vitals` npm package.
 */
export function collectWebVitals(opts: WebVitalsOptions = {}): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return () => {};

  const disposers: Array<() => void> = [];

  disposers.push(observe('largest-contentful-paint', (entry) => {
    reportMetric({ name: 'lcp', value: entry.startTime, unit: 'ms' });
  }));

  // FCP comes from the `paint` entry (`first-contentful-paint`), NOT navigation
  // timing. The old code reported `domContentLoadedEventStart` as "fcp", which is
  // a different milestone entirely.
  disposers.push(observe('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      reportMetric({ name: 'fcp', value: entry.startTime, unit: 'ms' });
    }
  }));

  // FID is deprecated (replaced by INP in 2024). Keep FID for back-compat, but
  // also collect INP — the worst interaction latency seen (a simple, monotonic
  // approximation of the spec's high-percentile INP).
  disposers.push(observe('first-input', (entry) => {
    const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
    reportMetric({ name: 'fid', value: fid, unit: 'ms' });
  }));

  let inpValue = 0;
  disposers.push(observe('event', (entry) => {
    const e = entry as PerformanceEventTiming & { interactionId?: number };
    if (e.interactionId && e.duration > inpValue) inpValue = e.duration;
  }));

  // CLS via the session-window algorithm (max windowed sum; windows break after
  // a 1s gap or 5s total) — NOT a lifetime sum, which over-reports.
  let clsValue = 0;
  let sessionValue = 0;
  let sessionFirst = 0;
  let sessionLast = 0;
  disposers.push(observe('layout-shift', (entry) => {
    const e = entry as unknown as { value: number; hadRecentInput: boolean; startTime: number };
    if (e.hadRecentInput) return;
    if (sessionValue && (e.startTime - sessionLast > 1000 || e.startTime - sessionFirst > 5000)) {
      sessionValue = 0;
    }
    if (sessionValue === 0) sessionFirst = e.startTime;
    sessionLast = e.startTime;
    sessionValue += e.value;
    if (sessionValue > clsValue) clsValue = sessionValue;
    if (opts.reportAllChanges) reportMetric({ name: 'cls', value: clsValue });
  }));

  const flush = () => {
    reportMetric({ name: 'cls', value: clsValue });
    if (inpValue > 0) reportMetric({ name: 'inp', value: inpValue, unit: 'ms' });
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onVisibility);
  // The listener used to leak — register its removal in the disposer chain.
  disposers.push(() => document.removeEventListener('visibilitychange', onVisibility));

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      reportMetric({ name: 'ttfb', value: nav.responseStart, unit: 'ms' });
    }
  } catch {}

  return () => disposers.forEach((d) => d());
}

function observe(type: string, cb: (entry: PerformanceEntry) => void): () => void {
  try {
    const po = new PerformanceObserver((list) => list.getEntries().forEach(cb));
    po.observe({ type, buffered: true } as PerformanceObserverInit);
    return () => po.disconnect();
  } catch {
    return () => {};
  }
}
