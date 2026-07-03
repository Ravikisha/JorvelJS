import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Migration guides',
  description:
    'Move to JORVEL from Create React App + react-router, or from an existing Module Federation setup.',
};

export default function Migration() {
  return (
    <>
      <h1>Migration guides</h1>
      <p>
        Two starting points: a classic SPA (Create React App + react-router) you want to split into
        federated remotes, or an existing hand-rolled Module Federation setup you want JORVEL&apos;s
        conventions on top of. Both are incremental — JORVEL doesn&apos;t require a big-bang rewrite.
      </p>

      <h2 id="cra">From Create React App + react-router</h2>
      <p>
        CRA is unmaintained and has no federation story. The migration is two phases: get the app
        building under JORVEL&apos;s Rspack pipeline, then carve out remotes.
      </p>
      <h3>1. Scaffold a workspace and move the app in</h3>
      <CodeBlock
        language="bash"
        code={`npx jorvel init my-workspace        # host + one remote skeleton
cd my-workspace
# copy your CRA src/ into apps/shell/src, then:
pnpm install`}
      />
      <h3>2. Swap react-router for the JORVEL router</h3>
      <p>
        The two-tier router is History-API based — no <code>&lt;BrowserRouter&gt;</code> needed. Map
        routes to the host table and use <code>NestedRouter</code> for in-app layouts.
      </p>
      <CodeBlock
        language="tsx"
        code={`// before (react-router v6)
<Routes>
  <Route path="/dashboard/*" element={<Dashboard />} />
</Routes>

// after (JORVEL) — see /docs/routing and /docs/nested-routes
import { NestedRouter, type NestedRoute } from '@jorvel/runtime';
const routes: NestedRoute[] = [
  { path: '/dashboard', element: <DashboardShell />, children: [
    { index: true, lazy: () => import('./pages/overview.js'), loading: <Skeleton /> },
  ] },
];`}
      />
      <table>
        <thead><tr><th>react-router</th><th>JORVEL</th></tr></thead>
        <tbody>
          <tr><td><code>useNavigate()</code></td><td><code>useNavigate()</code> (<code>@jorvel/runtime</code>)</td></tr>
          <tr><td><code>useParams()</code></td><td><code>useOutletParams()</code> / <code>useParams()</code></td></tr>
          <tr><td><code>useSearchParams()</code></td><td><code>useSearchParams()</code></td></tr>
          <tr><td><code>&lt;Outlet /&gt;</code></td><td><code>&lt;Outlet /&gt;</code></td></tr>
          <tr><td><code>&lt;Link to&gt;</code></td><td><code>&lt;NavLink to label&gt;</code></td></tr>
          <tr><td><code>loader</code> / <code>action</code></td><td><code>defineLoader</code> (ssr) / <code>defineAction</code></td></tr>
        </tbody>
      </table>
      <h3>3. Carve out the first remote</h3>
      <p>
        Pick a route subtree owned by another team. Move it to <code>apps/&lt;remote&gt;</code>,
        expose <code>./App</code>, and wire it into the host:
      </p>
      <CodeBlock
        language="bash"
        code={`jorvel add remote billing --port 3002
jorvel federation         # regenerate jorvel.federation.json
jorvel federation diff --base main   # confirm the host contract is intact
jorvel dev`}
      />

      <h2 id="existing-mf">From an existing Module Federation setup</h2>
      <p>
        If you already run Webpack/Rspack <code>ModuleFederationPlugin</code> by hand, JORVEL adds
        conventions, a typed contract layer, and tooling without forcing you to relinquish control.
      </p>
      <ol>
        <li>
          Translate each app&apos;s plugin config into a <code>jorvel.app.json</code> (
          <code>name</code>, <code>type: host | remote</code>, <code>port</code>) and run{' '}
          <code>jorvel federation</code> — it emits the <code>jorvel.federation.json</code> JORVEL
          consumes. Diff it against your current plugin options to confirm parity.
        </li>
        <li>
          Replace your bespoke remote loader with <code>loadRemoteEntry</code> /{' '}
          <code>loadRemoteModule</code> from <code>@jorvel/runtime</code> — you get the origin
          allowlist, SRI enforcement, version-skew warnings, and last-good fallback for free.
        </li>
        <li>
          Adopt <code>defineFederationContract</code> for the modules a host depends on, then gate PRs
          with <code>jorvel federation diff</code> so a remote can&apos;t silently drop an expose.
        </li>
      </ol>

      <Callout variant="info" title="Codemods">
        Coming from the pre-rename <code>@mfjs/*</code> packages? <code>jorvel migrate</code> ships
        three codemods (<code>mfjs-to-jorvel</code>, <code>builtins-define</code>,{' '}
        <code>routes-host-rename</code>). Dry-run by default; <code>--apply</code> commits.
      </Callout>

      <Callout variant="warn" title="Migrate incrementally">
        Keep the host shippable at every step. Move one route subtree to a remote, verify with{' '}
        <code>jorvel federation diff</code> + contract tests, deploy, then repeat. A big-bang split
        loses you the ability to bisect a regression.
      </Callout>
    </>
  );
}
