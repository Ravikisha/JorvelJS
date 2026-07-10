import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import {
  ArrowRight,
  BookIcon,
  BoltIcon,
  ChartIcon,
  CodeIcon,
  CompassIcon,
  GlobeIcon,
  LayersIcon,
  NetworkIcon,
  RocketIcon,
  ServerIcon,
  ShieldIcon,
  SparkleIcon,
  TerminalIcon,
} from '@/components/icons';

export const metadata = {
  title: 'Documentation',
  description:
    'Build, deploy, and operate production micro-frontends with JORVEL. Quickstart, concepts, API reference, and deployment guides.',
};

export default function DocsIndex() {
  return (
    <div className="not-prose">
      <Hero />
      <QuickFinds />
      <ByExperience />
      <Frameworks />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border pb-12">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative">
        <Badge variant="accent" className="mb-4">
          <SparkleIcon className="h-3 w-3" /> Documentation
        </Badge>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          Build production micro-frontends.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Everything you need to scaffold, federate, secure, render, and deploy. Start with the
          quickstart or jump straight to the topic you&apos;re solving.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/docs/getting-started" variant="gradient" size="md">
            Quickstart <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="/docs/concepts" variant="outline" size="md">
            Read the concepts
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function QuickFinds() {
  const items = [
    {
      icon: <RocketIcon />,
      title: 'Get setup',
      body: 'From an empty directory to a running host + remote with HMR — in five commands.',
      href: '/docs/getting-started',
    },
    {
      icon: <CompassIcon />,
      title: 'Core concepts',
      body: 'How JORVEL thinks about hosts, remotes, federation, and the runtime contract.',
      href: '/docs/concepts',
    },
    {
      icon: <TerminalIcon />,
      title: 'CLI reference',
      body: 'Every command, every flag. init, generate, dev, build, federation, routes, deploy.',
      href: '/docs/cli',
    },
    {
      icon: <ShieldIcon />,
      title: 'Production checklist',
      body: 'CSP, SRI, caching, observability, version checks. Ship without surprises.',
      href: '/docs/production-checklist',
    },
  ];
  return (
    <section className="py-12">
      <p className="eyebrow mb-2">Get started</p>
      <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Quickfind</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="group block focus:outline-none">
            <Card interactive className="h-full">
              <CardHeader>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent">
                  {it.icon}
                </span>
                <CardTitle className="mt-3 flex items-center justify-between text-base">
                  {it.title}
                  <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="leading-relaxed">{it.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ByExperience() {
  const tracks: {
    title: string;
    blurb: string;
    items: { href: string; label: string; body: string; icon: React.ReactNode }[];
  }[] = [
    {
      title: 'I am new to micro-frontends',
      blurb: 'Start here. We assume zero prior MFE knowledge and walk through every concept.',
      items: [
        {
          href: '/docs/concepts',
          label: 'Core concepts',
          body: 'Hosts, remotes, federation contracts, the runtime contract.',
          icon: <CompassIcon />,
        },
        {
          href: '/docs/getting-started',
          label: 'Hello, JORVEL',
          body: 'Five-command quickstart from empty folder to dev server.',
          icon: <RocketIcon />,
        },
        {
          href: '/docs/routing',
          label: 'Routing tour',
          body: 'File-based routes, params, guards, RemoteOutlet, NavLink.',
          icon: <CompassIcon />,
        },
      ],
    },
    {
      title: 'I know MFE — show me the framework',
      blurb: 'Skim the modules, dive into the API. Examples assume Rspack + React 18/19.',
      items: [
        {
          href: '/docs/federation',
          label: 'Module Federation',
          body: 'Shared-deps strategy, allowlists, SRI, CDN public-path.',
          icon: <NetworkIcon />,
        },
        {
          href: '/docs/ssr',
          label: 'SSR & static export',
          body: 'renderRouteToString, streaming, ETag-before-render, manifest hashes.',
          icon: <ServerIcon />,
        },
        {
          href: '/docs/api/runtime',
          label: '@jorvel/runtime API',
          body: 'createRouter, RemoteOutlet, hooks, prefetchRoute, telemetry.',
          icon: <CodeIcon />,
        },
      ],
    },
    {
      title: 'I am shipping to production',
      blurb: 'Operations checklist: security, deploys, observability, rollbacks.',
      items: [
        {
          href: '/docs/security',
          label: 'Security',
          body: 'Strict-dynamic CSP, SRI, allowlists, base64url nonces.',
          icon: <ShieldIcon />,
        },
        {
          href: '/docs/observability',
          label: 'Observability',
          body: 'onError / onMetric / onRemoteLoad. Web Vitals + Sentry adapter.',
          icon: <ChartIcon />,
        },
        {
          href: '/docs/deployment',
          label: 'Deployment',
          body: 'Vercel Edge, Cloudflare Workers, Node, Docker — pick one or many.',
          icon: <RocketIcon />,
        },
      ],
    },
  ];
  return (
    <section className="py-12">
      <p className="eyebrow mb-2">Find the path that fits</p>
      <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Pick your track</h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {tracks.map((t) => (
          <div key={t.title} className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold">{t.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
            <ul className="mt-4 space-y-3">
              {t.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    className="group flex items-start gap-3 rounded-md p-2 transition hover:bg-secondary/60"
                  >
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-accent">
                      {i.icon}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-accent">
                        {i.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{i.body}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Frameworks() {
  const fw = [
    {
      icon: <BoltIcon />,
      label: 'React',
      body: 'First-class. Hooks, Suspense, Server Components, transitions.',
      href: '/docs/getting-started',
    },
    {
      icon: <LayersIcon />,
      label: 'Vue',
      body: 'Mount Vue remotes; share state via @jorvel/event-bus.',
      href: '/docs/federation',
    },
    {
      icon: <BookIcon />,
      label: 'Web Components',
      body: 'Drop any custom element — Shadow DOM isolation built in.',
      href: '/docs/css-isolation',
    },
    {
      icon: <GlobeIcon />,
      label: 'Solid / Svelte',
      body: 'Federation works at the bundler — agnostic to UI library.',
      href: '/docs/federation',
    },
  ];
  return (
    <section className="py-12">
      <p className="eyebrow mb-2">Bring any framework</p>
      <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Explore by stack</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fw.map((f) => (
          <Link key={f.label} href={f.href} className="group block focus:outline-none">
            <Card interactive className="h-full">
              <CardHeader>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent">
                  {f.icon}
                </span>
                <CardTitle className="mt-3 text-base">{f.label}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
