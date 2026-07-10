import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 group', className)}>
      <span
        aria-hidden
        className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg shadow-md shadow-accent/30"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logojorvel.png" alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
      </span>
      {withWordmark && (
        <span className="flex items-baseline gap-1.5 text-sm">
          <span className="font-display text-[0.95rem] font-bold tracking-tight">JORVEL</span>
          <span className="hidden sm:inline rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            v0.2.0
          </span>
        </span>
      )}
    </Link>
  );
}

