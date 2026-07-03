import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Roadmap',
  description: 'What JORVEL ships today, what is next, and how to influence priorities.',
};

const SHIPPED = [
  'Two-tier router + nested routes with per-segment loading.tsx / error.tsx',
  'Route middleware (defineMiddleware / runMiddleware)',
  'Server actions (defineAction) + <Form> + CSRF',
  'Loaders (defineLoader), useQuery / useMutation (TanStack-style), cache tags + revalidation, useOptimistic, use(promise)',
  'Sessions + RBAC + OAuth presets; multipart uploads; input validation',
  'SSR + streaming + static export + request-time ISR (serveWithISR)',
  'Federation contract diff (CI gate) + jorvel canary + weighted/blue-green + registry',
  'Deployment adapters: Node, Vercel, Cloudflare, Bun, Deno, Netlify, AWS Lambda / Lambda@Edge',
  'i18n: locale routing, detection middleware, RTL, full ICU MessageFormat',
  'Observability: Web Vitals + dashboard, traceparent, analytics adapters, source-map upload, session replay',
  'State: stores, selectors, atoms, RSC-compatible server store',
  'create-jorvel + interactive init; jorvel add db (Drizzle); Storybook / testing scaffolds',
];

const NEXT = [
  'React Server Components (pending stable Rspack MF support)',
  'Partial Prerendering (streaming static shell + dynamic holes)',
  'MSW integration in generated tests',
  'Visual-regression (Playwright/Chromatic) preset',
  'Prisma / Kysely / tRPC options for `jorvel add db`',
  'Magic-link / passkey auth example',
];

export default function Roadmap() {
  return (
    <>
      <h1>Roadmap</h1>
      <p>
        JORVEL is developed in the open. This page tracks the big rocks; discuss priorities in{' '}
        <a href="https://github.com/Ravikisha/JorvelJS/discussions">GitHub Discussions</a>.
      </p>

      <h2 id="shipped">Shipped</h2>
      <ul>{SHIPPED.map((s) => <li key={s}>{s}</li>)}</ul>

      <h2 id="next">Next</h2>
      <ul>{NEXT.map((s) => <li key={s}>{s}</li>)}</ul>

      <Callout variant="info" title="Influence it">
        Open a <a href="https://github.com/Ravikisha/JorvelJS/discussions">Discussion</a> or vote on
        an issue — priorities follow real usage. Breaking changes ship behind a major and are called
        out by <code>jorvel federation diff</code>.
      </Callout>
    </>
  );
}
