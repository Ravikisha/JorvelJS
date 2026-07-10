'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOC_NAV } from '@/app/docs/nav';
import { cn } from '@/lib/utils';

export function DocsSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';
  const activeRef = React.useRef<HTMLAnchorElement>(null);

  // Keep the current page visible when the sidebar is scrolled far down — the
  // API section sits well below the fold. `nearest` avoids yanking the page.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);

  return (
    <aside
      className={cn(
        'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start overflow-y-auto py-8 pr-4 lg:block',
        '[mask-image:linear-gradient(to_bottom,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]',
        className,
      )}
    >
      <nav className="space-y-7" aria-label="Documentation">
        {DOC_NAV.map((section) => (
          <div key={section.title}>
            <p className="eyebrow mb-2 px-2 !text-[10px] !tracking-[0.14em]">{section.title}</p>
            <ul className="space-y-0.5">
              {section.links.map((l) => {
                const active = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      ref={active ? activeRef : undefined}
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-accent/10 font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full transition-all',
                          active
                            ? 'bg-[hsl(var(--brand-glow))] shadow-[0_0_0_3px_hsl(var(--brand-glow)/0.18)]'
                            : 'bg-border group-hover:bg-muted-foreground/60',
                        )}
                      />
                      <span className="truncate">{l.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
