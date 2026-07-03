export const metadata = {
  title: 'API reference',
  description: 'Per-package API reference for the JORVEL libraries.',
};

const PACKAGES: { href: string; name: string; blurb: string }[] = [
  { href: '/docs/api/runtime', name: '@jorvel/runtime', blurb: 'Router, remote loader, hooks, guards, telemetry, islands, Shadow DOM.' },
  { href: '/docs/api/ssr', name: '@jorvel/ssr', blurb: 'Edge adapter, streaming/string render, static export, loaders, fragments.' },
  { href: '/docs/api/security', name: '@jorvel/security', blurb: 'CSP builder, nonces, SRI, remote allowlist, sanitization, rate limiting.' },
  { href: '/docs/api/observability', name: '@jorvel/observability', blurb: 'Metric/error/remote-load hooks, RUM, web-vitals, OpenTelemetry adapter.' },
  { href: '/docs/api/state', name: '@jorvel/state', blurb: 'Store + SimpleStore, React bindings, persist, devtools, middleware.' },
  { href: '/docs/api/event-bus', name: '@jorvel/event-bus', blurb: 'Typed cross-MFE event bus, wildcard/replay/once, schema registry, cross-tab.' },
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
