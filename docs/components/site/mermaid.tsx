'use client';

import * as React from 'react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface MermaidProps {
  /** Mermaid diagram source. Use `:::host` / `:::remote` classes for the
   *  iris (host) / lime (remote) accents that match the rest of the docs. */
  chart: string;
  /** Short line under the diagram explaining what it shows. */
  caption?: string;
  className?: string;
}

const FONT =
  'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif';

/** themeVariables tuned to the iris × lime token system, per resolved theme. */
function themeVariables(dark: boolean): Record<string, string> {
  return dark
    ? {
        darkMode: 'true',
        background: 'transparent',
        fontFamily: FONT,
        fontSize: '14px',
        primaryColor: '#17151f',
        primaryBorderColor: '#8b7cf6',
        primaryTextColor: '#e9e9ee',
        secondaryColor: '#1a2012',
        secondaryBorderColor: '#84cc16',
        secondaryTextColor: '#e9e9ee',
        tertiaryColor: '#121216',
        tertiaryBorderColor: '#2a2a32',
        lineColor: '#52525b',
        textColor: '#c7c7d1',
        mainBkg: '#16161c',
        nodeBorder: '#8b7cf6',
        clusterBkg: 'rgba(139,124,246,0.06)',
        clusterBorder: '#2a2a32',
        titleColor: '#ededed',
        edgeLabelBackground: '#0e0e12',
        actorBkg: '#16161c',
        actorBorder: '#8b7cf6',
        actorTextColor: '#ededed',
        actorLineColor: '#3f3f46',
        signalColor: '#a1a1aa',
        signalTextColor: '#c7c7d1',
        labelBoxBkgColor: '#17151f',
        labelBoxBorderColor: '#8b7cf6',
        labelTextColor: '#ededed',
        loopTextColor: '#c7c7d1',
        noteBkgColor: 'rgba(163,230,53,0.12)',
        noteBorderColor: '#84cc16',
        noteTextColor: '#e9e9ee',
        activationBkgColor: '#8b7cf6',
        activationBorderColor: '#a78bfa',
      }
    : {
        darkMode: 'false',
        background: 'transparent',
        fontFamily: FONT,
        fontSize: '14px',
        primaryColor: '#f5f3ff',
        primaryBorderColor: '#6d4bd6',
        primaryTextColor: '#1c1c22',
        secondaryColor: '#f3f8e8',
        secondaryBorderColor: '#4d7c0f',
        secondaryTextColor: '#1c1c22',
        tertiaryColor: '#fafafa',
        tertiaryBorderColor: '#e4e4e7',
        lineColor: '#94a3b8',
        textColor: '#3f3f46',
        mainBkg: '#ffffff',
        nodeBorder: '#6d4bd6',
        clusterBkg: 'rgba(109,75,214,0.05)',
        clusterBorder: '#e4e4e7',
        titleColor: '#18181b',
        edgeLabelBackground: '#ffffff',
        actorBkg: '#ffffff',
        actorBorder: '#6d4bd6',
        actorTextColor: '#18181b',
        actorLineColor: '#cbd5e1',
        signalColor: '#64748b',
        signalTextColor: '#3f3f46',
        labelBoxBkgColor: '#f5f3ff',
        labelBoxBorderColor: '#6d4bd6',
        labelTextColor: '#18181b',
        loopTextColor: '#3f3f46',
        noteBkgColor: 'rgba(77,124,15,0.10)',
        noteBorderColor: '#4d7c0f',
        noteTextColor: '#1c1c22',
        activationBkgColor: '#6d4bd6',
        activationBorderColor: '#6d4bd6',
      };
}

export function Mermaid({ chart, caption, className }: MermaidProps) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const reactId = React.useId();
  const domId = React.useMemo(() => `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`, [reactId]);

  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          fontFamily: FONT,
          themeVariables: themeVariables(dark),
          flowchart: { htmlLabels: true, curve: 'basis', padding: 14 },
          sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 48 },
        });
        const { svg } = await mermaid.render(domId, chart.trim());
        if (!cancelled) setSvg(svg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, dark, domId]);

  return (
    <figure
      className={cn(
        'not-prose my-6 overflow-hidden rounded-xl border border-border bg-card/40',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="eyebrow !text-[10px] !tracking-[0.14em]">Diagram</span>
        {caption && (
          <span className="truncate pl-3 text-xs text-muted-foreground">{caption}</span>
        )}
      </figcaption>
      <div className="mermaid-canvas overflow-x-auto px-4 py-6">
        {error ? (
          <pre className="m-0 whitespace-pre-wrap text-xs text-destructive">
            Diagram failed to render: {error}
          </pre>
        ) : svg ? (
          <div
            className="mx-auto flex min-w-fit justify-center [&_svg]:h-auto [&_svg]:max-w-full"
            // Sanitized by mermaid (securityLevel: 'strict' + DOMPurify).
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex h-40 items-center justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        )}
      </div>
    </figure>
  );
}
