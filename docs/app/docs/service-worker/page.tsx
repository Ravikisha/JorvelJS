import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Service Worker',
  description:
    'Cache the shell + remoteEntry.js + federation chunks. Network-first HTML, cache-first hashed chunks, stale-while-revalidate remotes.',
};

export default function ServiceWorker() {
  return (
    <>
      <h1>Service Worker</h1>
      <p>
        JORVEL ships a Service Worker that caches the app shell, every{' '}
        <code>remoteEntry.js</code>, and federation chunks. Second visits (or flaky networks) load
        instantly from cache. The SW is opt-in — generate it once, register it from your shell
        bootstrap, and the runtime handles updates.
      </p>
      <Callout variant="warn" title="Use this in production only">
        Service Workers cache aggressively. In dev they fight HMR. The CLI does not register one
        for you — make the registration call conditional on{' '}
        <code>process.env.NODE_ENV === &apos;production&apos;</code>.
      </Callout>

      <h2 id="generate">Generate</h2>
      <CodeBlock
        language="bash"
        code={`jorvel sw generate
# discovers the host app → writes <host>/public/jorvel-sw.js

jorvel sw generate --app shell   # or target an app explicitly`}
      />

      <p>
        With no <code>--app</code>, the command discovers the workspace host app (honoring{' '}
        <code>appsDir</code>) so you don&apos;t hardcode a folder name. The generated SW reads the
        build manifest at install time and pre-caches the shell. Re-run the command on every build,
        or wire it into your build script.
      </p>

      <h2 id="register">Register</h2>
      <CodeBlock
        language="tsx"
        filename="apps/shell/src/bootstrap.tsx"
        code={`import { registerJorvelServiceWorker } from '@jorvel/runtime';

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  registerJorvelServiceWorker({
    url: '/jorvel-sw.js',
    autoActivate: true,
    onUpdateReady: () => showUpdateBanner(),
    onError: (err) => observability.reportError(err),
  });
}`}
      />

      <h2 id="strategy">Cache strategy</h2>
      <table>
        <thead><tr><th>Asset class</th><th>Strategy</th><th>Rationale</th></tr></thead>
        <tbody>
          <tr>
            <td><code>remoteEntry.js</code> + <code>/jorvel/remotes/**</code></td>
            <td>stale-while-revalidate</td>
            <td>Cache-first for instant load; revalidate in background so the next visit gets new code</td>
          </tr>
          <tr>
            <td>Fingerprinted chunks <code>*.[hash].js</code></td>
            <td>cache-first</td>
            <td>Content-addressable — never changes for a given URL</td>
          </tr>
          <tr>
            <td>HTML documents</td>
            <td>network-first with offline fallback</td>
            <td>Always try fresh; serve cached <code>/offline.html</code> if offline</td>
          </tr>
          <tr>
            <td>API requests (<code>/api/**</code>)</td>
            <td>not cached</td>
            <td>The SW gets out of the way for dynamic data</td>
          </tr>
        </tbody>
      </table>

      <h2 id="update-flow">Update flow</h2>
      <ol>
        <li>User visits — the browser fetches <code>/jorvel-sw.js</code> in the background.</li>
        <li>If the bytes changed, the new SW installs in parallel and waits in <code>installed</code> state.</li>
        <li>The runtime fires <code>onUpdateReady</code>. Show a banner: <em>&quot;A new version is available. Reload?&quot;</em></li>
        <li>
          User clicks reload → runtime sends <code>SKIP_WAITING</code>; new SW activates and takes
          control of all open clients. <code>autoActivate: true</code> skips the user prompt and
          activates immediately — fine for apps where users don&apos;t have unsaved state, risky
          otherwise.
        </li>
      </ol>

      <h2 id="options">Register options</h2>
      <table>
        <thead><tr><th>Option</th><th>Default</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>url</code></td><td>—</td><td>Required. Path to the SW file.</td></tr>
          <tr><td><code>scope</code></td><td>same as <code>url</code> directory</td><td>Restricts which URLs the SW controls.</td></tr>
          <tr><td><code>autoActivate</code></td><td><code>false</code></td><td>Skip the waiting state; new SW activates immediately.</td></tr>
          <tr><td><code>onUpdateReady</code></td><td>—</td><td>Called when a new SW is installed and waiting.</td></tr>
          <tr><td><code>onActivated</code></td><td>—</td><td>Called when the new SW takes control.</td></tr>
          <tr><td><code>onError</code></td><td>—</td><td>Registration / install errors.</td></tr>
        </tbody>
      </table>

      <h2 id="unregister">Unregister</h2>
      <CodeBlock
        language="ts"
        code={`import { unregisterJorvelServiceWorker } from '@jorvel/runtime';
await unregisterJorvelServiceWorker();`}
      />

      <p>Use this from a console command for stuck users, or as a kill-switch wired to a feature flag.</p>

      <Callout variant="warn" title="Scope note">
        Service Workers are restricted to the origin root by default. When serving remotes on a CDN
        subdomain, register a separate SW per origin or proxy remotes under the host origin via{' '}
        <code>jorvel dev --proxy-remotes</code> / a production reverse proxy. The{' '}
        <code>Service-Worker-Allowed</code> response header is the only way to widen scope beyond
        the SW file&apos;s directory.
      </Callout>

      <h2 id="debugging">Debugging</h2>
      <ul>
        <li>
          DevTools → Application → Service Workers → check &quot;Update on reload&quot; while
          iterating on the SW source.
        </li>
        <li>
          To force a refresh, click <strong>Unregister</strong> then hard-reload. Or call{' '}
          <code>unregisterJorvelServiceWorker()</code> from the console.
        </li>
        <li>
          Caches show up under Application → Cache Storage. Names start with{' '}
          <code>jorvel:</code>; entries include the URL and expiry timestamp.
        </li>
        <li>
          To simulate offline, DevTools → Network → throttle dropdown → &quot;Offline&quot;. The SW
          should serve the cached shell + offline fallback.
        </li>
        <li>
          Console messages from the SW go to a different log surface — open the SW source from the
          Application panel and click &quot;inspect&quot; to attach a console.
        </li>
      </ul>

      <h2 id="csp">CSP impact</h2>
      <p>
        Service Workers need to be served same-origin with{' '}
        <code>Service-Worker-Allowed: /</code> if you want broader scope than the file&apos;s
        directory. They also need <code>script-src 'self'</code> at minimum — strict-dynamic
        nonces do <em>not</em> apply to top-level script registration; only to inline scripts.
      </p>

      <h2 id="cdn-remotes">Caching CDN-hosted remotes</h2>
      <p>
        If your remotes live on <code>cdn.acme.com</code>, the same-origin SW cannot cache them
        directly. Two options:
      </p>
      <ol>
        <li>
          <strong>Proxy remotes under the host origin.</strong> The Rspack dev-server already does
          this via <code>--proxy-remotes</code>; in production, a CDN edge function or reverse
          proxy can replicate the pattern.
        </li>
        <li>
          <strong>Per-origin SW.</strong> Ship a second SW under the CDN origin if it&apos;s yours
          to control. Coordinate cache version names so a deploy invalidates both.
        </li>
      </ol>

      <h2 id="caveats">Caveats</h2>
      <ul>
        <li>SW updates are async — there&apos;s always a one-visit lag before users see new bytes.</li>
        <li>iOS Safari aggressively kills idle SWs; expect occasional cold starts.</li>
        <li>Setting <code>autoActivate: true</code> while users have unsaved form data is a footgun.</li>
        <li>The SW must be served with <code>Content-Type: text/javascript</code>; some static hosts default to <code>application/javascript</code> which works but throws on older browsers.</li>
      </ul>
    </>
  );
}
