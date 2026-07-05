export const metadata = {
  title: 'API reference',
  description: 'Per-package API reference for the JORVEL libraries.',
};

const PACKAGES: { href: string; name: string; blurb: string }[] = [
  { href: '/docs/api/runtime', name: '@jorvel/runtime', blurb: 'Router, remote loader, hooks, guards, telemetry, islands, Shadow DOM.' },
  { href: '/docs/api/ssr', name: '@jorvel/ssr', blurb: 'Edge adapter, streaming/string render, static export, loaders, fragments.' },
  { href: '/docs/api/security', name: '@jorvel/security', blurb: 'CSP builder, nonces, SRI, remote allowlist, sanitization, rate limiting.' },
  { href: '/docs/api/observability', name: '@jorvel/observability', blurb: 'Metric/error/remote-load hooks, RUM, web-vitals, OpenTelemetry adapter.' },
  { href: '/docs/api/state', name: '@jorvel/state', blurb: 'Store + SimpleStore, atoms, server store, React bindings, persist, devtools.' },
  { href: '/docs/api/i18n', name: '@jorvel/i18n', blurb: 'formatMessage (ICU), locale routing + detection middleware, RTL, React bindings.' },
  { href: '/docs/api/ui', name: '@jorvel/ui', blurb: 'Button, Input, Card, Modal, Toast, ThemeProvider.' },
  { href: '/docs/api/event-bus', name: '@jorvel/event-bus', blurb: 'Typed cross-MFE event bus, wildcard/replay/once, schema registry, cross-tab.' },
  { href: '/docs/api/events', name: '@jorvel/events', blurb: 'Shared event-contract type map (MfAppEvents) for host + remotes.' },
  { href: '/docs/api/types', name: '@jorvel/types', blurb: 'Federation contract DSL, config types, redirect matchers, contract tests, JSON schemas.' },
  { href: '/docs/api/rspack-route-assets', name: '@jorvel/rspack-route-assets', blurb: 'Rspack plugin emitting a per-route asset manifest for preloading.' },
  { href: '/docs/api/adapters', name: 'Adapters', blurb: 'Node · Vercel · Cloudflare · Bun · Deno · Netlify · AWS Lambda / Lambda@Edge.' },
  { href: '/docs/api/config', name: 'Shared configs', blurb: '@jorvel/eslint-config, prettier-config, tsconfig presets.' },
];

export default function ApiIndex() {
  return (
    <>
      <h1>API reference</h1>
      <p>
        Full, per-package API surface for the JORVEL libraries. Pick a package below — every export
        is importable from its <code>@jorvel/*</code> entry point.
      </p>
      <ul>
        {PACKAGES.map((p) => (
          <li key={p.href}>
            <a href={p.href}>
              <code>{p.name}</code>
            </a>{' '}
            — {p.blurb}
          </li>
        ))}
      </ul>
    </>
  );
}
