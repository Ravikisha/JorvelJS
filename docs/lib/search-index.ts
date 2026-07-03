export interface SearchEntry {
  href: string;
  title: string;
  section: string;
  description: string;
  keywords: string[];
}

export const SEARCH_INDEX: SearchEntry[] = [
  // Resources
  {
    href: '/docs/comparison',
    title: 'JORVEL vs Next.js / Remix / SvelteKit / Nx',
    section: 'Resources',
    description: 'Where JORVEL fits — federation-first React meta-framework, honest comparison.',
    keywords: ['comparison', 'vs', 'next.js', 'nextjs', 'remix', 'sveltekit', 'nx', 'versus', 'alternative', 'which framework', 'federation'],
  },
  {
    href: '/docs/migration',
    title: 'Migration guides',
    section: 'Resources',
    description: 'Move from CRA + react-router, or from an existing Module Federation setup.',
    keywords: ['migration', 'migrate', 'cra', 'create react app', 'react-router', 'webpack', 'module federation', 'codemod', 'jorvel migrate', 'mfjs'],
  },
  {
    href: '/docs/recipes',
    title: 'Recipes / Cookbook',
    section: 'Resources',
    description: 'Lucia/Auth.js, SSO/SAML, kill-switch, mailer/cron, Edge KV, dark mode, tokens, CSS-in-JS.',
    keywords: ['recipe', 'cookbook', 'lucia', 'auth.js', 'authjs', 'sso', 'saml', 'kill-switch', 'circuit breaker', 'mailer', 'resend', 'cron', 'queue', 'upstash', 'edge kv', 'durable object', 'dark mode', 'theme', 'design tokens', 'css variables', 'css-in-js', 'vanilla-extract', 'panda'],
  },
  {
    href: '/docs/adapters',
    title: 'Deployment adapters',
    section: 'Production',
    description: 'Node, Vercel, Cloudflare, Bun, Deno, Netlify, AWS Lambda / Lambda@Edge adapters.',
    keywords: ['adapter', 'deploy', 'deployment', 'bun', 'deno', 'netlify', 'aws', 'lambda', 'lambda@edge', 'cloudflare', 'vercel', 'node', 'edge', 'ssr', 'serverless'],
  },
  {
    href: '/docs/roadmap',
    title: 'Roadmap',
    section: 'Resources',
    description: 'Shipped features + what is next; how to influence priorities.',
    keywords: ['roadmap', 'shipped', 'next', 'plans', 'future', 'rsc', 'ppr'],
  },
  {
    href: '/docs/showcase',
    title: 'Showcase',
    section: 'Resources',
    description: 'Apps and starters built with JORVEL; submit yours.',
    keywords: ['showcase', 'examples', 'starters', 'gallery', 'built with', 'stackblitz'],
  },
  {
    href: '/docs/why',
    title: 'Why we built JORVEL',
    section: 'Resources',
    description: 'The problem, why runtime Module Federation, what we left out.',
    keywords: ['why', 'motivation', 'philosophy', 'runtime module federation', 'independent deploy', 'essay'],
  },
  {
    href: '/docs/changelog',
    title: 'Changelog',
    section: 'Resources',
    description: 'Changesets release flow + where to read per-package changelogs.',
    keywords: ['changelog', 'changesets', 'release', 'versioning', 'semver', 'publish'],
  },
  {
    href: '/docs/press',
    title: 'Press kit',
    section: 'Resources',
    description: 'JORVEL logos, brand colors, and usage guidelines.',
    keywords: ['press', 'brand', 'logo', 'press kit', 'assets', 'colors', 'media', 'wordmark'],
  },
  {
    href: '/docs/api/i18n',
    title: '@jorvel/i18n API',
    section: 'API reference',
    description: 'formatMessage (ICU), locale routing, detection middleware, RTL, React bindings.',
    keywords: ['i18n api', 'formatMessage', 'locale', 'icu', 'rtl', 'negotiateLocale', 'localeMiddleware'],
  },
  {
    href: '/docs/api/ui',
    title: '@jorvel/ui API',
    section: 'API reference',
    description: 'Button, Input, Card, Modal, Toast, ThemeProvider.',
    keywords: ['ui api', 'button', 'input', 'modal', 'toast', 'card', 'theme', 'components'],
  },
  {
    href: '/docs/api/adapters',
    title: 'Adapter APIs',
    section: 'API reference',
    description: 'Entry points for Node, Vercel, Cloudflare, Bun, Deno, Netlify, AWS adapters.',
    keywords: ['adapter api', 'createNodeHandler', 'createBunHandler', 'createDenoHandler', 'createLambdaHandler', 'createNetlifyHandler'],
  },
  // Get started
  {
    href: '/docs/getting-started',
    title: 'Getting started',
    section: 'Get started',
    description: 'Install the CLI, scaffold a workspace, run host + remote in dev.',
    keywords: ['install', 'init', 'scaffold', 'quickstart', 'setup', 'npx', 'create', 'new project'],
  },
  {
    href: '/docs/concepts',
    title: 'Core concepts',
    section: 'Get started',
    description: 'Host vs remote, federation contracts, runtime, routing model.',
    keywords: ['host', 'remote', 'shell', 'contract', 'architecture', 'overview', 'mental model'],
  },
  {
    href: '/docs/cli',
    title: 'CLI reference',
    section: 'Get started',
    description: 'jorvel init, generate, dev, build, federation, routes, ssr, deploy.',
    keywords: ['cli', 'command', 'init', 'generate', 'dev', 'build', 'deploy', 'federation', 'scaffold', 'analyze', 'diagnose', 'config', 'jorvel.config.json', 'appsdir', 'workspace config'],
  },

  // Core
  {
    href: '/docs/routing',
    title: 'Routing',
    section: 'Core',
    description: 'File-based routes, navigation, params, layouts.',
    keywords: ['route', 'router', 'navigation', 'link', 'params', 'pages', 'file-based'],
  },
  {
    href: '/docs/nested-routes',
    title: 'Nested routes',
    section: 'Core',
    description: 'Layouts, child routes, outlets, per-segment loading.tsx & error.tsx.',
    keywords: ['nested', 'layout', 'outlet', 'child route', 'parent', 'loading.tsx', 'error.tsx', 'loading', 'error boundary', 'per-segment', 'suspense'],
  },
  {
    href: '/docs/middleware',
    title: 'Middleware',
    section: 'Core',
    description: 'Route middleware for auth gating, redirects, rewrites, A/B — edge, server, client.',
    keywords: ['middleware', 'middleware.ts', 'auth', 'gate', 'redirect', 'rewrite', 'geo', 'a/b', 'edge', 'guard', 'runMiddleware', 'defineMiddleware'],
  },
  {
    href: '/docs/actions',
    title: 'Loaders & server actions',
    section: 'Core',
    description: 'defineLoader (reads), defineAction (mutations), useAction & useFormAction.',
    keywords: ['action', 'server action', 'mutation', 'defineAction', 'defineLoader', 'loader', 'useAction', 'useFormAction', 'form', 'useActionState', 'progressive enhancement', 'data fetching', 'revalidate', 'revalidateTag', 'revalidatePath', 'cache tag', 'invalidate', 'optimistic', 'useOptimistic', 'usequery', 'useQuery', 'useMutation', 'QueryClient', 'tanstack', 'react-query', 'swr', 'query cache'],
  },
  {
    href: '/docs/forms',
    title: 'Forms & CSRF',
    section: 'Core',
    description: 'Progressive-enhancement <Form> bound to a server action + signed double-submit CSRF.',
    keywords: ['form', 'Form', 'csrf', 'double-submit', 'issueCsrfToken', 'verifyCsrf', 'progressive enhancement', 'FormData', 'hidden field', 'mutation', 'security'],
  },
  {
    href: '/docs/database',
    title: 'Database & backend',
    section: 'Core',
    description: 'jorvel add db scaffolds Drizzle ORM (SQLite/libsql) — schema, client, migrations, loader.',
    keywords: ['database', 'db', 'drizzle', 'orm', 'sqlite', 'better-sqlite3', 'libsql', 'turso', 'jorvel add db', 'migration', 'drizzle-kit', 'schema', 'backend', 'sql'],
  },
  {
    href: '/docs/auth',
    title: 'Authentication',
    section: 'Production',
    description: 'Signed-cookie sessions (getSession/requireUser), middleware gating, OAuth presets.',
    keywords: ['auth', 'authentication', 'session', 'getSession', 'requireUser', 'SessionManager', 'cookie', 'login', 'oauth', 'pkce', 'github', 'google', 'microsoft', 'jwt', 'middleware gate', 'rbac'],
  },
  {
    href: '/docs/testing',
    title: 'Testing',
    section: 'Production',
    description: 'Vitest + React Testing Library scaffolded in every app, with a real render test.',
    keywords: ['testing', 'test', 'vitest', 'react testing library', 'rtl', 'jest-dom', 'jsdom', 'render', 'coverage', 'user-event', 'contract test', 'setupFiles'],
  },
  {
    href: '/docs/typed-routes',
    title: 'Typed routes',
    section: 'Core',
    description: 'Type-safe links and params generated from your routes.',
    keywords: ['typescript', 'typed', 'type-safe', 'codegen', 'route types', 'autocomplete'],
  },
  {
    href: '/docs/view-transitions',
    title: 'View transitions',
    section: 'Core',
    description: 'Cross-fade and morph between routes via View Transitions API.',
    keywords: ['transition', 'animation', 'view transitions', 'morph', 'cross-fade', 'navigation animation'],
  },
  {
    href: '/docs/prefetch',
    title: 'Prefetch on hover',
    section: 'Core',
    description: 'Preload remote chunks and data on link hover or viewport.',
    keywords: ['prefetch', 'preload', 'hover', 'intersection', 'lazy', 'performance'],
  },
  {
    href: '/docs/concurrent-preload',
    title: 'Concurrent preload',
    section: 'Core',
    description: 'Parallel remote container init for faster first nav.',
    keywords: ['concurrent', 'parallel', 'preload', 'remote container', 'startup', 'cold start'],
  },
  {
    href: '/docs/federation',
    title: 'Module Federation',
    section: 'Core',
    description: 'Rspack Module Federation config, exposes, shared, remotes.',
    keywords: ['federation', 'module federation', 'rspack', 'webpack', 'remote', 'expose', 'shared', 'singleton'],
  },
  {
    href: '/docs/state',
    title: 'State & event bus',
    section: 'Core',
    description: 'Shared store, atoms, cross-remote events, typed event bus.',
    keywords: ['state', 'store', 'atom', 'atoms', 'jotai', 'useAtom', 'derivedAtom', 'event bus', 'pubsub', 'broadcast', 'communication', 'cross-remote', 'zustand'],
  },
  {
    href: '/docs/i18n',
    title: 'Internationalization',
    section: 'Core',
    description: 'ICU-lite messages, lazy catalogs, locale detection, shared singleton across MFEs.',
    keywords: ['i18n', 'internationalization', 'localization', 'l10n', 'locale', 'translate', 'translation', 'plural', 'icu', 'geti18n', 'singleton', 'accept-language', 'detectlocale'],
  },
  {
    href: '/docs/ssr',
    title: 'SSR & static export',
    section: 'Core',
    description: 'Server rendering, streaming, SSG, edge adapters.',
    keywords: ['ssr', 'server side rendering', 'static', 'ssg', 'streaming', 'edge', 'hydration', 'node', 'cloudflare', 'vercel', 'edge-light', 'worker', 'export conditions'],
  },
  {
    href: '/docs/islands',
    title: 'Islands hydration',
    section: 'Core',
    description: 'Selective hydration of interactive islands for low JS.',
    keywords: ['islands', 'hydration', 'partial', 'selective', 'interactive', 'astro-like'],
  },

  // Runtime extras
  {
    href: '/docs/css-isolation',
    title: 'CSS isolation (Shadow DOM)',
    section: 'Runtime extras',
    description: 'Scope remote styles with Shadow DOM to prevent leaks.',
    keywords: ['css', 'shadow dom', 'isolation', 'scoped styles', 'encapsulation', 'leak'],
  },
  {
    href: '/docs/service-worker',
    title: 'Service Worker',
    section: 'Runtime extras',
    description: 'Offline, caching, background sync for federated apps.',
    keywords: ['service worker', 'sw', 'offline', 'cache', 'pwa', 'workbox'],
  },

  // Production
  {
    href: '/docs/security',
    title: 'Security',
    section: 'Production',
    description: 'CSP, SRI, allowlist, sanitize, rate limit, audit.',
    keywords: ['security', 'csp', 'content security policy', 'sri', 'subresource integrity', 'allowlist', 'sanitize', 'xss', 'rate limit', 'audit', 'requireintegrity', 'integrity enforcement', 'fail closed'],
  },
  {
    href: '/docs/observability',
    title: 'Observability',
    section: 'Production',
    description: 'Logger, OTEL adapter, Sentry, fingerprint, hooks.',
    keywords: ['observability', 'logging', 'logger', 'otel', 'opentelemetry', 'sentry', 'tracing', 'metrics', 'monitoring'],
  },
  {
    href: '/docs/deployment',
    title: 'Deployment',
    section: 'Production',
    description: 'Deploy to Node, Vercel, Cloudflare, static hosts.',
    keywords: ['deploy', 'deployment', 'production', 'vercel', 'cloudflare', 'node', 'docker', 'host'],
  },
  {
    href: '/docs/production-checklist',
    title: 'Production checklist',
    section: 'Production',
    description: 'Pre-launch checklist: perf, security, observability, CI.',
    keywords: ['checklist', 'production', 'launch', 'audit', 'go-live', 'readiness'],
  },
  {
    href: '/docs/troubleshooting',
    title: 'Troubleshooting',
    section: 'Production',
    description: 'Common errors, share scope issues, hydration mismatches.',
    keywords: ['troubleshoot', 'error', 'debug', 'share scope', 'hydration mismatch', 'fix', 'problem'],
  },

  // API reference
  {
    href: '/docs/api/runtime',
    title: '@jorvel/runtime',
    section: 'API reference',
    description: 'Router, RemoteOutlet, hooks, remote loader, guards.',
    keywords: ['runtime', 'api', 'router', 'remoteoutlet', 'hooks', 'guards', 'useremote'],
  },
  {
    href: '/docs/api/ssr',
    title: '@jorvel/ssr',
    section: 'API reference',
    description: 'renderToString, renderToStream, edge adapter, static export.',
    keywords: ['ssr', 'api', 'rendertostring', 'rendertostream', 'edge', 'adapter', 'static export'],
  },
  {
    href: '/docs/api/security',
    title: '@jorvel/security',
    section: 'API reference',
    description: 'CSP builder, SRI helper, sanitize, allowlist, rate limit.',
    keywords: ['security api', 'csp', 'sri', 'sanitize', 'allowlist', 'rate limit', 'audit'],
  },
  {
    href: '/docs/api/observability',
    title: '@jorvel/observability',
    section: 'API reference',
    description: 'Logger, adapters (console/otel/sentry), fingerprint, hooks.',
    keywords: ['observability api', 'logger', 'otel', 'sentry', 'fingerprint', 'adapters'],
  },
  {
    href: '/docs/api/state',
    title: '@jorvel/state',
    section: 'API reference',
    description: 'Store, devtools, persist, middleware, React bindings.',
    keywords: ['state api', 'store', 'devtools', 'persist', 'middleware', 'react'],
  },
  {
    href: '/docs/api/event-bus',
    title: '@jorvel/event-bus',
    section: 'API reference',
    description: 'Typed event bus, broadcast channel, schema validation.',
    keywords: ['event bus', 'pubsub', 'broadcast', 'schema', 'typed events', 'channel'],
  },
];

export interface SearchResult extends SearchEntry {
  score: number;
}

export function searchDocs(query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const entry of SEARCH_INDEX) {
    const title = entry.title.toLowerCase();
    const desc = entry.description.toLowerCase();
    const section = entry.section.toLowerCase();
    const kw = entry.keywords.join(' ').toLowerCase();
    const haystack = `${title} ${desc} ${section} ${kw}`;

    let score = 0;
    let allTokensMatched = true;

    for (const t of tokens) {
      if (title === t) score += 100;
      else if (title.startsWith(t)) score += 60;
      else if (title.includes(t)) score += 40;
      else if (entry.keywords.some((k) => k.toLowerCase() === t)) score += 35;
      else if (kw.includes(t)) score += 20;
      else if (desc.includes(t)) score += 10;
      else if (section.includes(t)) score += 5;
      else if (haystack.includes(t)) score += 3;
      else {
        allTokensMatched = false;
        break;
      }
    }

    if (allTokensMatched && score > 0) {
      results.push({ ...entry, score });
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return results.slice(0, limit);
}
