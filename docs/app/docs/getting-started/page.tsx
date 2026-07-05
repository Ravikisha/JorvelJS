import Link from 'next/link';
import { CodeBlock } from '@/components/site/code-block';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/docs/callout';
import { Steps, Step } from '@/components/docs/steps';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { ArrowRight, CheckIcon, RocketIcon, ShieldIcon, NetworkIcon } from '@/components/icons';

export const metadata = {
  title: 'Getting started',
  description:
    'Scaffold a production-ready JORVEL workspace in five commands. Host + remote, file-based routing, federation, dev server with HMR.',
};

export default function GettingStarted() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <RocketIcon className="h-3 w-3" /> Quickstart
      </Badge>
      <h1>Getting started</h1>
      <p>
        JORVEL scaffolds a complete micro-frontend workspace in five commands. By the end of this
        guide you&apos;ll have a host, a remote, file-based routing, and a dev server with HMR
        running on the same origin.
      </p>

      <Callout variant="info" title="Who is this for?">
        Built for product teams that ship more than one frontend codebase and want a typed, opinionated
        runtime under their Module Federation. Comfortable defaults; nothing you can&apos;t override.
      </Callout>

      <h2 id="prerequisites">Prerequisites</h2>
      <ul>
        <li>
          <strong>Node.js 20, 22, or 24</strong> on Linux, macOS, or Windows — all three are
          supported and exercised in CI. The CLI uses <code>node:test</code> / native{' '}
          <code>fetch</code> / <code>structuredClone</code>, so 18.x may work but is not covered.
        </li>
        <li>
          <strong>pnpm 9.15+</strong> is the supported package manager. <code>npm 10+</code> and{' '}
          <code>yarn 4+</code> also work — see{' '}
          <Link href="/docs/troubleshooting">Troubleshooting</Link> if symlinks or workspace
          resolution misbehave.
        </li>
        <li>
          A terminal that can run <code>npx</code> / <code>pnpm dlx</code>, plus{' '}
          <code>git</code> for the generated project&apos;s default <code>.gitignore</code> /
          GitHub Actions templates.
        </li>
        <li>
          Optional but recommended: <strong>VS Code</strong> with the TypeScript and ESLint
          extensions. Generated projects ship a <code>.vscode/settings.json</code> that enables
          workspace-relative typing and ESLint-on-save.
        </li>
      </ul>

      <Callout variant="info" title="What does &quot;production-ready&quot; mean here?">
        The scaffold ships TypeScript strict-mode, ESLint, Vitest, Playwright, GitHub Actions for
        CI + deploy, a CSP-aware SSR template, and Rspack Module Federation pre-configured for
        React-singleton sharing. No follow-up wiring required to push to staging.
      </Callout>

      <Tabs defaultValue="pnpm">
        <TabsList>
          <TabsTrigger value="pnpm">pnpm (recommended)</TabsTrigger>
          <TabsTrigger value="npm">npm</TabsTrigger>
          <TabsTrigger value="yarn">yarn</TabsTrigger>
        </TabsList>
        <TabsContent value="pnpm">
          <CodeBlock
            language="bash"
            code={`corepack enable\ncorepack prepare pnpm@9.15.5 --activate\n\n# shorthand\npnpm create jorvel my-app\n# or\npnpm dlx jorvel@latest init my-app`}
          />
        </TabsContent>
        <TabsContent value="npm">
          <CodeBlock language="bash" code={`npm create jorvel@latest my-app\n# or\nnpx jorvel@latest init my-app`} />
        </TabsContent>
        <TabsContent value="yarn">
          <CodeBlock language="bash" code={`yarn create jorvel my-app\n# or\nyarn dlx jorvel@latest init my-app`} />
        </TabsContent>
      </Tabs>

      <p>
        Run in a terminal and <code>init</code> is interactive — it prompts for a{' '}
        <strong>template</strong> (host + remote · SaaS · blank), a <strong>package manager</strong>{' '}
        (pnpm / npm / yarn / bun), and Tailwind. Pass them as flags to skip the prompts:
      </p>
      <CodeBlock
        language="bash"
        code={`npm create jorvel@latest my-app -- --template saas --pm pnpm --tailwind\n# create-jorvel forwards every flag to \`jorvel init\``}
      />

      <h2 id="sandbox">Try it in the browser</h2>
      <p>
        No install — open a starter in a StackBlitz sandbox and edit live:
      </p>
      <ul>
        <li><a href="https://stackblitz.com/github/Ravikisha/JorvelJS/tree/main/examples/02-react">React micro-frontend</a></li>
        <li><a href="https://stackblitz.com/github/Ravikisha/JorvelJS/tree/main/examples/04-ssr">SSR + streaming + loaders</a></li>
        <li><a href="https://stackblitz.com/github/Ravikisha/JorvelJS/tree/main/examples/07-shadcn-ui">shadcn/ui page</a></li>
      </ul>

      <h2 id="walkthrough">Walkthrough</h2>

      <Steps>
        <Step title="Create a running app" active>
          <p className="mt-2">
            <code>jorvel init</code> scaffolds a <strong>complete, runnable app</strong> — the
            workspace (config, CI, deploy workflow, tooling) <em>plus</em> a starter React{' '}
            <strong>host + remote</strong>, already wired together. Like <code>create-next-app</code>:
            init, install, run. Add <code>--tailwind</code> for Tailwind; <code>--no-app</code> for a
            bare workspace.
          </p>
          <CodeBlock
            language="bash"
            code={`pnpm dlx jorvel@latest init my-app\ncd my-app\npnpm install\npnpm dev            # host on :3000, loads the dashboard remote\n# → apps/shell (host) + apps/dashboard (remote), federated + running`}
          />
        </Step>
        <Step title="Add more remotes — auto-wired">
          <p className="mt-2">
            Each new remote is <strong>automatically configured into the host</strong> — federation
            config, host route table, and the host&apos;s <code>REMOTES</code> map all updated. Pick
            a framework + language at the prompt, or pass flags. No manual wiring.
          </p>
          <CodeBlock
            language="bash"
            code={`jorvel generate remote pricing            # interactive: framework? · js/ts? · Tailwind?\njorvel generate remote billing --framework vue --lang ts\n# both are now mounted in the host at /pricing/* and /billing/* — just refresh`}
          />
        </Step>
        <Step title="Run the dev server">
          <CodeBlock
            language="bash"
            code={`jorvel dev --proxy-remotes --hmr-remotes`}
          />
          <p className="mt-2">
            <code>--proxy-remotes</code> serves every remote on the host&apos;s origin so CSP, cookies,
            and SRI behave like production. <code>--hmr-remotes</code> reloads the host when a remote
            recompiles. Before launching, <code>dev</code> checks each app&apos;s port is free and
            fails fast (<code>DEV-003</code>) with the next free port if one is taken — skip with{' '}
            <code>--no-port-check</code>.
          </p>
        </Step>
        <Step title="Add a route">
          <p className="mt-2">
            Drop a file in <code>apps/dashboard/src/pages/</code>. JORVEL uses Next.js-style file
            conventions: <code>index.tsx</code>, <code>[id].tsx</code>, <code>(group)/</code>.
          </p>
          <CodeBlock
            language="tsx"
            filename="apps/dashboard/src/pages/settings.tsx"
            code={`export default function Settings() {\n  return (\n    <main>\n      <h2>Settings</h2>\n      <p>Configure your account.</p>\n    </main>\n  );\n}`}
          />
          <p>
            Re-scan with <code>jorvel routes --watch</code>. The host now matches{' '}
            <code>/dashboard/settings</code>.
          </p>
        </Step>
        <Step title="Build for production">
          <CodeBlock
            language="bash"
            code={`jorvel build              # all apps\njorvel build --app shell  # one app`}
          />
          <p className="mt-2">
            Output lands under <code>apps/&lt;name&gt;/dist/</code>. Asset filenames carry content
            hashes; <code>remoteEntry.js</code> embeds SRI when{' '}
            <code>federation.sri</code> is on.
          </p>
        </Step>
        <Step title="Deploy">
          <Tabs defaultValue="vercel">
            <TabsList>
              <TabsTrigger value="vercel">Vercel</TabsTrigger>
              <TabsTrigger value="cloudflare">Cloudflare</TabsTrigger>
              <TabsTrigger value="node">Node / Docker</TabsTrigger>
            </TabsList>
            <TabsContent value="vercel">
              <CodeBlock language="bash" code={`jorvel deploy --target vercel\nvercel deploy`} />
            </TabsContent>
            <TabsContent value="cloudflare">
              <CodeBlock
                language="bash"
                code={`jorvel deploy --target cloudflare\nwrangler pages deploy apps/shell/dist`}
              />
            </TabsContent>
            <TabsContent value="node">
              <CodeBlock
                language="bash"
                code={`jorvel deploy --target node\ndocker build -t shell .\ndocker run -p 3000:3000 shell`}
              />
            </TabsContent>
          </Tabs>
        </Step>
      </Steps>

      <Callout variant="success" title="That's the whole flow.">
        Most teams need nothing else for their first deployment. The pages below cover advanced
        topics: typed routes, security headers, observability, and adapter customization.
      </Callout>

      <h2 id="project-layout">Project layout</h2>
      <p>
        Every workspace follows the same conventions. Knowing where things live makes the rest of
        the docs read in any order.
      </p>
      <CodeBlock
        language="text"
        code={`my-app/
├── apps/
│   ├── shell/                  # Host — owns "/", layout, auth chrome
│   │   ├── public/             # Static assets served by Rspack dev-server
│   │   ├── src/
│   │   │   ├── App.tsx         # Root React component (used by both CSR + SSR)
│   │   │   ├── bootstrap.tsx   # Client entry — calls getRouter()
│   │   │   ├── index.ts        # async import of bootstrap (federation boundary)
│   │   │   └── jorvel.routes.ts  # Auto-generated by 'jorvel routes'
│   │   ├── jorvel.app.json       # App manifest: name, type, port, exposes
│   │   ├── jorvel.federation.json# Generated by 'jorvel federation'
│   │   └── rspack.config.mjs   # Rspack + ModuleFederationPlugin
│   └── dashboard/              # Remote — owns "/dashboard/*"
│       └── src/
│           ├── remote.tsx      # Exposed entry point (./App)
│           └── pages/          # File-based routes scanned by 'jorvel routes'
├── libs/                       # Shared libraries (contracts, ui-kit, etc.)
├── jorvel.config.json            # Workspace config: federation, security, deploy
├── pnpm-workspace.yaml         # pnpm workspace declaration
├── tsconfig.base.json          # Strict TS settings shared by every app
└── .github/workflows/          # CI: typecheck / lint / test / build`}
      />

      <h2 id="lifecycle">Anatomy of a request</h2>
      <p>
        Understanding what runs where saves hours when debugging. The dev-server walkthrough below
        traces a single page navigation end-to-end.
      </p>
      <Steps>
        <Step title="1. Browser hits the host">
          <p className="mt-2">
            <code>GET /dashboard/settings</code> arrives at the Rspack dev-server on port{' '}
            <code>3000</code>. The host serves <code>index.html</code> with its bootstrap chunk.
          </p>
        </Step>
        <Step title="2. Host bootstraps">
          <p className="mt-2">
            <code>bootstrap.tsx</code> calls <code>getRouter()</code> (singleton, StrictMode-safe)
            and mounts <code>&lt;RemoteOutlet routes remotes /&gt;</code>. <code>usePathname()</code>{' '}
            returns <code>/dashboard/settings</code>.
          </p>
        </Step>
        <Step title="3. Outlet matches the route">
          <p className="mt-2">
            <code>RemoteOutlet</code> walks <code>HOST_ROUTES</code>, finds{' '}
            <code>/dashboard/*</code> → <code>{`{ remote: 'dashboard', module: './App' }`}</code>,
            and triggers <code>REMOTES.dashboard()</code> — a native dynamic{' '}
            <code>import(&apos;dashboard/App&apos;)</code>.
          </p>
        </Step>
        <Step title="4. Federation loads the remote">
          <p className="mt-2">
            Rspack&apos;s <code>ModuleFederationPlugin</code> fetches{' '}
            <code>/jorvel/remotes/dashboard/remoteEntry.js</code> (proxied to{' '}
            <code>http://localhost:3001</code> by <code>--proxy-remotes</code>), bridges the React
            share scope, and resolves <code>./App</code>.
          </p>
        </Step>
        <Step title="5. Remote renders its sub-route">
          <p className="mt-2">
            <code>&lt;RemoteApp subpath=&quot;/settings&quot; pages={'{pages}'} /&gt;</code> matches{' '}
            <code>settings.tsx</code> from the generated <code>jorvel.routes.ts</code>, lazy-imports
            the chunk, and renders the page.
          </p>
        </Step>
      </Steps>

      <h2 id="cheat-sheet">Daily commands cheat-sheet</h2>
      <p>The 80% of CLI flags you&apos;ll touch every day.</p>
      <CodeBlock
        language="bash"
        code={`# Develop
jorvel dev --proxy-remotes --hmr-remotes          # most common
jorvel routes --watch                              # in a second terminal, per remote

# Verify before pushing
jorvel typecheck                                   # tsc --noEmit per package
jorvel lint                                        # ESLint workspace-wide
jorvel test                                        # Vitest, parallel
jorvel perf                                        # bundle-size budgets
jorvel diagnose                                    # env, ports, configs

# Ship
jorvel build                                       # all apps, host first
jorvel build --app dashboard --compress            # one app + gz/br
jorvel deploy --target vercel                      # writes vercel.json`}
      />

      <h2 id="first-issue">If something breaks</h2>
      <ol>
        <li>
          Run <code>jorvel diagnose</code>. It checks Node, pnpm, Rspack versions, ports in use,
          generated federation configs, and React duplication risks.
        </li>
        <li>
          Set <code>JORVEL_DEBUG=1</code> in your shell to surface full stack traces from CLI errors.
        </li>
        <li>
          See <Link href="/docs/troubleshooting">Troubleshooting</Link> for the most-hit issues
          (Invalid hook call, remote 404, hydration mismatch).
        </li>
      </ol>

      <h2 id="next">What&apos;s next?</h2>

      <div className="not-prose grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NextCard
          icon={<NetworkIcon />}
          href="/docs/federation"
          title="Module Federation"
          body="Shared deps, allowlists, SRI, CDN public-path."
        />
        <NextCard
          icon={<ShieldIcon />}
          href="/docs/security"
          title="Security"
          body="Strict-dynamic CSP, SRI, base64url nonces."
        />
        <NextCard
          icon={<RocketIcon />}
          href="/docs/production-checklist"
          title="Production checklist"
          body="Caching, observability, version checks."
        />
      </div>

      <hr />

      <p className="text-sm text-muted-foreground">
        <CheckIcon className="mr-1 inline h-4 w-4 text-emerald-500" /> Made it through the
        quickstart? Star the repo on{' '}
        <a href="https://github.com/Ravikisha/JorvelJS" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>
    </>
  );
}

function NextCard({
  icon,
  href,
  title,
  body,
}: {
  icon: React.ReactNode;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="group block focus:outline-none">
      <Card interactive className="h-full">
        <CardHeader>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-accent">
            {icon}
          </span>
          <CardTitle className="mt-3 flex items-center justify-between text-sm">
            {title}
            <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
