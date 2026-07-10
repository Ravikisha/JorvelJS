'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siblings } from '@/app/docs/nav';
import { ArrowRight } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Prev / next page navigation, derived from the sidebar reading order in
 * `DOC_NAV`. Rendered at the foot of every doc article so readers can move
 * through the docs linearly without hunting the sidebar.
 */
export function DocsPager({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';
  const { prev, next } = siblings(pathname);

  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn('not-prose mt-16 grid gap-4 border-t border-border pt-8 sm:grid-cols-2', className)}
    >
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-accent/50 hover:bg-card"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="mt-1 font-display text-sm font-semibold text-foreground group-hover:text-accent">
            {prev.label}
          </span>
          <span className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground/70">
            {prev.section}
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}

      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col rounded-xl border border-border bg-card/60 p-4 text-right transition-colors hover:border-accent/50 hover:bg-card"
        >
          <span className="flex items-center justify-end gap-1.5 text-xs font-medium text-muted-foreground">
            Next
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1 font-display text-sm font-semibold text-foreground group-hover:text-accent">
            {next.label}
          </span>
          <span className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground/70">
            {next.section}
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
    </nav>
  );
}
