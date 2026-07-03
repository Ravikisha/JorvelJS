/**
 * AI coding-agent scaffolder.
 *
 * Writes:
 *   <root>/CLAUDE.md                       — Claude Code project context
 *   <root>/.claude/skills/<name>.md        — JORVEL-specific skills
 *   <root>/.claude/agents/<name>.md        — Subagent definitions
 *   <root>/.claude/settings.json           — Claude Code permissions defaults
 *   <root>/.cursorrules                    — Cursor IDE rules
 *   <root>/.github/copilot-instructions.md — GitHub Copilot Workspace rules
 *   <root>/AGENTS.md                       — Provider-neutral agent guide
 *
 * Drop --no-ai to opt out.
 */

import path from 'node:path';
import fs from 'fs-extra';

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.outputFile(filePath, content, 'utf8');
}

async function writeJson(filePath: string, obj: unknown): Promise<void> {
  await fs.outputFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

const CLAUDE_MD = (projectName: string) => `# ${projectName} — Claude Code instructions

This workspace is a JORVEL micro-frontend monorepo. JORVEL is an opinionated framework on top of Rspack Module Federation. When working in this repo, follow the conventions below.

## What lives where

\`\`\`
${projectName}/
├── apps/                 # Generated host + remote apps (one per app, federated via Rspack)
│   └── <name>/
│       ├── src/
│       │   ├── main.{tsx,jsx}            # Async-boundary entry — dynamically imports bootstrap
│       │   ├── bootstrap.{tsx,jsx}       # Real app entry: wraps <App /> in <ErrorBoundary>
│       │   ├── error-boundary.{tsx,jsx}  # Top-level React error boundary
│       │   └── pages/
│       │       ├── _error.{tsx,jsx}       # Crash screen (dev stack vs prod-safe)
│       │       ├── _404.{tsx,jsx}         # Default not-found page
│       │       └── *.{tsx,jsx}            # File-based routes (remotes only)
│       ├── jorvel.app.json               # App manifest (name, type, port, exposes)
│       ├── jorvel.federation.json        # Generated — \`jorvel federation\`
│       ├── jorvel.routes.host.json       # Host: routes -> remotes mapping
│       ├── rspack.config.mjs             # Rspack + ModuleFederationPlugin (do not edit)
│       └── public/                       # Static assets (favicon, logo)
├── libs/                                  # Optional shared internal libs
├── jorvel.config.ts                       # Workspace config: federation, security, plugins
├── tsconfig.base.json                     # Strict TS settings (do not relax)
└── .github/workflows/                     # CI + preview + deploy
\`\`\`

## Conventions — must follow

1. **Federation contracts are typed.** Use \`InferExposed\`, \`InferEmits\`, \`InferListens\` from \`@jorvel/types\`. A new exposed module without a contract is a CI failure.
2. **Hosts own URL prefixes, remotes own sub-paths.** Never put a top-level layout inside a remote. Never put a feature page in the host.
3. **Async boundary at the entry.** \`main.{tsx,jsx}\` may only do \`import('./bootstrap')\` — no React imports, no shared deps. Required by Module Federation.
4. **Singletons.** \`react\` + \`react-dom\` must be \`singleton: true\` on every \`shared\` entry. Adding a non-singleton React breaks hooks across the federation seam.
5. **CSP-first.** Inline \`<style>\`/\`<script>\` is disallowed. Use \`@jorvel/security\`'s \`buildCsp\` + nonces.
6. **Tests** — \`pnpm test\` runs vitest. \`pnpm e2e\` runs Playwright. Component tests use React Testing Library + jsdom (\`vitest.config.{ts,js}\`). Smoke test stays — do not delete \`src/smoke.test.{ts,js}\`.
7. **Strict TypeScript.** \`exactOptionalPropertyTypes\`, \`noUncheckedIndexedAccess\`, \`noImplicitOverride\`. Don't \`as any\` to silence — fix the type.

## Common commands

\`\`\`sh
pnpm dev                  # all apps in parallel
pnpm dev:proxy            # host with --proxy-remotes --hmr-remotes (recommended)
pnpm build                # production build
pnpm test                 # vitest, every package
pnpm test:watch           # interactive
pnpm lint                 # eslint workspace-wide
pnpm typecheck            # tsc --noEmit per package
pnpm routes               # regen file-based route manifests
pnpm federation           # regen federation configs
pnpm perf                 # bundle-size + perf budgets
pnpm diagnose             # workspace health
pnpm deploy               # via configured adapter
pnpm ci                   # typecheck + lint + test + build
\`\`\`

## When generating code

- **New page in a remote** → drop a file under \`apps/<remote>/src/pages/\` (e.g. \`users/[id].tsx\`). Then run \`jorvel routes\` to regenerate the manifest. Use kebab-case for files, PascalCase for the default export.
- **New remote app** → \`jorvel generate remote <name> --port <port>\`. Don't hand-roll the rspack config.
- **New host route → remote mapping** → edit \`apps/<host>/jorvel.routes.host.json\`. Pattern: \`{ path: "/x/*", remote: "x", module: "./App" }\`.
- **Error/404 customization** → edit \`apps/<app>/src/pages/_error.{tsx,jsx}\` and \`_404.{tsx,jsx}\`. They are plain React, no JORVEL imports.
- **Shared event** → declare in \`@jorvel/events\` (a typed registry). Then \`emit\` / \`on\` from \`@jorvel/event-bus\`.
- **Shared store** → \`@jorvel/state\` with React adapter (\`@jorvel/state/react\`).

## Hot bug catchers

- \`Invalid hook call\` → React duplicated. Confirm both shells declare React as \`singleton: true\` with the same version range.
- \`RUNTIME-006 loadShareSync\` → async-boundary lost. Make sure \`main.{tsx,jsx}\` only does the dynamic import.
- 404 on \`remoteEntry.js\` → host's \`federation.remotes\` URL is wrong, or remote isn't running on \`--port\`.
- Hydration mismatch → check \`@jorvel/observability\` \`onError\`; usually it's \`Date.now()\` in the render tree.

## Skills + agents in this workspace

This repo ships project-specific skills and subagent definitions under \`.claude/\`:

- \`.claude/skills/\` — invokable via \`/<name>\` (federation-contracts, file-routing, ssr, security, testing)
- \`.claude/agents/\` — subagent defs (host-builder, remote-builder, federation-auditor, security-reviewer)
- \`.claude/settings.json\` — permissions defaults

Prefer using these over re-deriving conventions from scratch.

## What NOT to do

- Don't add ESM/CJS interop helpers — workspace is pure ESM.
- Don't widen \`tsconfig.base.json\` strictness.
- Don't \`npm install\` — use \`pnpm\`.
- Don't bypass federation by inlining a remote's source into the host.
- Don't disable the top-level \`<ErrorBoundary>\` without replacing it.
- Don't reach for class components unless extending \`React.Component\` for the error boundary itself.

## Reference docs

- https://jorveljs.vercel.app/docs
- https://github.com/Ravikisha/JorvelJS
`;

const AGENTS_MD = (projectName: string) => `# Agents guide — ${projectName}

Provider-neutral instructions for AI coding agents (Claude Code, Cursor, Aider, OpenAI Codex, Windsurf, Continue.dev). For Claude Code specifically, also read \`CLAUDE.md\`.

This is a JORVEL workspace. JORVEL = opinionated micro-frontend framework on Rspack Module Federation.

## Build / test / lint commands

\`\`\`sh
pnpm install
pnpm dev:proxy
pnpm test
pnpm lint
pnpm typecheck
pnpm build
\`\`\`

## Code style

- **TypeScript strict** — \`exactOptionalPropertyTypes\`, \`noUncheckedIndexedAccess\`.
- **No \`any\`** outside test files. Use \`unknown\` + narrowing.
- **No default exports** for utility functions. Default exports OK for React page components.
- **ESM only** — \`type: "module"\`. Use \`.js\` extensions on relative imports when targeting bundler resolution.
- **Tests live next to code** — \`foo.ts\` ↔ \`foo.test.ts\`.

## Directory rules

- \`apps/<name>/\` is owned by the generator. \`rspack.config.mjs\` and \`mf-shim.js\` are not hand-edited.
- \`libs/\` is for cross-app shared code. New libs need a \`package.json\` with \`@app/<name>\`.
- \`jorvel.*.json\` files are config; \`jorvel.routes.host.json\` is hand-edited, the rest are generated.

## Federation rules

- A remote's exposed entry is **always** \`./src/remote.{tsx,jsx}\` and registered in \`jorvel.app.json\` under \`exposes\`.
- Hosts reference remotes by name in \`jorvel.routes.host.json\`. The actual URL comes from \`jorvel.federation.json\` (generated).
- React is **singleton + eager-on-host, lazy-on-remote**. Don't touch.

## When asked to add a feature

1. Search docs first: https://jorveljs.vercel.app/docs
2. Prefer scaffolding via CLI (\`jorvel generate\`) over hand-rolling.
3. Add a test in the same package — vitest + \`@testing-library/react\` for components.
4. Update README only when the surface visible to the user changes.
`;

const SKILLS: Record<string, string> = {
  'federation-contracts': `---
name: federation-contracts
description: Author and verify typed federation contracts in JORVEL. Use when adding a new exposed module, changing an exposed module's signature, or auditing host→remote contract compatibility.
---

# JORVEL federation contracts

JORVEL types the federation seam at compile time using \`@jorvel/types\`. The CLI ships \`jorvel federation\` to generate \`jorvel.federation.json\` from \`jorvel.app.json\`.

## When to use

- New \`./App\` (or any other) export on a remote.
- Renaming/removing an existing exposed module — needs a CI gate.
- Adding a typed event the remote will \`emit\`.

## Author a contract

\`\`\`ts
// libs/contracts/dashboard.ts
import type { InferExposed, InferEmits, InferListens } from '@jorvel/types';

export interface DashboardRemote {
  exposes: {
    './App': () => Promise<{ default: React.FC }>;
    './widgets/UserAvatar': () => Promise<{ default: React.FC<{ id: string }> }>;
  };
  emits: {
    'dashboard:row-clicked': { rowId: string };
    'dashboard:exported': { format: 'csv' | 'xlsx'; rows: number };
  };
  listens: {
    'auth:user-changed': { userId: string | null };
  };
}

export type DashboardExposes = InferExposed<DashboardRemote>;
export type DashboardEmits = InferEmits<DashboardRemote>;
export type DashboardListens = InferListens<DashboardRemote>;
\`\`\`

## Wire to the host

\`\`\`ts
// apps/shell/src/bootstrap.tsx
import type { DashboardRemote } from '@jorvel/contracts/dashboard';

const REMOTES = {
  dashboard: () =>
    import('dashboard/App') as ReturnType<DashboardRemote['exposes']['./App']>,
};
\`\`\`

## CI gate (when implemented)

\`\`\`sh
jorvel federation diff --base main
\`\`\`

Should fail PRs that:
- Drop an exposed key
- Narrow an emit's payload
- Widen a listen's payload (host needs to handle it)

## Red flags to catch

- Untyped \`import('x/Y')\` calls in hosts — always alias through the contract.
- Hand-edited \`jorvel.federation.json\` — regenerate with \`jorvel federation\`.
- A remote that \`emit\`s a key not declared in its contract — \`@jorvel/event-bus\` will not narrow types and CI should fail.
`,
  'file-routing': `---
name: file-routing
description: Add, modify, or refactor file-based routes inside a JORVEL remote. Use when the user asks to add a page, a dynamic segment, a route group, or update the routes manifest.
---

# File-based routing in JORVEL

Remotes own their sub-tree using a Next-style file convention rooted at \`src/pages/\`. The host knows nothing about a remote's internal routes — it just maps a prefix to the remote.

## Conventions

| File | URL |
|---|---|
| \`pages/index.tsx\`           | \`/\` |
| \`pages/settings.tsx\`        | \`/settings\` |
| \`pages/users/index.tsx\`     | \`/users\` |
| \`pages/users/[id].tsx\`      | \`/users/:id\` |
| \`pages/(marketing)/about.tsx\` | \`/about\` (group folder is stripped) |
| \`pages/_error.tsx\`          | crash screen (not a route) |
| \`pages/_404.tsx\`            | not-found page (not a route) |

## Add a page

1. Create the file under \`apps/<remote>/src/pages/\`.
2. Default-export a React component.
3. Run \`jorvel routes\` (or \`pnpm routes\`) to regenerate \`src/jorvel.routes.{ts,js}\`.

## Dynamic params

\`\`\`tsx
// apps/dashboard/src/pages/users/[id].tsx
import { useParams } from '@jorvel/runtime';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  return <h2>User {id}</h2>;
}
\`\`\`

## Host wiring

Hosts map URL prefixes to remotes in \`apps/<host>/jorvel.routes.host.json\`:

\`\`\`json
{
  "host": "shell",
  "routes": [
    { "path": "/dashboard/*", "remote": "dashboard", "module": "./App" }
  ]
}
\`\`\`

A request to \`/dashboard/users/42\` is matched to \`dashboard/App\`, which delegates internally to \`users/[id].tsx\`.

## Generated 404 handling

Hosts include \`matchesAnyHostRoute(pathname, routes)\` in \`bootstrap.{tsx,jsx}\`. Unmatched URLs render \`src/pages/_404.{tsx,jsx}\` locally — never propagated to any remote.

## What NOT to do

- Don't put pages in the host. Hosts only own the chrome.
- Don't hand-edit \`jorvel.routes.ts\` — it is auto-generated.
- Don't add a route to \`jorvel.routes.host.json\` that doesn't have a matching remote in \`jorvel.federation.json\`.
`,
  'ssr': `---
name: ssr
description: Render JORVEL routes on the server, stream HTML, run static export, or wire an edge adapter. Use when the task involves @jorvel/ssr or @jorvel/adapter-*.
---

# JORVEL SSR

JORVEL ships streaming SSR + static export + edge adapters. Renderers live in \`@jorvel/ssr\`; adapters in \`@jorvel/adapter-{node,vercel,cloudflare}\`.

## Render to string (Node, simplest)

\`\`\`ts
import { renderRouteToString, injectIntoTemplate } from '@jorvel/ssr';

const { html, head } = await renderRouteToString({
  url: req.url,
  router: createRouter({ remotes }),
});
const page = injectIntoTemplate({ template, html, head, nonce });
res.send(page);
\`\`\`

## Stream (Node)

\`\`\`ts
import { renderRouteToStream } from '@jorvel/ssr';

const stream = await renderRouteToStream({ url, router });
stream.pipe(res);
\`\`\`

## Edge (Cloudflare Workers / Vercel Edge)

\`\`\`ts
import { renderRouteToReadableStream } from '@jorvel/ssr/edge';
import { createEdgeAdapter } from '@jorvel/adapter-vercel';

export default createEdgeAdapter({
  render: (req) => renderRouteToReadableStream({ url: req.url, router }),
});
export const config = { runtime: 'edge' };
\`\`\`

## Static export

\`\`\`ts
import { staticExport } from '@jorvel/ssr';

await staticExport({
  outDir: 'dist/static',
  paths: ['/', '/dashboard', '/dashboard/users/1'],
  concurrency: 4,
});
\`\`\`

## Loaders + request context

\`\`\`ts
import { defineLoader, useLoaderData } from '@jorvel/ssr';

export const loader = defineLoader(async ({ params, request }) => {
  return fetchUser(params.id);
});

export default function UserPage() {
  const user = useLoaderData<typeof loader>();
  return <h1>{user.name}</h1>;
}
\`\`\`

## Hydration safety checklist

- No \`Date.now()\` / \`Math.random()\` in render — pass via loader.
- Use \`@jorvel/security\`'s nonce, not inline scripts.
- Streaming + ETag-before-render combo cuts p95 — enable in \`@jorvel/ssr\` config.
- \`useEffect\` for browser-only — keep render pure.
`,
  'security': `---
name: security
description: Apply JORVEL's security primitives — CSP, SRI, origin allowlist, OAuth helpers, sanitization, rate limit, audit log. Use when adding auth, third-party origins, file uploads, or hardening for production.
---

# JORVEL security toolkit

\`@jorvel/security\` is edge-runtime safe. All functions work in Workers, Edge Functions, and Node.

## CSP builder

\`\`\`ts
import { buildCsp, nonce } from '@jorvel/security';

const n = nonce();
const csp = buildCsp({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", \`'nonce-\${n}'\`, "'strict-dynamic'"],
  styleSrc: ["'self'", \`'nonce-\${n}'\`],
  connectSrc: ["'self'", 'https://*.acme.dev'],
  reportUri: '/_csp-report',
});

res.setHeader('Content-Security-Policy', csp);
\`\`\`

## SRI for remoteEntry.js

\`\`\`ts
import { sriHash } from '@jorvel/security';

const integrity = await sriHash(await fetch(remoteEntry), 'sha384');
// embed into <link integrity={integrity} ...>
\`\`\`

## Origin allowlist

\`\`\`ts
import { RemoteAllowlist } from '@jorvel/security';

const list = new RemoteAllowlist([
  '*.acme.dev',
  '**.cdn.cloudflare.net',
]);

if (!list.allows(url)) throw new Error('Remote not allowed');
\`\`\`

## OAuth (PKCE-only — providers not prebuilt yet)

\`\`\`ts
import { createPkceFlow, exchangeAuthCode } from '@jorvel/security';

const { codeVerifier, codeChallenge, state } = createPkceFlow();
// → redirect to provider with code_challenge + state
// callback:
const tokens = await exchangeAuthCode({
  tokenEndpoint: 'https://auth.example.com/token',
  clientId,
  code,
  codeVerifier,
});
\`\`\`

## Rate limit

\`\`\`ts
import { createRateLimitGuard } from '@jorvel/security';

const guard = createRateLimitGuard({ window: '1m', max: 60 });
if (!guard(req.ip)) return new Response('429', { status: 429 });
\`\`\`

## Sanitize

\`\`\`ts
import { sanitizeHtml, safeJson } from '@jorvel/security/sanitize';

const safe = sanitizeHtml(userContent);
const obj = safeJson(req.body); // throws on prototype-pollution shapes
\`\`\`

## Production checklist hooks

- CSP \`strict-dynamic\` + nonce on every \`<script>\`.
- \`Permissions-Policy\` defaults (camera, microphone, geolocation off).
- \`Referrer-Policy: strict-origin-when-cross-origin\`.
- Audit-log every auth-impacting action via \`AuditLogger\`.
`,
  'testing': `---
name: testing
description: Add or refactor tests in this JORVEL workspace. Use when the user asks for unit, component, contract, or end-to-end tests. Covers vitest + React Testing Library + Playwright + federation contract tests.
---

# JORVEL testing patterns

Every package and app has \`pnpm test\` wired to vitest. E2E uses Playwright at the workspace root.

## Unit (vitest)

\`\`\`ts
// libs/foo/src/foo.test.ts
import { describe, it, expect } from 'vitest';
import { add } from './foo.js';

describe('add', () => {
  it('sums two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
\`\`\`

## Component (RTL + jsdom)

Generated apps already ship \`vitest.config.{ts,js}\` with \`environment: 'jsdom'\`. Add \`@testing-library/react\` and \`@testing-library/jest-dom\` if not yet present:

\`\`\`ts
// apps/shell/src/welcome.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Welcome } from './welcome';

describe('Welcome', () => {
  it('renders the project name', () => {
    render(<Welcome defaultProjectName="my-app" />);
    expect(screen.getByText(/my-app/i)).toBeInTheDocument();
  });
});
\`\`\`

## Federation contract tests

For a remote with a \`DashboardRemote\` contract:

\`\`\`ts
// libs/contracts/dashboard.test.ts
import { assertContract } from '@jorvel/types/testing';
import type { DashboardRemote } from './dashboard.js';
import * as DashboardModule from '../../apps/dashboard/src/remote.js';

assertContract<DashboardRemote['exposes']['./App']>(DashboardModule.default);
\`\`\`

## E2E (Playwright)

\`\`\`ts
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('host loads dashboard remote', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Dashboard');
  await expect(page).toHaveURL(/\\/dashboard/);
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
});
\`\`\`

Run: \`pnpm e2e\` (sets \`JORVEL_E2E=1\`).

## Smoke test convention

Every scaffolded app starts with \`src/smoke.test.{ts,js}\` to ensure \`pnpm test\` is green on first commit. Keep it. Add real tests next to it.

## What NOT to do

- Don't mock \`@jorvel/runtime\` — use the real router; reset with \`resetRouterForTests\`.
- Don't share state across tests — vitest isolates per file by default; keep it that way.
- Don't run E2E in unit-test CI — too slow. Separate job.
`,
  'jorvel-cli': `---
name: jorvel-cli
description: Use the JORVEL CLI (jorvel ...) to scaffold, generate, build, deploy. Trigger this skill any time the task involves running a jorvel command or wiring a workflow that depends on the CLI.
---

# JORVEL CLI reference

The CLI is \`jorvel\` (unscoped on npm). Install runtime-less via \`pnpm dlx jorvel@latest <cmd>\`.

## Top commands

| Command | What it does |
|---|---|
| \`jorvel init <name>\` | Scaffold a workspace (apps/, libs/, CI workflows, AI agent config) |
| \`jorvel generate host <name>\` | Add a host app (default port 3000) |
| \`jorvel generate remote <name>\` | Add a remote app (default port 3001) |
| \`jorvel generate wizard\` | Interactive: host + N remotes, lang, tailwind |
| \`jorvel scaffold app\` | Same as wizard |
| \`jorvel dev\` | Start every app in parallel |
| \`jorvel dev --proxy-remotes --hmr-remotes\` | Recommended dev mode |
| \`jorvel build\` | Production build, all apps |
| \`jorvel build --app <name> --compress --compute-sri\` | One app + gzip + SRI |
| \`jorvel ssr serve --port 3000\` | Streaming SSR server |
| \`jorvel ssr export\` | Static export |
| \`jorvel routes\` | Regen file-based route manifests |
| \`jorvel routes --watch\` | Re-regen on file change |
| \`jorvel federation\` | Regen federation configs from app manifests |
| \`jorvel deploy --target <vercel\\|cloudflare\\|node\\|docker>\` | Scaffold adapter + platform config |
| \`jorvel typecheck\` | \`tsc --noEmit\` across the workspace |
| \`jorvel lint\` | ESLint workspace-wide |
| \`jorvel test\` | vitest |
| \`jorvel test --e2e\` | Playwright |
| \`jorvel perf\` | Bundle-size + perf budgets |
| \`jorvel diagnose\` | Workspace health: Node, pnpm, ports, configs |
| \`jorvel analyze\` | Bundle analyzer |
| \`jorvel sw generate\` | Service Worker scaffold |

## Generate flags

\`\`\`sh
jorvel generate host shell \\
  --port 3000 \\
  --remote dashboard \\
  --lang ts            # or 'js' / 'typescript' / 'javascript'
  --tailwind           # adds tailwind + postcss + autoprefixer
\`\`\`

## Init flags

\`\`\`sh
jorvel init my-app \\
  --tailwind \\
  --no-git             # skip git init
  --no-ai              # skip CLAUDE.md / .claude/ / .cursorrules
\`\`\`

## What NOT to do

- Don't run \`jorvel\` inside a non-workspace dir — \`jorvel diagnose\` will report.
- Don't hand-edit generated \`rspack.config.mjs\` or \`mf-shim.js\`.
- Don't add \`@jorvel/*\` deps via \`npm install\` — use \`pnpm\`.
`,
};

const AGENTS: Record<string, string> = {
  'host-builder': `---
name: host-builder
description: Build or modify the host (shell) app — bootstrap, ErrorBoundary wiring, NavLink / RemoteOutlet setup, host route manifest. Trigger when work is scoped to apps/<host>/.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# host-builder agent

You are working inside a JORVEL host app — \`apps/<host>/\`.

## What you own

- \`src/bootstrap.{tsx,jsx}\` — wires \`<ErrorBoundary>\`, \`provideHostRouter(getRouter())\`, \`matchesAnyHostRoute\`, \`<RemoteOutlet />\`
- \`src/welcome.{tsx,jsx}\` — first-run screen (delete the branch in bootstrap to skip)
- \`src/error-boundary.{tsx,jsx}\` + \`src/pages/_error.{tsx,jsx}\` + \`src/pages/_404.{tsx,jsx}\`
- \`jorvel.routes.host.json\` — host's route → remote mapping
- \`jorvel.app.json\` — name, type=host, port

## What you do NOT own

- Anything under \`apps/<remote>/\` — escalate to \`remote-builder\`
- \`rspack.config.mjs\` — regenerate via \`jorvel generate host\`
- Federation config — \`jorvel federation\`

## Workflow

1. Read \`apps/<host>/jorvel.routes.host.json\` to know which remotes are wired.
2. If adding a new remote prefix, edit that file with the pattern \`{ "path": "/<name>/*", "remote": "<name>", "module": "./App" }\`.
3. Update \`src/bootstrap.tsx\`'s \`REMOTES\` map to include the new dynamic import.
4. Add a \`<NavLink>\` if the user-facing nav should expose it.
5. Run \`pnpm typecheck && pnpm lint && pnpm test --filter @app/<host>\`.

## Done criteria

- Typecheck clean
- ESLint clean (\`--max-warnings=0\`)
- \`pnpm dev --proxy-remotes\` boots without console errors
- 404 page shows for unmatched paths
- Smoke test still green
`,
  'remote-builder': `---
name: remote-builder
description: Build or modify a remote app — file-based pages, jorvel.routes.ts manifest, remote.tsx exposed entry, app manifest. Trigger when work is scoped to apps/<remote>/.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# remote-builder agent

You are working inside a JORVEL remote app — \`apps/<remote>/\`.

## What you own

- \`src/pages/**\` — file-based routes (\`index.tsx\`, \`[id].tsx\`, \`(group)/\`, \`_error.tsx\`, \`_404.tsx\`)
- \`src/remote.{tsx,jsx}\` — the exposed entry that the host imports as \`./App\`
- \`src/jorvel.routes.{ts,js}\` — auto-generated by \`jorvel routes\`; do not hand-edit
- \`jorvel.app.json\` — name, type=remote, port, exposes

## What you do NOT own

- Anything under \`apps/<host>/\` — escalate to \`host-builder\`
- \`jorvel.routes.host.json\` (host owns it)
- \`rspack.config.mjs\` / \`mf-shim.js\` — regenerate via the CLI

## Workflow

1. Add the file under \`src/pages/\`. Use kebab-case for files, PascalCase for the default export.
2. Run \`pnpm routes\` (or \`jorvel routes\`) to regen the manifest.
3. If the page uses dynamic data, prefer a \`defineLoader\` from \`@jorvel/ssr\` over client-side fetch.
4. Test: \`pnpm test --filter @app/<remote>\`.

## Done criteria

- New route renders when navigated via the host
- Loader (if any) runs server-side and the data shows on first paint
- Typecheck + lint + test clean
- Route added to E2E sweep if it's user-visible
`,
  'federation-auditor': `---
name: federation-auditor
description: Audit federation contracts, version skews, and host→remote compatibility. Trigger before merging changes to any exposed module signature or any new remote.
tools: Read, Grep, Glob, Bash
---

# federation-auditor agent

You enforce the federation contract layer. Read-only by default — propose changes; do not apply them.

## Run order

1. \`grep -rn "exposes" apps/*/jorvel.app.json libs/*/contracts/*.ts\` to list every exposed module.
2. For each remote, confirm \`InferExposed<T>\` matches the actual export type in \`src/remote.{tsx,jsx}\`.
3. For each \`emit\` / \`on\` call in the codebase, confirm the event key is declared in \`@jorvel/events\` and the payload matches the typed registry.
4. Compare \`jorvel.federation.json\` against \`jorvel.app.json\` — drift means somebody forgot \`jorvel federation\`.
5. Compare host's \`shared\` versions against each remote's \`shared\` versions. Mismatched \`requiredVersion\` for React is a hot-zone bug.

## Red flags

- \`import('remote/X')\` without going through the typed alias.
- Hand-edited \`jorvel.federation.json\`.
- Contract that declares an export the source file no longer has.
- React not declared \`singleton: true\` somewhere.
- A remote in \`jorvel.routes.host.json\` that has no entry in \`jorvel.federation.json\`.

## Output

Report findings as: \`[severity] <file>:<line> — <problem> → <fix>\`. Don't apply fixes.
`,
  'security-reviewer': `---
name: security-reviewer
description: Review the working diff for CSP, SRI, origin-allowlist, rate-limit, auth, secret-leak, and XSS issues. Trigger before merging changes that touch @jorvel/security, auth flows, or new third-party origins.
tools: Read, Grep, Glob, Bash
---

# security-reviewer agent

You enforce production security defaults for JORVEL workspaces.

## Checks

1. **CSP** — any new external origin must be in \`buildCsp\` allowlist. No inline \`<script>\` / \`<style>\` without a nonce. \`strict-dynamic\` must be on \`scriptSrc\`.
2. **SRI** — every \`remoteEntry.js\` must have an \`integrity\` attribute. Confirm \`federation.sri.algo = "sha384"\`.
3. **Allowlist** — \`RemoteAllowlist\` covers the dynamic remote URLs. No \`*\` at root level.
4. **Rate limit** — public-facing routes have \`createRateLimitGuard\` wired. Defaults: 60 req/min per IP for unauthenticated, 600 for authenticated.
5. **Sanitization** — user-provided HTML goes through \`sanitizeHtml\`. JSON parsed via \`safeJson\` (prototype-pollution guard).
6. **Auth** — PKCE state validated; tokens never logged. Refresh-token rotation on every use.
7. **Secrets** — \`.env\` is gitignored; \`.env.example\` lists keys without values; no secret in any file matched by \`gitleaks --redact\`.
8. **XSS** — \`dangerouslySetInnerHTML\` is a code smell; require a paired \`sanitizeHtml\` call in the diff.

## Output

Report per-finding: \`[severity] <file>:<line> — <issue> → <mitigation>\`. Severity: critical / high / medium / low.

## What you do NOT do

- Don't suggest dropping CSP \`strict-dynamic\` for convenience.
- Don't accept \`'unsafe-inline'\` in \`scriptSrc\`.
- Don't recommend stripping \`@jorvel/security/sanitize\` even if "the source is trusted".
`,
};

const CURSORRULES = (projectName: string) => `# Cursor rules for ${projectName}

This is a JORVEL micro-frontend monorepo (Rspack Module Federation). Stack: React, TypeScript strict, Rspack, vitest, Playwright, pnpm.

## Always

- Pure ESM. Use \`.js\` extensions on relative imports when the resolver is bundler-style.
- TypeScript strict — never \`as any\`, never widen \`exactOptionalPropertyTypes\`.
- Prefer scaffolding via the \`jorvel\` CLI over hand-rolling files.
- Co-locate tests next to source.
- Update \`jorvel.routes.host.json\` (hand-edited) when adding host→remote mappings. Don't hand-edit \`jorvel.federation.json\` (generated).
- \`react\` + \`react-dom\` are \`singleton: true\` everywhere — never relax.

## Never

- \`npm install\` — use \`pnpm\`.
- Inline \`<script>\`/\`<style>\` — use \`@jorvel/security\` nonces.
- React imports in \`src/main.{tsx,jsx}\` — only \`import('./bootstrap')\` (async boundary).
- Edit \`rspack.config.mjs\` or \`mf-shim.js\` by hand — regenerate via CLI.
- Drop the top-level \`<ErrorBoundary>\` without replacing it.
- Cross-import remote source files into the host — go through federation only.

## File-based routing convention

- \`pages/index.tsx\` → \`/\`
- \`pages/[id].tsx\` → \`/:id\`
- \`pages/(group)/about.tsx\` → \`/about\`
- \`pages/_error.tsx\` + \`pages/_404.tsx\` are special — not routes.

## When asked to add a feature

1. Search \`jorvel.config.ts\` and \`apps/<name>/jorvel.app.json\` first to know the workspace shape.
2. Use \`jorvel generate <kind>\` when possible.
3. Add at least one test (\`vitest\` for unit/component, \`@playwright/test\` for E2E).
4. Run \`pnpm typecheck && pnpm lint && pnpm test\` before declaring done.

## Reference

- Docs: https://jorveljs.vercel.app/docs
- Repo: https://github.com/Ravikisha/JorvelJS
`;

const COPILOT_INSTRUCTIONS = (projectName: string) => `# GitHub Copilot instructions — ${projectName}

This workspace is a JORVEL micro-frontend monorepo. Pin context, follow conventions.

## Stack

- **Framework**: JORVEL (\`jorvel\` CLI, \`@jorvel/*\` libraries) on top of Rspack Module Federation
- **Language**: TypeScript strict (\`exactOptionalPropertyTypes\`, \`noUncheckedIndexedAccess\`)
- **Runtime**: React 18/19, Node ≥20
- **Tests**: vitest (\`pnpm test\`), Playwright (\`pnpm e2e\`)
- **Lint/format**: ESLint 9 (flat config) + Prettier
- **Package manager**: pnpm only

## Coding style

- Pure ESM. \`type: "module"\`. Use \`.js\` extensions on relative imports.
- No default exports for utilities; default exports OK for React page components.
- Co-locate tests: \`foo.ts\` ↔ \`foo.test.ts\`.
- Class components only for the top-level error boundary; everything else functional.
- Prefer \`const\` + immutability; mutation only inside reducers/stores.

## Federation rules

- Hosts own URL prefixes; remotes own sub-paths.
- A remote's exposed entry is \`./src/remote.{tsx,jsx}\` declared in \`jorvel.app.json\`.
- Hosts reference remotes by name in \`jorvel.routes.host.json\` (hand-edited).
- \`jorvel.federation.json\` is generated — regen via \`jorvel federation\`.
- React + react-dom are \`singleton: true\` everywhere.

## File-based routing

- \`pages/index.tsx\` → \`/\`, \`pages/[id].tsx\` → \`/:id\`, \`pages/(group)/about.tsx\` → \`/about\`.
- \`pages/_error.tsx\` + \`pages/_404.tsx\` are special — not routes, just defaults rendered by the boundary + 404 fallthrough.

## Common commands

\`pnpm dev:proxy\`, \`pnpm build\`, \`pnpm test\`, \`pnpm lint\`, \`pnpm typecheck\`, \`pnpm routes\`, \`pnpm federation\`, \`pnpm diagnose\`.

## When suggesting code

- Use \`@jorvel/runtime\` hooks (\`usePathname\`, \`useParams\`, \`getRouter\`) instead of \`react-router\`.
- Use \`@jorvel/security\` primitives (\`buildCsp\`, \`sriHash\`, \`RemoteAllowlist\`) — never roll your own.
- Use \`@jorvel/event-bus\` for cross-app events; declare new keys in \`@jorvel/events\`.
- Use \`@jorvel/state\` for shared stores; use the React adapter \`@jorvel/state/react\` for hooks.

## Reference

https://jorveljs.vercel.app/docs · https://github.com/Ravikisha/JorvelJS
`;

const CLAUDE_SETTINGS = {
  permissions: {
    allow: [
      'Bash(pnpm:*)',
      'Bash(jorvel:*)',
      'Bash(node:*)',
      'Bash(npx:*)',
      'Bash(git status*)',
      'Bash(git diff*)',
      'Bash(git log*)',
      'Read(./**)',
      'Edit(./**)',
      'Write(./**)',
    ],
    deny: [
      'Bash(rm -rf*)',
      'Bash(git push --force*)',
      'Bash(npm install*)',
      'Read(.env)',
      'Read(.env.*)',
    ],
  },
  env: {
    JORVEL_TELEMETRY_DISABLED: '1',
  },
};

export interface ScaffoldAiOptions {
  workspaceDir: string;
  projectName: string;
}

export async function writeAiAgentScaffold(opts: ScaffoldAiOptions): Promise<void> {
  const { workspaceDir, projectName } = opts;

  // Root-level entry points
  await writeText(path.join(workspaceDir, 'CLAUDE.md'), CLAUDE_MD(projectName));
  await writeText(path.join(workspaceDir, 'AGENTS.md'), AGENTS_MD(projectName));
  await writeText(path.join(workspaceDir, '.cursorrules'), CURSORRULES(projectName));

  // GitHub Copilot
  await writeText(
    path.join(workspaceDir, '.github', 'copilot-instructions.md'),
    COPILOT_INSTRUCTIONS(projectName),
  );

  // Claude Code: skills + agents + settings
  const claudeDir = path.join(workspaceDir, '.claude');
  await writeJson(path.join(claudeDir, 'settings.json'), CLAUDE_SETTINGS);

  for (const [name, body] of Object.entries(SKILLS)) {
    await writeText(path.join(claudeDir, 'skills', `${name}.md`), body);
  }
  for (const [name, body] of Object.entries(AGENTS)) {
    await writeText(path.join(claudeDir, 'agents', `${name}.md`), body);
  }

  // README in each dir so the structure is self-documenting
  await writeText(
    path.join(claudeDir, 'README.md'),
    [
      '# Claude Code project config',
      '',
      'This directory is read by [Claude Code](https://claude.com/claude-code).',
      '',
      '- `settings.json` — permissions defaults + env',
      '- `skills/*.md` — invokable skills (`/<name>` inside Claude Code)',
      '- `agents/*.md` — subagent definitions (invoked by name or via the agent picker)',
      '',
      'Pair this with the workspace-level `CLAUDE.md` for project-wide instructions.',
      '',
    ].join('\n'),
  );
}
