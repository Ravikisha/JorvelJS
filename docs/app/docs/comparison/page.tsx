import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'JORVEL vs Next.js / Remix / SvelteKit / Nx',
  description:
    'Where JORVEL fits: a federation-first React meta-framework. Honest comparison against Next.js, Remix, SvelteKit, and Nx.',
};

export default function Comparison() {
  return (
    <>
      <h1>JORVEL vs Next.js / Remix / SvelteKit / Nx</h1>
      <p>
        JORVEL is a <strong>federation-first</strong> React meta-framework: independently built and
        deployed micro-frontends that compose at runtime, with the routing / SSR / data / security
        conveniences you expect from a modern framework. The other tools optimize for a single
        deployable app (Next/Remix/SvelteKit) or for a monorepo build graph (Nx). Pick by your
        deployment topology, not by feature-count.
      </p>

      <Callout variant="info" title="The one-line test">
        Do multiple teams need to ship parts of one UI on independent release cycles? → JORVEL.
        One team, one deploy? → Next.js or Remix are less machinery.
      </Callout>

      <h2 id="matrix">Feature matrix</h2>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>JORVEL</th>
              <th>Next.js</th>
              <th>Remix</th>
              <th>SvelteKit</th>
              <th>Nx</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Runtime Module Federation</td><td>First-class</td><td>Plugin</td><td>No</td><td>No</td><td>Build-time only</td></tr>
            <tr><td>Independent deploy per team</td><td>Yes</td><td>No</td><td>No</td><td>No</td><td>Partial</td></tr>
            <tr><td>Nested layouts / loading / error</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>n/a</td></tr>
            <tr><td>Route middleware</td><td>Yes</td><td>Yes</td><td>No (loaders)</td><td>Hooks</td><td>n/a</td></tr>
            <tr><td>Server actions / mutations</td><td>Yes</td><td>Yes</td><td>Actions</td><td>Form actions</td><td>n/a</td></tr>
            <tr><td>SSR + streaming + static export</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>n/a</td></tr>
            <tr><td>Contract diff in CI</td><td>Yes (unique)</td><td>No</td><td>No</td><td>No</td><td>No</td></tr>
            <tr><td>Framework language</td><td>React</td><td>React</td><td>React</td><td>Svelte</td><td>Any</td></tr>
            <tr><td>Edge adapters</td><td>CF / Vercel / Node</td><td>Yes</td><td>Yes</td><td>Yes</td><td>n/a</td></tr>
          </tbody>
        </table>
      </div>

      <h2 id="next">vs Next.js</h2>
      <p>
        Next.js is the React default for a single app — App Router, RSC, a huge ecosystem. JORVEL
        borrows its routing conventions (segment <code>layout</code>/<code>loading</code>/
        <code>error</code>, middleware, actions) but trades RSC-everywhere for{' '}
        <strong>runtime federation</strong>: each remote is its own build, versioned and deployable
        without redeploying the host. Choose Next.js for one cohesive app; choose JORVEL when org
        boundaries (multiple teams / repos) cut through the UI.
      </p>

      <h2 id="remix">vs Remix</h2>
      <p>
        Remix nails web-fundamentals: loaders/actions on the platform, progressive enhancement.
        JORVEL shares that philosophy (<code>defineLoader</code> reads, <code>defineAction</code>{' '}
        mutations, a progressive-enhancement <code>&lt;Form&gt;</code>) and adds the federation layer
        Remix has no story for. If you don&apos;t need micro-frontends, Remix is a smaller surface.
      </p>

      <h2 id="sveltekit">vs SvelteKit</h2>
      <p>
        SvelteKit is excellent — but Svelte, not React. If your org is React-committed and needs
        federation, SvelteKit isn&apos;t in the running. If you&apos;re greenfield and value the
        smallest runtime, evaluate it on its own merits.
      </p>

      <h2 id="nx">vs Nx</h2>
      <p>
        Nx is a <em>build system / monorepo orchestrator</em>, not a framework — it can wire up
        Module Federation, but you assemble the runtime, routing, SSR, and security yourself. JORVEL
        is the opposite layer: the runtime + conventions. They compose — run JORVEL apps inside an
        Nx workspace if you want Nx&apos;s task graph and caching.
      </p>

      <Callout variant="warn" title="When NOT to use JORVEL">
        A single team shipping a single app pays the federation tax (multiple builds, a shared-deps
        contract, version skew) for benefits they won&apos;t use. Reach for Next.js or Remix there —
        and revisit JORVEL when a second team needs to own part of the UI.
      </Callout>

      <h2 id="turbopack-rspack">Turbopack vs Rspack (the bundler)</h2>
      <p>
        JORVEL builds on <strong>Rspack</strong> — a Rust bundler that&apos;s webpack-API-compatible,
        which is what makes runtime Module Federation work today. <strong>Turbopack</strong> (Next.js)
        is also Rust and very fast in dev, but it&apos;s coupled to Next and its Module Federation
        story is not first-class. Practical trade-offs:
      </p>
      <table>
        <thead><tr><th></th><th>Rspack (JORVEL)</th><th>Turbopack</th></tr></thead>
        <tbody>
          <tr><td>Module Federation</td><td>First-class (webpack-compatible <code>ModuleFederationPlugin</code>)</td><td>Limited / evolving</td></tr>
          <tr><td>Ecosystem</td><td>webpack loaders/plugins reusable</td><td>Next-specific</td></tr>
          <tr><td>Standalone use</td><td>Yes (any app)</td><td>Tied to Next.js</td></tr>
          <tr><td>Dev speed</td><td>Fast (Rust, persistent cache)</td><td>Fast (Rust)</td></tr>
        </tbody>
      </table>
      <p>
        For a federation-first framework, Rspack&apos;s webpack compatibility is the deciding factor —
        the entire MF plugin ecosystem works unchanged.
      </p>
    </>
  );
}
