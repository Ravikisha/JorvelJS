export interface DocSection {
  title: string;
  links: DocLink[];
}

export interface DocLink {
  href: string;
  label: string;
}

export const DOC_NAV: DocSection[] = [
  {
    title: 'Get started',
    links: [
      { href: '/docs/getting-started', label: 'Getting started' },
      { href: '/docs/tutorial', label: 'Tutorial' },
      { href: '/docs/concepts', label: 'Concepts' },
      { href: '/docs/architecture', label: 'Architecture' },
      { href: '/docs/cli', label: 'CLI reference' },
    ],
  },
  {
    title: 'Core',
    links: [
      { href: '/docs/routing', label: 'Routing' },
      { href: '/docs/nested-routes', label: 'Nested routes' },
      { href: '/docs/middleware', label: 'Middleware' },
      { href: '/docs/actions', label: 'Loaders & actions' },
      { href: '/docs/forms', label: 'Forms & CSRF' },
      { href: '/docs/database', label: 'Database & backend' },
      { href: '/docs/typed-routes', label: 'Typed routes' },
      { href: '/docs/view-transitions', label: 'View transitions' },
      { href: '/docs/prefetch', label: 'Prefetch on hover' },
      { href: '/docs/concurrent-preload', label: 'Concurrent preload' },
      { href: '/docs/federation', label: 'Module Federation' },
      { href: '/docs/cross-framework', label: 'Cross-framework remotes' },
      { href: '/docs/polyglot', label: 'Polyglot monorepo' },
      { href: '/docs/state', label: 'State & event bus' },
      { href: '/docs/i18n', label: 'Internationalization' },
      { href: '/docs/ssr', label: 'SSR & static export' },
      { href: '/docs/islands', label: 'Islands hydration' },
    ],
  },
  {
    title: 'Runtime extras',
    links: [
      { href: '/docs/ui', label: 'UI primitives' },
      { href: '/docs/css-isolation', label: 'CSS isolation (Shadow DOM)' },
      { href: '/docs/image', label: 'Image optimization' },
      { href: '/docs/fonts', label: 'Font optimization' },
      { href: '/docs/service-worker', label: 'Service Worker' },
    ],
  },
  {
    title: 'Production',
    links: [
      { href: '/docs/security', label: 'Security' },
      { href: '/docs/auth', label: 'Authentication' },
      { href: '/docs/testing', label: 'Testing' },
      { href: '/docs/observability', label: 'Observability' },
      { href: '/docs/error-pages', label: 'Error & 404 pages' },
      { href: '/docs/deployment', label: 'Deployment' },
      { href: '/docs/adapters', label: 'Deployment adapters' },
      { href: '/docs/production-checklist', label: 'Production checklist' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/docs/comparison', label: 'vs Next / Remix / Nx' },
      { href: '/docs/migration', label: 'Migration guides' },
      { href: '/docs/recipes', label: 'Recipes / Cookbook' },
      { href: '/docs/ai-tools', label: 'AI coding tools' },
      { href: '/docs/roadmap', label: 'Roadmap' },
      { href: '/docs/showcase', label: 'Showcase' },
      { href: '/docs/why', label: 'Why JORVEL' },
      { href: '/docs/changelog', label: 'Changelog' },
      { href: '/docs/press', label: 'Press kit' },
    ],
  },
  {
    title: 'API reference',
    links: [
      { href: '/docs/api', label: 'Overview' },
      { href: '/docs/api/runtime', label: '@jorvel/runtime' },
      { href: '/docs/api/ssr', label: '@jorvel/ssr' },
      { href: '/docs/api/security', label: '@jorvel/security' },
      { href: '/docs/api/observability', label: '@jorvel/observability' },
      { href: '/docs/api/state', label: '@jorvel/state' },
      { href: '/docs/api/i18n', label: '@jorvel/i18n' },
      { href: '/docs/api/ui', label: '@jorvel/ui' },
      { href: '/docs/api/event-bus', label: '@jorvel/event-bus' },
      { href: '/docs/api/events', label: '@jorvel/events' },
      { href: '/docs/api/types', label: '@jorvel/types' },
      { href: '/docs/api/rspack-route-assets', label: '@jorvel/rspack-route-assets' },
      { href: '/docs/api/adapters', label: 'Adapters' },
      { href: '/docs/api/config', label: 'Shared configs' },
    ],
  },
];
