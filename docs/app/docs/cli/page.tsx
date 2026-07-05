import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'CLI reference',
  description:
    'Every jorvel command, every flag, every exit code. Quick lookup with worked examples.',
};

export default function CliReference() {
  return (
    <>
      <h1>CLI reference</h1>
      <p>
        The <code>jorvel</code> CLI ships every workflow you need — scaffold, dev, build, federation,
        SSR, quality gates, deploy. Run <code>jorvel --help</code> or <code>jorvel &lt;cmd&gt; --help</code>{' '}
        for the live command list.
      </p>

      <Callout variant="info" title="Where commands run">
        Most commands work from anywhere in the workspace. Per-app commands (e.g.{' '}
        <code>jorvel routes</code>) infer the target from your current directory. Use{' '}
        <code>--app &lt;name&gt;</code> to override.
      </Callout>

      <h2 id="project">Project commands</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>npm create jorvel@latest &lt;name&gt;</code></td><td>Shorthand for <code>jorvel init</code> via the <code>create-jorvel</code> package (works with pnpm/yarn/bun create too)</td></tr>
          <tr><td><code>jorvel init &lt;name&gt;</code></td><td><strong>Scaffolds a runnable app</strong> — workspace + starter host + remote, auto-wired. <code>cd</code>, install, <code>jorvel dev</code> and it runs (create-next-app style)</td></tr>
          <tr><td><code>jorvel init &lt;name&gt; --no-app</code></td><td>Bare workspace only — skip the starter host + remote</td></tr>
          <tr><td><code>jorvel init &lt;name&gt; --template &lt;t&gt;</code></td><td>Starter template: <code>host-remote</code> (default) · <code>saas</code> · <code>blank</code></td></tr>
          <tr><td><code>jorvel init &lt;name&gt; --pm &lt;m&gt;</code></td><td>Package manager: <code>pnpm</code> (default) · <code>npm</code> · <code>yarn</code> · <code>bun</code></td></tr>
          <tr><td><code>jorvel init &lt;name&gt; --tailwind</code></td><td>Wire Tailwind v3 + PostCSS in the scaffolded apps</td></tr>
          <tr><td><code>jorvel generate host &lt;name&gt;</code></td><td>Add a host app (React). Interactive: prompts to add Tailwind</td></tr>
          <tr><td><code>jorvel generate remote &lt;name&gt;</code></td><td>Add a remote — <strong>auto-wired into the host</strong> (federation + host routes + REMOTES map). Prompts for framework, language, Tailwind</td></tr>
          <tr><td><code>jorvel generate remote &lt;name&gt; --no-wire</code></td><td>Add a remote WITHOUT auto-wiring it into the host</td></tr>
          <tr><td><code>jorvel generate remote &lt;name&gt; --framework vue --lang js --tailwind</code></td><td>Skip prompts: Vue remote in JavaScript with Tailwind</td></tr>
          <tr><td><code>jorvel generate remote &lt;name&gt; --no-tailwind</code></td><td>Skip the Tailwind prompt (no Tailwind)</td></tr>
          <tr><td><code>jorvel generate wizard</code></td><td>Prompt-driven generator (framework + Tailwind per app)</td></tr>
          <tr><td><code>jorvel generate types</code></td><td>Emit the host&apos;s <code>src/remotes.d.ts</code> from its federation/routes wiring (so <code>import(&apos;remote/App&apos;)</code> type-checks)</td></tr>
          <tr><td><code>jorvel add remote &lt;name&gt; [--port n] [--url …]</code></td><td>Wire an existing remote into the host: federation map + route + <code>remotes.d.ts</code> + bootstrap REMOTES/NavLink</td></tr>
          <tr><td><code>jorvel add db [app] [--driver sqlite|libsql]</code></td><td>Scaffold a Drizzle ORM backend into an app: schema + client + migrations + seed + a <code>defineLoader</code> data module</td></tr>
        </tbody>
      </table>

      <h3>Naming rules</h3>
      <ul>
        <li>App names must match <code>/^[a-z][a-z0-9-]*$/</code> (lowercase, alphanumeric, hyphens; must start with a letter).</li>
        <li>Ports must be in <code>1–65535</code>; the CLI refuses duplicates and reserved ranges.</li>
        <li>The host should be on a stable port (e.g. <code>3000</code>) — generated configs reference it from every remote.</li>
      </ul>

      <h2 id="dev">Dev &amp; build</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel dev</code></td><td>Run all apps with the Rspack dev-server (colored per-app output; fails fast on duplicate <em>and</em> already-in-use ports — <code>--no-port-check</code> to skip)</td></tr>
          <tr><td><code>jorvel dev --only shell,dashboard</code></td><td>Run only the named apps (<code>--exclude</code> for the inverse)</td></tr>
          <tr><td><code>jorvel dev --proxy-remotes</code></td><td>Serve every remote under the host origin (recommended)</td></tr>
          <tr><td><code>jorvel dev --hmr-remotes</code></td><td>Cross-app HMR — host reloads when any remote recompiles</td></tr>
          <tr><td><code>jorvel build</code></td><td>Production build, host first then remotes</td></tr>
          <tr><td><code>jorvel build --app dashboard</code></td><td>Build one app</td></tr>
          <tr><td><code>jorvel build --compress</code></td><td>Emit <code>.gz</code> / <code>.br</code> alongside every static asset</td></tr>
          <tr><td><code>jorvel build --compute-sri</code></td><td>Hash <code>remoteEntry.js</code> for SRI; writes <code>jorvel.federation.sri.json</code></td></tr>
          <tr><td><code>jorvel build --parallel</code></td><td>Build apps concurrently (they are independent — federation resolves at runtime)</td></tr>
          <tr><td><code>jorvel build --stats [path]</code></td><td>Write a JSON summary (apps, sizes, shared-dep conflicts) — default <code>jorvel-build-stats.json</code></td></tr>
          <tr><td><code>jorvel image optimize [--app n] [--formats webp,avif] [--widths …] [--quality n]</code></td><td>Generate responsive/modern-format image variants from <code>dist/</code></td></tr>
          <tr><td><code>jorvel lazy</code></td><td>Scaffold a lazy-boundary helper for code-split remote components</td></tr>
          <tr><td><code>jorvel analyze --app dashboard</code></td><td>Open a bundle analyzer (rsdoctor → rspack-bundle-analyzer → built-in HTML fallback)</td></tr>
          <tr><td><code>jorvel perf-dashboard [--input file] [--budgets file]</code></td><td>Live terminal dashboard: remote loads, p95, size, budget status</td></tr>
          <tr><td><code>jorvel route-editor [--manifest file]</code></td><td>Emits a self-contained HTML editor for the host route tree (drag remotes onto a parent path). Defaults the manifest to the discovered host app.</td></tr>
          <tr><td><code>jorvel adapter add &lt;vue|svelte|solid&gt; --name X</code></td><td>Scaffold a remote built with a non-React framework</td></tr>
          <tr><td><code>jorvel split [--log file] [--top N]</code></td><td>Analyze a traffic log and suggest the highest-impact component to split into its own remote</td></tr>
          <tr><td><code>jorvel loadtest [--target url]</code></td><td>Scaffold a k6 load-test script with p95 / failure-rate thresholds</td></tr>
          <tr><td><code>jorvel typedoc [--out dir]</code></td><td>Generate the TypeDoc API reference from <code>libs/*</code> into the docs site (markdown by default)</td></tr>
          <tr><td><code>jorvel schema [--out dir]</code></td><td>Emit the authoritative JSON Schemas (<code>jorvel.config</code> / <code>jorvel.app</code> / <code>jorvel.federation</code>) re-sourced from <code>@jorvel/types</code></td></tr>
          <tr><td><code>jorvel config validate</code></td><td>Validate <code>jorvel.config.json</code> against the bundled schema</td></tr>
          <tr><td><code>jorvel turbo [--force]</code></td><td>Scaffold a <code>turbo.json</code> with the standard JORVEL task graph (build / typecheck / test / lint / dev)</td></tr>
          <tr><td><code>jorvel federation</code></td><td>Regenerate <code>jorvel.federation.json</code> for every app</td></tr>
          <tr><td><code>jorvel federation diff [--base ref] [--allow-breaking] [--json]</code></td><td>Diff federation contracts vs a git base ref; exits <code>1</code> on a breaking change (removed expose, dropped remote, singleton demotion) — a CI gate</td></tr>
          <tr><td><code>jorvel canary &lt;remote&gt; --url … [--weight n] [--promote] [--rollback] [--status]</code></td><td>Weighted canary rollout for a remote → <code>jorvel.federation.canary.json</code> (runtime picks per user via <code>pickWeightedRemote</code>)</td></tr>
          <tr><td><code>jorvel federation impact [remote] [--json]</code></td><td>Impact analysis — which hosts consume a remote (before changing/retiring it)</td></tr>
          <tr><td><code>jorvel info [--json]</code></td><td>Shareable environment diagnostic bundle (OS, Node, pkg managers, apps, <code>@jorvel</code> deps)</td></tr>
          <tr><td><code>jorvel routes</code></td><td>Compile <code>src/pages/</code> into <code>src/jorvel.routes.ts</code> (or <code>.js</code> for JS apps)</td></tr>
          <tr><td><code>jorvel routes --watch</code></td><td>Re-compile on file changes</td></tr>
        </tbody>
      </table>

      <h3>Typical dev session</h3>
      <CodeBlock
        language="bash"
        code={`# Terminal 1
jorvel dev --proxy-remotes --hmr-remotes

# Terminal 2 — auto-regenerate routes when you add a page
cd apps/dashboard
jorvel routes --watch`}
      />

      <h2 id="ssr">SSR</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel ssr export</code></td><td>Pre-render the routes table to static HTML (SSG)</td></tr>
          <tr><td><code>jorvel ssr export --out dist-ssg --manifest manifest.json</code></td><td>Custom output + content-hash manifest</td></tr>
          <tr><td><code>jorvel ssr serve --port 3000</code></td><td>Streaming Node SSR (default)</td></tr>
          <tr><td><code>jorvel ssr serve --port 3000 --no-stream</code></td><td>Synchronous SSR — useful for buggy CDN edges</td></tr>
          <tr><td><code>jorvel ssr serve --static apps/shell/dist</code></td><td>Also serve built client assets so hydration bundles resolve</td></tr>
        </tbody>
      </table>

      <h2 id="quality">Quality</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel lint</code></td><td>ESLint across the workspace; reuses the workspace config</td></tr>
          <tr><td><code>jorvel lint --fix</code></td><td>Apply auto-fixes</td></tr>
          <tr><td><code>jorvel test</code></td><td>Vitest across every package, parallel by default</td></tr>
          <tr><td><code>jorvel test --coverage</code></td><td>Generate HTML + lcov coverage under each <code>coverage/</code> dir</td></tr>
          <tr><td><code>jorvel typecheck</code></td><td><code>tsc --noEmit</code> per package, project-references aware</td></tr>
          <tr><td><code>jorvel perf</code></td><td>Bundle-size budget check; reads <code>perf.budget.json</code></td></tr>
          <tr><td><code>jorvel e2e</code></td><td>Run Playwright against the example app</td></tr>
        </tbody>
      </table>

      <Callout variant="info" title="Budget format">
        <code>perf.budget.json</code> takes pattern entries like{' '}
        <code>{`{ "*.js": { "maxSize": "200kb" } }`}</code>. Patterns are matched against the
        emitted asset names; failing budgets exit non-zero so CI catches regressions.
      </Callout>

      <h2 id="ops">Ops</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel diagnose</code></td><td>Verify Node, pnpm, Rspack peer, ports, configs, <code>.env</code> vs <code>.env.example</code>, federation contract drift, React-duplication risks</td></tr>
          <tr><td><code>jorvel env check</code></td><td>Fail if any var listed in <code>.env.example</code> is missing</td></tr>
          <tr><td><code>jorvel env scaffold</code></td><td>Write a starter <code>.env.example</code></td></tr>
          <tr><td><code>jorvel deploy --target vercel</code></td><td>Scaffold <code>vercel.json</code> + edge handler</td></tr>
          <tr><td><code>jorvel deploy --target cloudflare</code></td><td>Scaffold <code>wrangler.toml</code> + Worker handler</td></tr>
          <tr><td><code>jorvel deploy --target node</code></td><td>Scaffold a Node server entry</td></tr>
          <tr><td><code>jorvel deploy --target docker</code></td><td>Scaffold a multi-stage <code>Dockerfile</code></td></tr>
          <tr><td><code>jorvel ci affected</code></td><td>List apps changed since the last commit — feed into a build matrix</td></tr>
          <tr><td><code>jorvel sw generate [--app &lt;name&gt;]</code></td><td>Write <code>jorvel-sw.js</code> into the host&apos;s <code>public/</code> (auto-discovers the host app when <code>--app</code> is omitted)</td></tr>
        </tbody>
      </table>

      <h3>CI snippet</h3>
      <CodeBlock
        language="yaml"
        filename=".github/workflows/ci.yml"
        code={`jobs:
  affected:
    runs-on: ubuntu-latest
    outputs:
      apps: \${{ steps.affected.outputs.apps }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.5 }
      - run: pnpm install --frozen-lockfile
      - id: affected
        run: echo "apps=$(jorvel ci affected --json)" >> "$GITHUB_OUTPUT"

  build:
    needs: affected
    if: needs.affected.outputs.apps != '[]'
    strategy:
      matrix:
        app: \${{ fromJSON(needs.affected.outputs.apps) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.5 }
      - run: pnpm install --frozen-lockfile
      - run: jorvel build --app \${{ matrix.app }} --compress --compute-sri`}
      />

      <h2 id="config">Workspace config</h2>
      <p>
        Every command loads a single <code>jorvel.config.json</code> from the workspace root
        (validate it with <code>jorvel config validate</code>). Key fields:
      </p>
      <table>
        <thead>
          <tr><th>Field</th><th>Effect</th></tr>
        </thead>
        <tbody>
          <tr><td><code>appsDir</code></td><td>Directory the CLI scans for apps. Default <code>&quot;apps&quot;</code>; set it to relocate the apps folder — honored by app + host discovery across <code>dev</code>/<code>build</code>/<code>routes</code>/<code>federation</code>/<code>deploy</code>/<code>ci</code>/<code>sw</code>/<code>route-editor</code>.</td></tr>
          <tr><td><code>federation.shared</code></td><td>Extra packages to share as singletons across host + remotes (merged into every generated federation config).</td></tr>
          <tr><td><code>security</code></td><td>CSP / allowlist defaults consumed by the security helpers.</td></tr>
          <tr><td><code>deploy</code></td><td>Adapter target + options for <code>jorvel deploy</code>.</td></tr>
          <tr><td><code>plugins</code></td><td>CLI plugins loaded at startup.</td></tr>
        </tbody>
      </table>

      <h2 id="env">Environment variables</h2>
      <table>
        <thead>
          <tr><th>Variable</th><th>Effect</th></tr>
        </thead>
        <tbody>
          <tr><td><code>JORVEL_DEBUG=1</code></td><td>Print full stack traces from CLI errors</td></tr>
          <tr><td><code>JORVEL_NO_COLOR=1</code></td><td>Disable ANSI colors (also respects <code>NO_COLOR</code>)</td></tr>
          <tr><td><code>JORVEL_OFFLINE=1</code></td><td>Skip network checks during scaffolding</td></tr>
          <tr><td><code>JORVEL_DEV_RELOAD_URL</code></td><td>Injected by <code>--hmr-remotes</code>; the host&apos;s reload-WS endpoint</td></tr>
          <tr><td><code>JORVEL_E2E=1</code></td><td>Opt into the Playwright suite locally</td></tr>
        </tbody>
      </table>

      <h2 id="exit-codes">Exit codes</h2>
      <table>
        <thead>
          <tr><th>Code</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>0</code></td><td>Success</td></tr>
          <tr><td><code>1</code></td><td>Generic failure (uncaught exception, validation error)</td></tr>
          <tr><td><code>2</code></td><td>User input invalid (bad flag, missing argument)</td></tr>
          <tr><td><code>3</code></td><td>Lifecycle failure (build/test/typecheck step exited non-zero)</td></tr>
        </tbody>
      </table>
    </>
  );
}
