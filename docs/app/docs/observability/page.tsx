import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Observability',
  description:
    'Three hooks (errors, metrics, remote loads) bridge JORVEL runtime events to Sentry / OTEL / any collector. Web Vitals + structured logger included.',
};

export default function Observability() {
  return (
    <>
      <h1>Observability</h1>
      <p>
        <code>@jorvel/observability</code> exposes three hooks you wire to whatever backend your org
        uses. Runtime code dispatches telemetry events; the package bridges them to Sentry / OTEL
        / your own collector. The library never sends anything by itself — you pick the adapter.
      </p>
      <Callout variant="info" title="Architecture">
        Sources (<code>@jorvel/runtime</code>, your code) call{' '}
        <code>reportError / reportMetric / reportRemoteLoad</code>. Subscribers (Sentry adapter,
        Console adapter, your code) receive every event. The bridge is in-memory; no
        cross-network hop until your adapter chooses to send. The hook registry is pinned to{' '}
        <code>globalThis</code> via <code>Symbol.for(...)</code>, so duplicate MF bundles all share
        the same subscriber list — register an adapter once and every remote feeds it.
      </Callout>

      <h2>Hooks</h2>
      <CodeBlock
        language="ts"
        code={`import { onError, onMetric, onRemoteLoad } from '@jorvel/observability';

const off = onError((e) => sendToBackend(e));
onMetric((m) => statsd.gauge(m.name, m.value, m.tags));
onRemoteLoad((e) => console.log(e.remote, e.phase, e.durationMs));`}
      />

      <h2>Web Vitals</h2>
      <CodeBlock
        language="ts"
        code={`import { collectWebVitals, useConsoleAdapter } from '@jorvel/observability';
useConsoleAdapter();
collectWebVitals();
// Reports LCP / INP / CLS / TTFB / FCP as metrics`}
      />
      <Callout variant="info" title="Vitals details">
        FCP is read from the <code>paint</code> entry (<code>first-contentful-paint</code>).{' '}
        <code>INP</code> is now collected (<code>FID</code> is kept for back-compat). <code>CLS</code>{' '}
        uses the <strong>session-window</strong> algorithm rather than a lifetime sum, and the{' '}
        <code>visibilitychange</code> listener is removed on dispose.
      </Callout>

      <h2 id="rum">Real User Monitoring (RUM)</h2>
      <p>
        <code>startRum</code> subscribes to every <code>error</code>, <code>metric</code>, and
        <code> remote-load</code> hook, batches them, and ships each batch to your collector via
        <code> navigator.sendBeacon</code> (with a <code>fetch</code> fallback). Auto-flushes on{' '}
        <code>visibilitychange === &apos;hidden&apos;</code>, on <code>pagehide</code>, on a periodic
        interval, when the batch threshold is reached, and on <code>dispose()</code>. The{' '}
        <code>sampleRate</code> decision is made <strong>once per session</strong> (not per event),
        so a sampled-in session captures all of its events. Filtering and queue caps are built in.
      </p>

      <CodeBlock
        language="ts"
        code={`import { startRum } from '@jorvel/observability';

const rum = startRum({
  endpoint: 'https://rum.acme.dev/ingest',
  app: 'shop',
  release: process.env.GIT_SHA,
  sampleRate: 0.25,            // keep 25% of events
  batchSize: 20,
  flushIntervalMs: 10_000,
});

// Optional explicit teardown (also fires on page hide):
window.addEventListener('beforeunload', () => rum.dispose());`}
      />

      <Callout variant="info" title="Pass a transport for non-browser hosts">
        Workers, Edge functions, and unit tests can supply{' '}
        <code>{`{ transport: async (batch) => fetch(...) }`}</code> instead of{' '}
        <code>endpoint</code> to skip the <code>sendBeacon</code> path entirely.
      </Callout>

      <h2>Sentry adapter</h2>
      <CodeBlock
        language="ts"
        code={`import * as Sentry from '@sentry/browser';
import { useSentryAdapter } from '@jorvel/observability';

Sentry.init({ dsn: process.env.SENTRY_DSN });
useSentryAdapter(Sentry);`}
      />

      <h2>OpenTelemetry adapter</h2>
      <p>
        <code>useOtelAdapter</code> bridges <code>onError</code> + <code>onRemoteLoad</code> into a
        duck-typed <code>Tracer</code>. Each remote-load lifecycle becomes one span; each error
        becomes a stand-alone span with <code>recordException</code> + ERROR status.
      </p>
      <CodeBlock
        language="ts"
        code={`import { trace } from '@opentelemetry/api';
import { useOtelAdapter } from '@jorvel/observability';

const tracer = trace.getTracer('jorvel-shell');

const off = useOtelAdapter(tracer, {
  baseAttributes: { 'service.name': 'shell', 'service.version': '1.2.3' },
});

// later — closes any in-flight spans with ERROR status
off();`}
      />
      <p>
        Pair with the <a href="/docs/federation#health">health endpoint</a> so dashboards see both
        synchronous probe state and span timelines for the same remote.
      </p>

      <h2>Error grouping (fingerprints)</h2>
      <p>
        <code>computeFingerprint</code> (or its shorthand <code>groupBy</code>) returns a stable
        Sentry-compatible fingerprint built from the remote name, source bucket, error class, first
        non-<code>node_modules</code> stack frame, and a normalized message (ids / hex hashes /
        UUIDs collapsed). Two crashes from the same call site collapse into one issue.
      </p>
      <CodeBlock
        language="ts"
        code={`import * as Sentry from '@sentry/browser';
import { onError, groupBy } from '@jorvel/observability';

onError((e) => {
  Sentry.captureException(e.error, {
    fingerprint: groupBy({
      error: e.error,
      remote: (e.context?.remote as string) ?? 'host',
      source: e.source,
      stripPrefixes: [process.cwd()],
    }),
    tags: { remote: (e.context?.remote as string) ?? 'host', source: e.source },
  });
});`}
      />

      <h2>Structured logger</h2>
      <CodeBlock
        language="ts"
        code={`import { createLogger } from '@jorvel/observability';

const log = createLogger({ name: 'shell', level: 'info' });
log.info('boot', { region: 'us-east' });
// {"time":"...","level":"info","name":"shell","msg":"boot","ctx":{"region":"us-east"}}`}
      />

      <h2>Runtime telemetry source</h2>
      <p>
        <code>@jorvel/runtime</code> emits <code>jorvel:remote-load</code> and{' '}
        <code>jorvel:error</code> DOM events for every remote load. Observability bridges them into
        the hook registry automatically when you import the package.
      </p>

      <h2 id="event-shapes">Event shapes</h2>
      <table>
        <thead>
          <tr><th>Hook</th><th>Payload</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>onError</code></td>
            <td>
              <code>
                {`{ error: unknown; source: 'host' | 'remote' | 'ssr' | 'sw'; context?: Record<string, unknown> }`}
              </code>
            </td>
          </tr>
          <tr>
            <td><code>onMetric</code></td>
            <td>
              <code>
                {`{ name: string; value: number; tags?: Record<string, string>; ts?: number }`}
              </code>
            </td>
          </tr>
          <tr>
            <td><code>onRemoteLoad</code></td>
            <td>
              <code>
                {`{ remote: string; phase: 'start' | 'success' | 'error'; durationMs: number; cached?: boolean; error?: unknown }`}
              </code>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 id="recipe-otel">Recipe: OpenTelemetry bridge</h2>
      <CodeBlock
        language="ts"
        code={`import { onError, onMetric, onRemoteLoad } from '@jorvel/observability';
import { trace, metrics } from '@opentelemetry/api';

const tracer = trace.getTracer('jorvel');
const meter  = metrics.getMeter('jorvel');
const navDuration = meter.createHistogram('jorvel.remote.load_ms');

onRemoteLoad((e) => {
  if (e.phase !== 'success') return;
  navDuration.record(e.durationMs, { remote: e.remote, cached: String(!!e.cached) });
});

onError((e) => tracer.startActiveSpan('jorvel.error', (span) => {
  span.recordException(e.error as Error);
  span.setAttributes({ source: e.source, ...(e.context ?? {}) });
  span.end();
}));

onMetric((m) => {
  // route generic metrics to your collector
});`}
      />

      <h2 id="recipe-dashboard">Recipe: per-remote dashboard</h2>
      <p>
        Three SLI you almost certainly want a dashboard for. Track each by{' '}
        <code>remote</code> tag and you can spot a misbehaving service in seconds.
      </p>
      <ul>
        <li>
          <strong>Remote load p95</strong> — alert at <code>{'> 1500ms'}</code> for 5 minutes.
        </li>
        <li>
          <strong>Remote load error rate</strong> — alert at <code>{'> 1%'}</code> for 5 minutes.
        </li>
        <li>
          <strong>JS errors per session</strong> — alert at <code>{'> 0.5'}</code> rolling 1h.
        </li>
      </ul>

      <Callout variant="warn" title="Don't double-report">
        If both your global error handler and a per-component <code>ErrorBoundary</code> call{' '}
        <code>reportError</code> for the same error, Sentry counts two issues. The bundled{' '}
        <code>ErrorBoundary</code> reports automatically; if you wrap it, swallow the call or
        let it bubble — never both.
      </Callout>

      <h2 id="traceparent">Distributed tracing (W3C traceparent)</h2>
      <p>
        Propagate a <code>traceparent</code> from host → remote so a request&apos;s spans stitch
        together across federation boundaries.
      </p>
      <CodeBlock
        language="ts"
        code={`import { generateTraceparent, parseTraceparent, propagateTraceparent } from '@jorvel/observability';

const tp = generateTraceparent();                 // '00-<traceId>-<spanId>-01'
// forward it on remote fetches:
const headers = propagateTraceparent(incomingHeaders); // reuses/creates traceparent
await fetch(remoteUrl, { headers });`}
      />

      <h2 id="analytics">Analytics adapters</h2>
      <p>
        Dependency-free pageview/event adapters (POST via <code>fetch</code>, no SDK) for PostHog,
        Plausible, and Vercel Analytics behind one <code>AnalyticsAdapter</code> interface.
      </p>
      <CodeBlock
        language="ts"
        code={`import { posthogAdapter, plausibleAdapter } from '@jorvel/observability';

const analytics = posthogAdapter({ apiKey: process.env.POSTHOG_KEY! });
analytics.pageview(location.href);
analytics.track({ name: 'signup', properties: { plan: 'pro' } });`}
      />

      <h2 id="sourcemaps">Source-map upload &amp; session replay</h2>
      <CodeBlock
        language="ts"
        code={`import { uploadSourcemaps, createSessionReplay } from '@jorvel/observability';

// CI post-build: ship maps to a Sentry release
await uploadSourcemaps({ distDir: 'dist', org: 'acme', release: process.env.RELEASE!, authToken: process.env.SENTRY_TOKEN!, fs });

// lightweight interaction replay (masks inputs by default)
const replay = createSessionReplay({ sink: (events) => beacon('/replay', events), bufferSize: 100 });`}
      />

      <h2 id="devtools-extension">DevTools extension</h2>
      <p>
        The runtime exposes <code>window.__JORVEL__</code> (version, loaded remotes + SRI status,
        per-remote load timings, share scope). The <strong>JORVEL DevTools</strong> Chrome extension
        (<code>packages/devtools-extension</code>) renders it in a dedicated panel — load it unpacked
        from <code>chrome://extensions</code> (Developer mode → Load unpacked). MV3, no build step;
        the same sources load in Firefox via <code>about:debugging</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import { getDevtoolsSnapshot } from '@jorvel/runtime';

// same data the extension reads:
const snap = getDevtoolsSnapshot();
// { version, remotes: { dashboard: { entryUrl, loadedAtMs, integrity? } }, shareScope, timings: [...] }`}
      />

      <h2 id="log-drains">Log drains (Datadog / Logtail / HTTP)</h2>
      <p>
        Batch structured logs and ship them to a platform over <code>fetch</code> — no SDK. Use a
        drain as the <code>sink</code> for <code>createLogger</code>, or drive it directly; call{' '}
        <code>flush()</code> before shutdown.
      </p>
      <CodeBlock
        language="ts"
        code={`import { createLogger, datadogDrain } from '@jorvel/observability';

const drain = datadogDrain({ apiKey: process.env.DD_API_KEY!, service: 'shell', batchSize: 50 });
const log = createLogger({ sink: (entry) => drain.log(entry) });

log.info('checkout.completed', { orderId });
// also: logtailDrain({ token }), httpDrain({ endpoint, headers })
addEventListener('beforeunload', () => void drain.flush());`}
      />

      <h2 id="web-vitals-dashboard">Web Vitals dashboard</h2>
      <p>
        Aggregate reported vitals into a p75 + Core-Web-Vitals rating (good / needs-improvement /
        poor). Framework-agnostic — read <code>getSummary()</code> into your own UI, or drop the
        built-in <code>toHTML()</code> panel into a dashboard.
      </p>
      <CodeBlock
        language="ts"
        code={`import { collectWebVitals, createWebVitalsDashboard } from '@jorvel/observability';

collectWebVitals();                       // start reporting LCP/CLS/INP/FCP/TTFB
const dash = createWebVitalsDashboard();  // auto-subscribes to reported metrics

dash.getSummary();  // [{ name: 'lcp', p75, rating: 'good', count }, …]
panel.innerHTML = dash.toHTML();`}
      />
    </>
  );
}
