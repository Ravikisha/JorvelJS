import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Mermaid } from '@/components/site/mermaid';

export const metadata = {
  title: 'Architecture',
  description: 'How JORVEL fits together: the runtime, the share scope, the request lifecycle, and the boundaries between host and remotes.',
};

export default function Architecture() {
  return (
    <>
      <h1>Architecture</h1>
      <p>
        For engineers integrating JORVEL into a real system. This is the mental model behind the
        APIs: where code runs, what crosses the host↔remote boundary, and how a request becomes HTML.
      </p>

      <h2 id="topology">Topology</h2>
      <p>
        A <strong>host</strong> (shell) is a normal app that, at runtime, loads one or more{' '}
        <strong>remotes</strong> — each its own independently-built, independently-deployed bundle
        served from its own URL/CDN. The host&apos;s route table maps URL prefixes to remotes; each
        remote resolves its own sub-paths.
      </p>
      <Mermaid
        caption="Iris = host, lime = remote — the same colors used across the docs."
        chart={`
flowchart LR
    B(["Browser"])
    subgraph HOST ["Host · shell"]
      direction TB
      RT["Route table<br/>/dashboard/* → dashboard"]
      RO["RemoteOutlet"]
      SS[("Shared scope<br/>React · runtime · bus")]
      RT --> RO
    end
    subgraph REMOTE ["Remote · dashboard"]
      direction TB
      RE["remoteEntry.js"]
      SUB["Resolves /orders/:id"]
      RE --> SUB
    end
    B -->|"GET /dashboard/orders/42"| RT
    RO -->|"import('dashboard/App')"| RE
    SS -.->|"shares one React"| RE
    class HOST host
    class REMOTE remote
    classDef host fill:#8b7cf612,stroke:#8b7cf6,stroke-width:1.5px;
    classDef remote fill:#84cc1612,stroke:#84cc16,stroke-width:1.5px;
`}
      />

      <h2 id="share-scope">The share scope</h2>
      <p>
        Module Federation keeps <strong>singletons</strong> (React, ReactDOM, the JORVEL runtime, the
        event bus) in a shared scope so host and remotes use the same instance — one React, one
        router, one event bus. JORVEL&apos;s defaults:
      </p>
      <ul>
        <li><strong>Host</strong> sets <code>eager: true</code> on shared deps — it owns and populates the scope before any remote loads.</li>
        <li><strong>Remote</strong> sets <code>eager: false</code> — it lazy-resolves from the host scope via an async boundary (the generated <code>src/main → import(&apos;./bootstrap&apos;)</code> shim).</li>
        <li>A version mismatch on a singleton is surfaced by <code>checkVersions</code> (warn/error) so duplicate React copies don&apos;t slip in.</li>
      </ul>
      <Callout variant="warn" title="Why the async boundary matters">
        Importing shared deps synchronously before MF initializes the scope causes a
        <code> loadShareSync</code> failure. The generated <code>main.{'{tsx,jsx}'}</code> defers all
        imports behind <code>import(&apos;./bootstrap&apos;)</code> — keep that boundary.
      </Callout>

      <h2 id="router">The two-tier router</h2>
      <p>
        Built on the History API — no <code>react-router</code>. The host router owns top-level URLs;
        a remote&apos;s router owns its subtree. Both read the same <code>usePathname</code> stream, so
        they stay in sync without a shared provider. Navigation is a <code>jorvel:navigate</code>{' '}
        custom event, so a remote can navigate the host without importing it.
      </p>
      <CodeBlock
        language="ts"
        code={`// host maps prefixes → remotes
const HOST_ROUTES = [{ path: '/dashboard/*', remote: 'dashboard', module: './App' }];
// remote resolves the tail with its own file-based routes (jorvel routes)`}
      />

      <h2 id="lifecycle">Request lifecycle (SSR)</h2>
      <Mermaid
        caption="One request, server side — each hop can short-circuit the next."
        chart={`
sequenceDiagram
    autonumber
    participant B as Browser
    participant M as Middleware
    participant A as API router
    participant C as ISR cache
    participant L as Loaders
    participant R as Renderer
    participant D as Adapter
    B->>M: GET /dashboard/orders/42
    opt auth / geo / rewrite
      M-->>B: redirect or rewrite
    end
    M->>A: next()
    opt API route matches
      A-->>B: JSON response
    end
    A->>C: serveWithISR check
    alt fresh in cache
      C-->>B: cached HTML
    else miss or stale
      C->>L: runLoaders (per-request context)
      L->>R: data serialized for hydration
      Note over R: renderRouteToString / stream<br/>remotes via ssrRenderRemote
      R->>D: HTML + head (nonce, SRI, preloads)
      D-->>B: streamed response
    end
`}
      />
      <ol>
        <li><strong>Middleware</strong> runs first (auth/geo/rewrite) — <code>runMiddleware</code> → next / redirect / rewrite / respond.</li>
        <li><strong>API routes</strong> get a chance (<code>createApiRouter().handle()</code>); non-match falls through.</li>
        <li><strong>ISR cache</strong> check (<code>serveWithISR</code>) — fresh cache short-circuits render; stale serves + background-regenerates.</li>
        <li><strong>Loaders</strong> run in a per-request context (<code>runLoaders</code>), data serialized for hydration.</li>
        <li><strong>Render</strong> — <code>renderRouteToString</code> / streaming (<code>renderToReadableStream</code>); remotes SSR&apos;d via <code>ssrRenderRemote</code>.</li>
        <li><strong>Head + assets</strong> injected (CSP nonce, SRI, preloads, critical CSS); response returned by the platform <a href="/docs/adapters">adapter</a>.</li>
      </ol>

      <h2 id="boundaries">What crosses the boundary</h2>
      <table>
        <thead><tr><th>Crosses host↔remote</th><th>Stays local</th></tr></thead>
        <tbody>
          <tr><td>Shared singletons (React, runtime, event bus)</td><td>Component state, refs</td></tr>
          <tr><td>Event-bus messages (typed contract)</td><td>A remote&apos;s internal routes/pages</td></tr>
          <tr><td>Shared state stores / atoms (globalThis-pinned)</td><td>CSS (isolate with Shadow DOM / CSS Modules)</td></tr>
          <tr><td>The navigation stream (URL)</td><td>A remote&apos;s BFF / server routes</td></tr>
        </tbody>
      </table>

      <h2 id="failure">Failure isolation</h2>
      <p>
        A remote is a network dependency — treat it like one. <code>RemoteOutlet</code> wraps loads in
        an error boundary; <code>loadWithFallback</code> retries against the last-good URL; a{' '}
        <a href="/docs/recipes#kill-switch">feature-flag kill-switch</a> + circuit breaker skip a bad
        remote so the host degrades instead of crashing.
      </p>

      <Callout variant="info" title="Deep dives">
        <a href="/docs/federation">Federation</a> (contracts, SRI, allowlist, diff/impact/canary) ·{' '}
        <a href="/docs/ssr">SSR/ISR</a> · <a href="/docs/api/runtime">runtime API</a>.
      </Callout>
    </>
  );
}
