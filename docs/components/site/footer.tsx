import Link from 'next/link';
import { Logo } from '@/components/site/logo';
import { GitHubIcon } from '@/components/icons';

const COLUMNS: Array<{ title: string; links: Array<{ href: string; label: string; external?: boolean }> }> = [
  {
    title: 'Learn',
    links: [
      { href: '/docs/getting-started', label: 'Getting started' },
      { href: '/docs/concepts', label: 'Core concepts' },
      { href: '/docs/cli', label: 'CLI reference' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'Build',
    links: [
      { href: '/docs/routing', label: 'Routing' },
      { href: '/docs/federation', label: 'Module Federation' },
      { href: '/docs/ssr', label: 'SSR & SSG' },
      { href: '/docs/state', label: 'State & events' },
    ],
  },
  {
    title: 'Ship',
    links: [
      { href: '/docs/deployment', label: 'Deployment' },
      { href: '/docs/security', label: 'Security' },
      { href: '/docs/observability', label: 'Observability' },
      { href: '/docs/production-checklist', label: 'Production checklist' },
    ],
  },
  {
    title: 'Project',
    links: [
      { href: 'https://github.com/Ravikisha/JorvelJS', label: 'GitHub', external: true },
      { href: 'https://github.com/Ravikisha/JorvelJS/discussions', label: 'Community', external: true },
      { href: 'https://github.com/Ravikisha/JorvelJS/releases', label: 'Releases', external: true },
      { href: 'https://github.com/Ravikisha/JorvelJS/issues', label: 'File an issue', external: true },
      { href: 'https://github.com/sponsors/Ravikisha', label: 'Sponsor', external: true },
      { href: '/docs/press', label: 'Press kit' },
      { href: '/docs/comparison', label: 'vs Next / Remix' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Opinionated micro-frontend framework on Rspack Module Federation. Typed contracts, SSR,
              edge adapters, and a CLI that just works.
            </p>
            <div className="mt-4 flex items-center gap-3 text-muted-foreground">
              <a
                href="https://github.com/Ravikisha/JorvelJS"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border p-2 transition hover:text-foreground hover:bg-background"
                aria-label="GitHub"
              >
                <GitHubIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link href={l.href} className="hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} JORVEL · MIT licensed · Built by{' '}
            <a
              href="https://github.com/ravikisha"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Ravi Kishan
            </a>
          </p>
          <p>Built with Rspack Module Federation, React, and shadcn-style design tokens.</p>
        </div>
      </div>
    </footer>
  );
}
