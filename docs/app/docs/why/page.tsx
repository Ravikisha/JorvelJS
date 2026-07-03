import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Why we built JORVEL',
  description: 'The problem JORVEL solves, why runtime Module Federation, and what we deliberately left out.',
};

export default function Why() {
  return (
    <>
      <h1>Why we built JORVEL</h1>

      <h2 id="problem">The problem</h2>
      <p>
        Big frontends are built by many teams, but most React meta-frameworks assume{' '}
        <strong>one app, one deploy</strong>. When five teams share a codebase, a one-line change to
        the marketing page waits behind the checkout team&apos;s release. Module Federation fixes the
        deploy coupling — but raw MF is a webpack config, not a framework: you hand-roll routing,
        SSR, shared-dep contracts, security, and CI yourself.
      </p>
      <p>
        JORVEL is the missing layer: <strong>federation-first</strong> conventions with the DX of
        Next/Remix. Teams own remotes, ship on their own cadence, and the host composes them at
        runtime — with typed contracts, a CI diff gate, and version-skew warnings keeping the seams
        honest.
      </p>

      <h2 id="runtime-mf">Why runtime Module Federation</h2>
      <p>
        Build-time composition (Nx, module boundaries) still ships one artifact — a change anywhere
        rebuilds everything. Runtime federation loads each remote as an independent bundle from its
        own URL/CDN, so a remote deploys without touching the host. That&apos;s the whole point:{' '}
        <strong>independent deployability</strong>. We build on Rspack because its webpack-compatible{' '}
        <code>ModuleFederationPlugin</code> is the only mature, fast path to it today.
      </p>

      <h2 id="left-out">What we deliberately left out (for now)</h2>
      <ul>
        <li><strong>RSC everywhere</strong> — the MF + RSC wire format isn&apos;t stable upstream. We ship islands, streaming SSR, <code>use(promise)</code>, and hydratable server stores instead.</li>
        <li><strong>A bundled backend/ORM lock-in</strong> — <a href="/docs/database"><code>jorvel add db</code></a> scaffolds Drizzle, but loaders/actions/server-routes are BYO-backend on purpose.</li>
        <li><strong>A styling opinion</strong> — CSS Modules, Tailwind, and zero-runtime CSS-in-JS all work; we don&apos;t force one.</li>
      </ul>

      <Callout variant="info" title="The bet">
        Most frameworks optimize the single-app happy path and treat multi-team as an afterthought.
        JORVEL inverts that: independent deployability is the default, and single-app is just the
        one-remote case.
      </Callout>
    </>
  );
}
