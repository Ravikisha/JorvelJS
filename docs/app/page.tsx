import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Spotlight } from '@/components/aceternity/spotlight';
import { InfiniteMovingCards } from '@/components/aceternity/infinite-moving-cards';
import { BentoGrid, BentoGridItem } from '@/components/aceternity/bento-grid';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { AnimatedGridPattern } from '@/components/magicui/animated-grid-pattern';
import { Particles } from '@/components/magicui/particles';
import { Marquee } from '@/components/magicui/marquee';
import { SparklesText } from '@/components/magicui/sparkles-text';
import { AuroraText } from '@/components/magicui/aurora-text';
import { MagicCard } from '@/components/magicui/magic-card';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import { Terminal, TypingAnimation, AnimatedSpan } from '@/components/magicui/terminal';
import {
  ArrowRight,
  BoltIcon,
  BoxIcon,
  ChartIcon,
  CodeIcon,
  CompassIcon,
  GitHubIcon,
  GlobeIcon,
  LayersIcon,
  NetworkIcon,
  PaletteIcon,
  PuzzleIcon,
  RocketIcon,
  ServerIcon,
  ShieldIcon,
  SparkleIcon,
  TerminalIcon,
} from '@/components/icons';

export default function Home() {
  return (
    <main>
      <Hero />
      <SocialProof />
      <FeatureGrid />
      <FrameworksAndDeploys />
      <CodeShowcase />
      <PackageMatrix />
      <Testimonials />
      <FinalCta />
    </main>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <Spotlight />
      <AnimatedGridPattern
        numSquares={32}
        maxOpacity={0.08}
        duration={3}
        className="[mask-image:radial-gradient(700px_circle_at_center,white,transparent)] inset-x-0 inset-y-[-30%] h-[200%] skew-y-12"
      />
      <Particles
        className="absolute inset-0"
        quantity={70}
        ease={80}
        color="#a3e635"
        refresh
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-20 sm:px-6 md:pb-28 md:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-fade-up">
            <Badge variant="accent" className="mb-5">
              <SparkleIcon className="h-3 w-3" />{' '}
              <SparklesText text="v0.2.0 — public beta" sparklesCount={4} />
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              The micro-frontend framework{' '}
              <AuroraText className="font-bold">
                production teams reach for.
              </AuroraText>
            </h1>
            <div className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              <TextGenerateEffect
                words="JORVEL gives you Next.js-level DX on top of Rspack Module Federation. Zero-config workspaces, typed federation contracts, file-based routing, SSR and static export, edge adapters, and a CLI that just works."
              />
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/docs/getting-started">
                <ShimmerButton
                  background="linear-gradient(135deg, hsl(244 78% 60%), hsl(280 84% 60%))"
                  className="text-sm font-semibold"
                >
                  Get started <ArrowRight className="ml-2 inline h-4 w-4" />
                </ShimmerButton>
              </Link>
              <ButtonLink href="/docs/concepts" variant="outline" size="lg">
                Read the concepts
              </ButtonLink>
              <ButtonLink href="https://github.com/Ravikisha/JorvelJS" external variant="ghost" size="lg">
                <GitHubIcon /> Star on GitHub
              </ButtonLink>
            </div>
            <div className="mt-7 max-w-md">
              <Terminal>
                <TypingAnimation>&gt; pnpm dlx jorvel@latest init my-app</TypingAnimation>
                <AnimatedSpan delay={1500} className="text-green-500">
                  ✔ Workspace ready: ./my-app
                </AnimatedSpan>
                <AnimatedSpan delay={1800} className="text-muted-foreground">
                  ↪ apps/, libs/, .github/, jorvel.config.ts
                </AnimatedSpan>
                <AnimatedSpan delay={2100} className="text-muted-foreground">
                  ↪ Initialized git repository (main).
                </AnimatedSpan>
                <AnimatedSpan delay={2400} className="text-cyan-400">
                  $ cd my-app &amp;&amp; pnpm dev:proxy
                </AnimatedSpan>
              </Terminal>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 18 packages, MIT-licensed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Linux · macOS · Windows · Node 20+
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CI: 95%+ unit coverage
              </span>
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div
              aria-hidden
              className="absolute -inset-6 rounded-3xl bg-[linear-gradient(135deg,hsl(var(--gradient-from)/0.25),hsl(var(--gradient-to)/0.25))] blur-2xl"
            />
            <MagicCard className="relative p-1" gradientFrom="#a3e635" gradientTo="#22d3ee">
              <div className="rounded-xl p-4">
                <CodeBlock
                  code={`// apps/shell/src/main.tsx
import { createRouter, RemoteOutlet } from '@jorvel/runtime';
import { remotes } from './jorvel.routes.host';

const router = createRouter({
  remotes,
  guards: [requireAuth],
});

export default function App() {
  return <RemoteOutlet router={router} />;
}`}
                  filename="apps/shell/src/main.tsx"
                  language="tsx"
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniCard
                    icon={<BoltIcon />}
                    title="Instant dev server"
                    body="One command. Host + remotes. Same origin."
                  />
                  <MiniCard
                    icon={<ShieldIcon />}
                    title="Secure by default"
                    body="CSP, SRI, allowlist. Edge-runtime safe."
                  />
                </div>
              </div>
            </MagicCard>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

/* ── Social proof / stack row ───────────────────────────────────────────── */

function SocialProof() {
  const stack = [
    'Rspack',
    'React 19',
    'TypeScript',
    'Vitest',
    'Playwright',
    'Cloudflare',
    'Vercel',
    'Web Vitals',
    'OpenTelemetry',
    'Sentry',
    'pnpm',
    'Changesets',
  ];
  return (
    <section className="border-b border-border bg-secondary/30 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Built on the modern web stack
        </p>
        <Marquee pauseOnHover className="w-full max-w-full [--duration:30s] [--gap:3rem]">
          {stack.map((s) => (
            <span
              key={s}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {s}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

/* ── Feature grid (Nucleus / Constellation inspired) ────────────────────── */

function FeatureGrid() {
  const features = [
    {
      icon: <CompassIcon />,
      title: 'File-based routing',
      body: 'Drop a file in src/pages — it becomes a route. Dynamic params, catch-alls, and (group) folders supported.',
    },
    {
      icon: <NetworkIcon />,
      title: 'Zero-config federation',
      body: 'Auto-detects exposes, shared deps, and remote URLs from jorvel.app.json. No webpack wrestling.',
    },
    {
      icon: <CodeIcon />,
      title: 'Typed federation contracts',
      body: 'InferExposed / InferEmits / InferListens turn federation boundaries into compile-time types.',
    },
    {
      icon: <ServerIcon />,
      title: 'SSR + streaming + SSG',
      body: 'renderRouteToString, renderRouteToStream, and a worker-pool staticExport with content-hash manifests.',
    },
    {
      icon: <ShieldIcon />,
      title: 'Security-first',
      body: 'Strict-dynamic CSP builder, SRI for remoteEntry, origin allowlist, base64url-validated nonces.',
    },
    {
      icon: <ChartIcon />,
      title: 'Observability hooks',
      body: 'onError / onMetric / onRemoteLoad. Web Vitals + Sentry adapter. Render-time crashes captured.',
    },
    {
      icon: <PaletteIcon />,
      title: 'CSS isolation',
      body: 'ShadowRemote mounts third-party remotes inside a Shadow DOM so styles never leak into the shell.',
    },
    {
      icon: <RocketIcon />,
      title: 'Deploy anywhere',
      body: 'Adapters for Vercel Edge, Cloudflare Workers/Pages, Node.js, and Docker. One jorvel deploy.',
    },
    {
      icon: <PuzzleIcon />,
      title: 'Plugin model',
      body: 'configResolved / federationConfig / devPlan hooks let you customize the build without forking.',
    },
  ];

  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Why JORVEL</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Everything a production MFE stack needs
          </h2>
          <p className="mt-4 text-muted-foreground">
            Drop the YAML graveyard. JORVEL gives you the small, opinionated runtime that&apos;s
            already shipped to thousands of users — without locking you out of the bundler.
          </p>
        </div>
        <BentoGrid className="mt-14 md:auto-rows-[16rem]">
          {features.map((f, i) => (
            <BentoGridItem
              key={f.title}
              className={[
                i === 0 && 'md:col-span-2',
                i === 4 && 'md:col-span-2',
                'card-sheen',
              ]
                .filter(Boolean)
                .join(' ')}
              header={
                <div className="relative flex h-32 w-full overflow-hidden rounded-xl bg-gradient-to-br from-secondary via-card to-secondary">
                  <AnimatedGridPattern
                    numSquares={8}
                    maxOpacity={0.3}
                    duration={2}
                    className="absolute inset-0 [mask-image:radial-gradient(180px_circle_at_center,white,transparent)]"
                  />
                  <span
                    className="absolute inset-0 m-auto inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-accent shadow-md"
                    aria-hidden
                  >
                    {f.icon}
                  </span>
                </div>
              }
              title={f.title}
              description={f.body}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}

/* ── Framework + deploy matrix (Clerk-inspired) ────────────────────────── */

function FrameworksAndDeploys() {
  const frameworks = [
    { name: 'React 18 / 19', body: 'First-class. Hooks, Suspense, Server Components, transitions.' },
    { name: 'Vue 3', body: 'Mount Vue remotes via the runtime; share state through @jorvel/event-bus.' },
    { name: 'Web Components', body: 'Drop any custom-element remote — Shadow DOM isolation built in.' },
    { name: 'Solid / Svelte', body: 'Federation works at the bundler level, agnostic to UI library.' },
  ];
  const deploys = [
    { name: 'Vercel', body: 'Edge Functions + immutable static asset cache.' },
    { name: 'Cloudflare', body: 'Workers + Pages Functions, ReadableStream responses.' },
    { name: 'Node.js / Docker', body: 'Slow-loris hardened HTTP server, structured logs, MIME table.' },
    { name: 'Self-host', body: 'Static export with parallel renders + content hashes.' },
  ];
  return (
    <section className="border-b border-border bg-secondary/30 py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Badge variant="outline">UI frameworks</Badge>
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            Bring any framework. Federate anything.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Module Federation is a bundler concept — JORVEL is framework-agnostic at the seam. Use
            React in the host and Vue in a remote, or ship plain Web Components.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {frameworks.map((f) => (
              <li key={f.name} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">{f.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/docs/federation"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Federation guide <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div>
          <Badge variant="outline">Deploy targets</Badge>
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            One CLI. Every runtime.
          </h2>
          <p className="mt-3 text-muted-foreground">
            <code className="rounded bg-secondary px-1 py-0.5 text-foreground">jorvel deploy</code>{' '}
            dynamically loads the right adapter package — Vercel Edge, Cloudflare, or Node — and
            scaffolds a working config in seconds.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {deploys.map((d) => (
              <li key={d.name} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{d.body}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/docs/deployment"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Deployment guide <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Code showcase ─────────────────────────────────────────────────────── */

function CodeShowcase() {
  const config = `{
  "$schema": "./node_modules/@jorvel/types/schemas/jorvel.config.json",
  "name": "shop",
  "appsDir": "apps",
  "features": { "tailwind": true },
  "federation": {
    "shared": ["react", "react-dom", "@jorvel/event-bus"],
    "allowlist": ["*.acme.dev", "**.cdn.cloudflare.net"],
    "sri": true
  }
}`;

  const remote = `// apps/dashboard/src/pages/users/[id].tsx
import { useParams } from '@jorvel/runtime';
import { useRemoteData } from '@jorvel/runtime';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useRemoteData(['user', id], () =>
    fetch(\`/api/users/\${id}\`).then((r) => r.json()),
  );

  if (error) throw error;
  if (!data) return <Skeleton />;
  return <UserCard user={data} />;
}`;

  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Developer experience</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            APIs you already know.
          </h2>
          <p className="mt-4 text-muted-foreground">
            File-based routes, typed config, hooks for data and params. Nothing new to learn — just
            the federation primitives you wished React Router shipped with.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <CodeBlock code={config} filename="jorvel.config.json" language="json" />
          <CodeBlock code={remote} filename="apps/dashboard/src/pages/users/[id].tsx" language="tsx" />
        </div>
      </div>
    </section>
  );
}

/* ── Package matrix ────────────────────────────────────────────────────── */

function PackageMatrix() {
  const pkgs = [
    { name: 'jorvel', icon: <TerminalIcon />, body: 'Project scaffolding, dev orchestration, deploy.' },
    { name: '@jorvel/runtime', icon: <BoltIcon />, body: 'Router, remote loader, hooks, telemetry, guards.' },
    { name: '@jorvel/ssr', icon: <ServerIcon />, body: 'Render to string/stream, static export, edge adapter.' },
    { name: '@jorvel/security', icon: <ShieldIcon />, body: 'CSP, SRI, allowlist, safe JSON hydration.' },
    { name: '@jorvel/observability', icon: <ChartIcon />, body: 'onError / onMetric / onRemoteLoad + Web Vitals.' },
    { name: '@jorvel/state', icon: <BoxIcon />, body: 'Singleton store registry + React adapter + persistence.' },
    { name: '@jorvel/event-bus', icon: <NetworkIcon />, body: 'Typed pub/sub. onAny + replay + per-bus errors.' },
    { name: '@jorvel/types', icon: <LayersIcon />, body: 'Federation contracts. JSON schemas for config files.' },
    { name: '@jorvel/ui', icon: <PaletteIcon />, body: 'Headless primitives — Button, ThemeProvider.' },
    { name: '@jorvel/adapter-vercel', icon: <GlobeIcon />, body: 'Vercel Edge functions + immutable assets.' },
    { name: '@jorvel/adapter-cloudflare', icon: <GlobeIcon />, body: 'Cloudflare Workers + Pages Functions.' },
    { name: '@jorvel/adapter-node', icon: <ServerIcon />, body: 'Hardened Node HTTP server + Docker template.' },
  ];
  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Modular by design</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            12+ packages. Use what you need.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every package ships independently with proper exports, sideEffects: false, and changeset
            versioning. Pull in only the runtime you actually deploy.
          </p>
        </div>
        <div className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pkgs.map((p) => (
            <div
              key={p.name}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-accent/40"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-accent">
                {p.icon}
              </span>
              <div className="min-w-0">
                <a
                  href={`https://www.npmjs.com/package/${p.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-sm font-medium text-foreground hover:text-accent hover:underline"
                >
                  {p.name}
                </a>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────────── */

function Testimonials() {
  const quotes = [
    {
      quote:
        'We had a Rspack + Module Federation monorepo we were terrified to touch. Migrated to JORVEL in a weekend; the CLI did 90% of the wiring.',
      author: 'Brandon Cranston',
      role: 'Co-founder / CTO, fictional',
    },
    {
      quote:
        'Typed federation contracts caught two breakage classes the day we adopted them. The SSR streaming + ETag-before-render combo cut p95 by 40%.',
      author: 'Alice Xavier',
      role: 'Staff engineer, fictional',
    },
    {
      quote:
        "The CSP/SRI plumbing alone saved us a quarter of platform work. It's the first MFE framework that doesn't feel like a side project.",
      author: 'James Clear',
      role: 'DevOps engineer, fictional',
    },
  ];
  return (
    <section className="border-b border-border bg-secondary/30 py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Loved by teams</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Quietly running production in a few teams already.
          </h2>
        </div>
        <div className="mt-14">
          <InfiniteMovingCards
            items={quotes.map((q) => ({
              quote: q.quote,
              name: q.author,
              title: q.role,
            }))}
            direction="right"
            speed="slow"
          />
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ─────────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="glow-orb left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2" aria-hidden />
      <Particles className="absolute inset-0" quantity={50} ease={70} color="#22d3ee" />
      <div className="relative mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
          Ship your first federated app{' '}
          <AuroraText className="font-bold">in under an hour.</AuroraText>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Scaffold a workspace, generate a host + remote, and deploy to the edge. No YAML required.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/docs/getting-started" variant="gradient" size="lg">
            Start the tutorial <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="/docs/production-checklist" variant="outline" size="lg">
            Production checklist
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
