'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * Auto-generated table of contents. Reads h2 / h3 inside the rendered article
 * and tracks the current section via IntersectionObserver.
 */
export function DocsToc({ className }: { className?: string }) {
  const pathname = usePathname();
  const [headings, setHeadings] = React.useState<Heading[]>([]);
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Re-scan whenever the route changes — the App Router keeps this component
    // mounted across client navigations, so a `[]` effect would go stale.
    setActive(null);
    const article = document.querySelector('article.prose-jorvel');
    if (!article) {
      setHeadings([]);
      return;
    }
    const nodes = Array.from(article.querySelectorAll<HTMLElement>('h2, h3'));
    const list: Heading[] = [];
    for (const node of nodes) {
      if (!node.id) {
        const id = (node.textContent ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
        if (id) node.id = id;
      }
      list.push({
        id: node.id,
        text: node.textContent ?? '',
        level: node.tagName === 'H3' ? 3 : 2,
      });
    }
    setHeadings(list);

    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <aside
      className={cn(
        'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start overflow-y-auto py-8 pl-4 xl:block',
        className,
      )}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        On this page
      </p>
      <ul className="border-l border-border text-sm">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={cn(
                // border sits ON the rail for BOTH levels (indent via padding,
                // not margin) so nested items never sprout an offset line.
                '-ml-px block border-l-2 border-transparent py-1 leading-snug transition-colors hover:border-foreground/30 hover:text-foreground',
                h.level === 3 ? 'pl-7' : 'pl-4',
                active === h.id
                  ? 'border-accent font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
