<p align="center">
  <img src="logo/logojorvel.png" alt="JORVEL" width="160" height="160">
</p>

<h1 align="center">JORVEL</h1>

<p align="center">
  <strong>Opinionated micro-frontend framework + tooling built on Rspack Module Federation.</strong>
</p>

<p align="center">
  <a href="https://jorveljs.vercel.app/">Website</a> ·
  <a href="https://jorveljs.vercel.app/docs">Docs</a> ·
  <a href="https://jorveljs.vercel.app/docs/getting-started">Quickstart</a> ·
  <a href="https://github.com/Ravikisha/JorvelJS">GitHub</a> ·
  <a href="https://github.com/Ravikisha/JorvelJS/issues">Issues</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/jorvel"><img alt="npm jorvel" src="https://img.shields.io/npm/v/jorvel?label=%40jorvel%2Fcli&color=cb3837&logo=npm"></a>
  <a href="https://www.npmjs.com/package/@jorvel/runtime"><img alt="npm @jorvel/runtime" src="https://img.shields.io/npm/v/@jorvel/runtime?label=%40jorvel%2Fruntime&color=cb3837&logo=npm"></a>
  <a href="https://www.npmjs.com/package/@jorvel/ssr"><img alt="npm @jorvel/ssr" src="https://img.shields.io/npm/v/@jorvel/ssr?label=%40jorvel%2Fssr&color=cb3837&logo=npm"></a>
  <a href="https://github.com/Ravikisha/JorvelJS/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/Ravikisha/JorvelJS?color=blue"></a>
  <a href="https://github.com/Ravikisha/JorvelJS/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Ravikisha/JorvelJS?style=social"></a>
  <a href="https://github.com/Ravikisha/JorvelJS/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/Ravikisha/JorvelJS"></a>
  <a href="https://github.com/Ravikisha/JorvelJS/pulls"><img alt="GitHub PRs" src="https://img.shields.io/github/issues-pr/Ravikisha/JorvelJS"></a>
  <a href="https://github.com/Ravikisha/JorvelJS/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/Ravikisha/JorvelJS"></a>
  <br>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-43853d?logo=node.js&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-9.15+-f69220?logo=pnpm&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Rspack" src="https://img.shields.io/badge/rspack-1.7+-orange">
  <img alt="React" src="https://img.shields.io/badge/react-18%20%7C%2019-61dafb?logo=react&logoColor=white">
  <a href="https://jorveljs.vercel.app/"><img alt="Live" src="https://img.shields.io/badge/live-jorveljs.vercel.app-000?logo=vercel"></a>
</p>

---

## Why JORVEL?

Micro-frontends solve a real problem — independent teams shipping independent frontends on independent cadences — but the tooling around them is fragmented. JORVEL bundles the missing pieces into one opinionated framework:

- **Module Federation, configured for you.** Rspack `ModuleFederationPlugin` with React-singleton sharing, SRI, allowlists, CDN-aware public-path — plus a `jorvel federation diff` CI gate, `impact` analysis, and `canary` rollouts.
- **A real router.** Two-tier (host owns prefixes, remotes own sub-paths), file-based, typed, guarded, prefetch-aware, with per-segment `loading`/`error`, parallel routes/slots, route middleware, and typed search params. No `react-router` dependency.
- **Data, forms & auth.** `defineLoader` + `defineAction`, `useQuery`/`useMutation` (TanStack-style), `useOptimistic`, `use(promise)`; a progressive-enhancement `<Form>` with CSRF; signed-cookie sessions, RBAC, and OAuth presets; `jorvel add db` scaffolds Drizzle.
- **SSR + SSG + ISR + Edge.** Render to string, stream to a `ReadableStream`, static export, request-time ISR — deploy to Vercel / Cloudflare / Node / Docker / Bun / Deno / Netlify / AWS Lambda / GitHub Pages.
- **A production toolbelt.** CSP builder, SRI, policy-header presets, rate limiter, audit log, W3C traceparent, analytics + log-drain adapters, Web Vitals dashboard — all edge-runtime safe.
- **Cross-app primitives.** Event bus with typed schemas, shared state + Jotai-style atoms + hydratable server stores, i18n with full ICU + locale routing + RTL.
- **A CLI that scaffolds the whole thing.** `npm create jorvel` → workspace + CI (CodeQL, gitleaks, Lighthouse, bundle-size, contract tests) + Husky + Changesets + ESLint + Vitest + RTL + MSW + Playwright in one go.

> **Live demo + full docs:** **<https://jorveljs.vercel.app/>**

---

## Install

All packages live under the [`@jorvel`](https://www.npmjs.com/org/jorvel) scope on npm.

```sh
# Scaffold a workspace (recommended)
npm create jorvel@latest my-app
# pnpm create jorvel my-app · yarn create jorvel my-app · bun create jorvel my-app
# or: pnpm dlx jorvel@latest init my-app

# Or install per-package
pnpm add @jorvel/runtime @jorvel/ssr @jorvel/security
pnpm add -D jorvel @jorvel/types @jorvel/tsconfig @jorvel/eslint-config @jorvel/prettier-config
```

Full package index → <https://www.npmjs.com/org/jorvel>.

## Quickstart

```sh
# 1. Scaffold a workspace
pnpm dlx jorvel@latest init my-app
cd my-app

# 2. Generate host + remote
jorvel generate host shell --port 3000
jorvel generate remote dashboard --port 3001
jorvel federation             # wire host → remote
# jorvel add db                # optional: Drizzle backend
# jorvel generate storybook    # optional: Storybook

# 3. Run dev server (same-origin remotes + HMR)
jorvel dev --proxy-remotes --hmr-remotes
```

Open <http://localhost:3000>. Drop a file in `apps/dashboard/src/pages/` and `jorvel routes` picks it up.

### With Tailwind

```sh
jorvel init my-app --tailwind
# or per app:
jorvel generate host shell --tailwind
jorvel generate remote dashboard --tailwind
```

---

## Monorepo layout

| Path | Package | Purpose |
|---|---|---|
| `packages/cli` | [`jorvel`](https://www.npmjs.com/package/jorvel) | `jorvel` CLI — init / generate / add / dev / build / federation (diff·impact·canary) / routes / deploy / diagnose / info / SSR |
| `packages/create-jorvel` | [`create-jorvel`](https://www.npmjs.com/package/create-jorvel) | `npm create jorvel` scaffolder |
| `packages/devtools-extension` | [`@jorvel/devtools-extension`](https://www.npmjs.com/package/@jorvel/devtools-extension) | Chrome/Firefox DevTools panel for federation state |
| `libs/runtime` | [`@jorvel/runtime`](https://www.npmjs.com/package/@jorvel/runtime) | Router, routing components, hooks, remote loader, prefetch, islands, View Transitions, Shadow DOM, image, fonts |
| `libs/mount` | [`@jorvel/mount`](https://www.npmjs.com/package/@jorvel/mount) | Framework-neutral remote mount contract (`mount(ctx)`/`unmount`) — embed remotes built with any framework |
| `libs/adapter-react` | [`@jorvel/adapter-react`](https://www.npmjs.com/package/@jorvel/adapter-react) | Expose a React remote as a neutral mount module (`defineReactRemote`) |
| `libs/adapter-vue` | [`@jorvel/adapter-vue`](https://www.npmjs.com/package/@jorvel/adapter-vue) | Expose a Vue 3 remote (`defineVueRemote`) |
| `libs/adapter-solid` | [`@jorvel/adapter-solid`](https://www.npmjs.com/package/@jorvel/adapter-solid) | Expose a SolidJS remote (`defineSolidRemote`) |
| `libs/adapter-svelte` | [`@jorvel/adapter-svelte`](https://www.npmjs.com/package/@jorvel/adapter-svelte) | Expose a Svelte 5 remote (`defineSvelteRemote`) |
| `libs/adapter-angular` | [`@jorvel/adapter-angular`](https://www.npmjs.com/package/@jorvel/adapter-angular) | Expose a standalone Angular component (`defineAngularRemote`) |
| `libs/ssr` | [`@jorvel/ssr`](https://www.npmjs.com/package/@jorvel/ssr) | `renderRouteToString`, streaming SSR, static export, edge adapter, loaders, fragments, request context |
| `libs/security` | [`@jorvel/security`](https://www.npmjs.com/package/@jorvel/security) | CSP, SRI, origin allowlist, rate limit, audit log, OAuth helpers, sanitize |
| `libs/observability` | [`@jorvel/observability`](https://www.npmjs.com/package/@jorvel/observability) | Hooks, structured logger, Web Vitals, Sentry / OTel / console adapters, RUM beacon |
| `libs/state` | [`@jorvel/state`](https://www.npmjs.com/package/@jorvel/state) | Simple store, reducer store, selectors, middleware, devtools |
| `libs/event-bus` | [`@jorvel/event-bus`](https://www.npmjs.com/package/@jorvel/event-bus) | Typed pub/sub, replay, schema validation, cross-tab broadcast |
| `libs/i18n` | [`@jorvel/i18n`](https://www.npmjs.com/package/@jorvel/i18n) | ICU-lite interpolation, lazy catalogs, locale detection |
| `libs/ui` | [`@jorvel/ui`](https://www.npmjs.com/package/@jorvel/ui) | Headless-ish primitives — Button, Input, Modal, Toast, Card, ThemeProvider |
| `libs/adapter-vercel` | [`@jorvel/adapter-vercel`](https://www.npmjs.com/package/@jorvel/adapter-vercel) | Vercel Edge handler factory |
| `libs/adapter-cloudflare` | [`@jorvel/adapter-cloudflare`](https://www.npmjs.com/package/@jorvel/adapter-cloudflare) | Cloudflare Workers / Pages handler |
| `libs/adapter-node` | [`@jorvel/adapter-node`](https://www.npmjs.com/package/@jorvel/adapter-node) | Hardened Node server |
| `libs/adapter-bun` | [`@jorvel/adapter-bun`](https://www.npmjs.com/package/@jorvel/adapter-bun) | Bun.serve handler + static assets |
| `libs/adapter-deno` | [`@jorvel/adapter-deno`](https://www.npmjs.com/package/@jorvel/adapter-deno) | Deno Deploy handler |
| `libs/adapter-netlify` | [`@jorvel/adapter-netlify`](https://www.npmjs.com/package/@jorvel/adapter-netlify) | Netlify Functions / Edge handler |
| `libs/adapter-aws-lambda` | [`@jorvel/adapter-aws-lambda`](https://www.npmjs.com/package/@jorvel/adapter-aws-lambda) | API Gateway v2 + Lambda@Edge |
| `libs/types` | [`@jorvel/types`](https://www.npmjs.com/package/@jorvel/types) | Shared types + federation contract DSL + JSON Schemas |
| `libs/events` | [`@jorvel/events`](https://www.npmjs.com/package/@jorvel/events) | Shared event-name + payload registry |
| `libs/rspack-route-assets` | [`@jorvel/rspack-route-assets`](https://www.npmjs.com/package/@jorvel/rspack-route-assets) | Per-route asset manifest plugin |
| `libs/eslint-config` | [`@jorvel/eslint-config`](https://www.npmjs.com/package/@jorvel/eslint-config) | Shared ESLint 9 flat config |
| `libs/prettier-config` | [`@jorvel/prettier-config`](https://www.npmjs.com/package/@jorvel/prettier-config) | Shared Prettier config |
| `libs/tsconfig` | [`@jorvel/tsconfig`](https://www.npmjs.com/package/@jorvel/tsconfig) | Shared TypeScript presets |
| `docs/` | — | Documentation site (Next.js 16) |
| `examples/*` | — | 7 Tailwind-styled examples: vanilla .mjs, React, polyglot (React+Vue+Angular), SSR, feature tour, all-libraries, shadcn/ui |

---

## Feature tour

### Routing — two-tier, History API native

```tsx
// shell/src/bootstrap.tsx
import { NavLink, RemoteOutlet, getRouter } from '@jorvel/runtime';
import type { RouteTarget } from '@jorvel/runtime';

const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

const REMOTES = { dashboard: () => import('dashboard/App') };

getRouter();  // singleton, StrictMode-safe

export default function App() {
  return (
    <>
      <header>
        <NavLink to="/" label="Home" />
        <NavLink to="/dashboard/settings" label="Settings" prefetch />
      </header>
      <main>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </>
  );
}
```

File-based pages in remotes:

| File | Route |
|---|---|
| `src/pages/index.tsx` | `/` |
| `src/pages/settings.tsx` | `/settings` |
| `src/pages/users/[id].tsx` | `/users/:id` |
| `src/pages/(marketing)/about.tsx` | `/about` (group) |

Run `jorvel routes` (or `jorvel routes --watch`) to generate `src/jorvel.routes.ts`.

### Federation — Rspack Module Federation, sane defaults

- Host sets `eager: true` on shared React, remote sets `eager: false`.
- Auto-detection: `jorvel federation` reads `jorvel.app.json` and infers exposes + shared.
- SRI: `federation.sri.algo = "sha384"` on every `remoteEntry.js`.
- Origin allowlist with `*` / `**` wildcards.

### Data, forms & auth

```tsx
import { defineAction, useAction, useQuery, useOptimistic, Form } from '@jorvel/runtime';
import { SessionManager, createRbac, issueCsrfToken, verifyCsrf } from '@jorvel/security';

// reads (client cache, SWR)  ·  writes (mutations)
const { data } = useQuery({ queryKey: ['todos'], queryFn: () => fetch('/api/todos').then(r => r.json()) });
const create = defineAction(async (fd: FormData) => fetch('/api/todos', { method: 'POST', body: fd }));

// progressive-enhancement form with CSRF
<Form action={create} csrf={{ token }}>{(s) => <button disabled={s.pending}>Add</button>}</Form>

// auth: signed-cookie session + RBAC
const sessions = new SessionManager({ secret: process.env.SESSION_SECRET! });
const user = await sessions.requireUser(request);       // throws 401 if absent
createRbac({ roles: { admin: ['*'] } }).requirePermission(user.roles, 'posts:write');
```

- **Loaders/actions** — `defineLoader` (ssr) reads · `defineAction` mutations · `useAction`/`useFormAction`.
- **Query cache** — `QueryClient` + `useQuery`/`useMutation` (dedupe, SWR, invalidation, optimistic).
- **Cache tags** — `revalidateTag` / `revalidatePath`; `use(promise)`; `useOptimistic`.
- **Auth** — `SessionManager`, `getSession`/`requireUser`, `createRbac`, OAuth presets (GitHub/Google/Microsoft).
- **Forms** — `<Form>`, `issueCsrfToken`/`verifyCsrf` (signed double-submit), `parseMultipartRequest`, `v.*` validation.
- **Database** — `jorvel add db [--driver sqlite|libsql]` scaffolds Drizzle (schema, client, migrations, seed, loader).

### SSR, SSG & ISR

```sh
jorvel ssr export                          # static export
jorvel ssr serve --port 3000               # streaming Node server
jorvel ssr serve --port 3000 --no-stream   # disable streaming
```

Programmatic surface:

- `renderRouteToString` + `injectIntoTemplate`
- `renderRouteToStream` (Node) / `renderRouteToReadableStream` (edge)
- `staticExport()`, `revalidateStaticPages()`, `serveWithISR()` (request-time stale-while-revalidate)
- `createEdgeAdapter()`, `createApiRouter()`/`defineRoute()` (API + tRPC/Hono mount), `inlineCriticalCss()`
- `ssrRenderRemote`, `createSsrRemoteOutlet` — server-side remote rendering
- `defineLoader` / `useLoaderData` — server-only data fetchers

### Production toolbelt

| Concern | Package | Highlights |
|---|---|---|
| Security | `@jorvel/security` | `buildCsp` strict-dynamic + nonce, `sriHash`, `RemoteAllowlist`, `createRateLimitGuard`, `AuditLogger`, OAuth PKCE helpers |
| Observability | `@jorvel/observability` | `onError` / `onMetric` / `onRemoteLoad`, Web Vitals, Sentry + OTel adapters, RUM beacon |
| Shared state | `@jorvel/state` | `getStore` / `getSimpleStore`, middleware (thunk/logger/persistence), Redux DevTools |
| Cross-app events | `@jorvel/event-bus` | Typed `EventBus`, replay-on-subscribe, schema validation, `BroadcastChannel` cross-tab |
| i18n | `@jorvel/i18n` | ICU-lite plural arms, lazy catalogs, `detectLocale(acceptLanguage, supported, fallback)` |
| UI primitives | `@jorvel/ui` | Button, Input, Modal, Toast, Card, ThemeProvider + Storybook scaffold |

### Runtime extras

- **Prefetch on hover.** `<NavLink prefetch />` warms the next remote bundle.
- **Concurrent preload.** `preloadRemotes(...)` after first paint, bounded concurrency + idle scheduling.
- **View Transitions.** `navigateWithTransition`, reduced-motion safe, fallback to plain swap.
- **Islands hydration.** `<Island strategy="visible" load={...} />` — five strategies.
- **CSS isolation.** `ShadowRemote` or `scopeCss`.
- **Service Worker.** `jorvel sw generate` + `registerJorvelServiceWorker`.
- **Image + fonts.** `<Image />`, `buildSrcset`, `buildFontFaceCss`, Google Fonts URL composer.
- **Resilience.** `withRetry`, `createCircuitBreaker`, `withTimeout`.
- **Blue/green + weighted remotes.** Canary, fail-over, deterministic flip.
- **Feature flags.** Pluggable provider, `useFeatureFlag` hook.

---

## Deployment

`jorvel deploy --target <vercel|cloudflare|node|docker|netlify|github-pages>` scaffolds the adapter and platform config.

| Target | Package | Notes |
|---|---|---|
| Vercel Edge | `@jorvel/adapter-vercel` | `export const config = { runtime: 'edge' }` |
| Cloudflare Workers / Pages | `@jorvel/adapter-cloudflare` | KV-backed HTML cache; Durable Objects ready |
| Node | `@jorvel/adapter-node` | Slowloris-hardened defaults, graceful SIGTERM |
| Bun | `@jorvel/adapter-bun` | `Bun.serve` fetch handler + static assets |
| Deno Deploy | `@jorvel/adapter-deno` | `Deno.serve` fetch handler |
| Netlify | `@jorvel/adapter-netlify` | Functions + Edge Functions |
| AWS | `@jorvel/adapter-aws-lambda` | API Gateway v2 + Lambda@Edge |
| Docker | — | Multi-stage Dockerfile, optional K8s manifests |
| GitHub Pages | — | Static export + Pages workflow |

Pop remotes onto a CDN — set `federation.publicPath` in `jorvel.config.json`.

---

## Dev workflow

```sh
# Most common
jorvel dev --proxy-remotes --hmr-remotes

# Routes in a second terminal (per remote)
jorvel routes --watch

# Before pushing
jorvel typecheck
jorvel lint
jorvel test
jorvel perf
jorvel diagnose

# Ship
jorvel build
jorvel build --app dashboard --compress
jorvel deploy --target vercel
```

`--proxy-remotes` rewrites the host remotes list to same-origin URLs — `/jorvel/remotes/<name>/remoteEntry.js` proxies to the remote dev-server. Avoids dev-time 404s for split chunks and makes CSP behave like production.

`--hmr-remotes` starts a tiny reload server; generated hosts call `connectJorvelDevReload()` so the host refreshes when a remote recompiles.

---

## Testing

```sh
# Unit (Vitest, every package)
pnpm -r test
pnpm coverage

# End-to-end (Playwright)
JORVEL_E2E=1 pnpm e2e
pnpm e2e:ci
```

Coverage lands under each workspace's `coverage/`. Playwright writes an HTML report to `playwright-report/`.

---

## Project status

**Production-ready.** The full framework surface — routing, data/forms/auth, SSR/SSG/ISR, federation tooling, security, observability, i18n, deployment adapters, and the CLI — is implemented, tested (1600+ unit tests), and documented. React Server Components are the one deliberate omission: federation + the RSC wire format aren't compatible upstream yet.

Release model: Changesets with linked groups —

- `[runtime, ssr, security]`
- `[state, event-bus, events]`
- `[adapter-*]`
- `cli`, `types`, `ui`, `observability`, `rspack-route-assets` bump independently
- `examples` / `docs` are `ignore`

---

## Contributing

Issues + PRs welcome.

```sh
git clone https://github.com/Ravikisha/JorvelJS.git
cd JorvelJS
pnpm install
pnpm -r build
pnpm -r test
```

- File bugs at <https://github.com/Ravikisha/JorvelJS/issues>.
- Discuss design via PR draft or an RFC issue.
- Run `pnpm typecheck && pnpm lint && pnpm test` before pushing.

---

## License

[MIT](./LICENSE) © Ravi Kishan

---

## Author

**Ravi Kishan** — [@ravikisha](https://github.com/ravikisha)

- GitHub: <https://github.com/ravikisha>
- Repository: <https://github.com/Ravikisha/JorvelJS>
- Live site: <https://jorveljs.vercel.app/>

Built because Module Federation deserved batteries-included tooling. Star the repo if JORVEL saved you a week of wiring.
