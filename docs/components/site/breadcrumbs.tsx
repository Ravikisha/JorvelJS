'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siblings } from '@/app/docs/nav';
import { cn } from '@/lib/utils';

/**
 * Compact "Docs / <section> / <page>" trail above each article heading.
 * Section + page come from DOC_NAV so the crumb always matches the sidebar.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';
  const { current } = siblings(pathname);
  if (!current) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'not-prose mb-5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      <Link href="/docs" className="transition-colors hover:text-foreground">
        Docs
      </Link>
      <Sep />
      <span className="text-muted-foreground/80">{current.section}</span>
      <Sep />
      <span className="text-foreground">{current.label}</span>
    </nav>
  );
}

function Sep() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-border"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
