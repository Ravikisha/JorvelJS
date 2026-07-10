'use client';

import * as React from 'react';

/**
 * Thin scroll-progress rail pinned just under the sticky header. Reads the
 * document scroll position; the iris→lime fill mirrors the site's seam accent.
 * Hidden from AT (decorative) and frozen for reduced-motion users.
 */
export function ReadingProgress() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-14 z-30 h-0.5 bg-transparent"
    >
      <div
        className="h-full origin-left bg-[linear-gradient(90deg,hsl(var(--gradient-from)),hsl(var(--gradient-to)))] transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
