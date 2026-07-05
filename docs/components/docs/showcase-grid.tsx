'use client';

import * as React from 'react';
import { MagicCard } from '@/components/magicui/magic-card';
import {
  GitHubIcon,
  ExternalIcon,
  CopyIcon,
  CheckIcon,
  BoxIcon,
  LayersIcon,
  ServerIcon,
  GlobeIcon,
} from '@/components/icons';

const REPO = 'Ravikisha/JorvelJS';

type Project = {
  name: string;
  title: string;
  desc: string;
  tags: string[];
  icon: React.ReactNode;
  run: string;
};

const PROJECTS: Project[] = [
  { name: '01-react-ts', title: 'React · TypeScript', desc: 'React host + remote in TypeScript — the canonical two-tier federation setup. Real .tsx source.', tags: ['react', 'typescript', 'federation'], icon: <LayersIcon className="h-5 w-5" />, run: 'jorvel dev' },
  { name: '02-react-js', title: 'React · JavaScript', desc: 'The same host + remote in JavaScript — .jsx/.js + jsconfig, no TypeScript.', tags: ['react', 'javascript'], icon: <LayersIcon className="h-5 w-5" />, run: 'jorvel dev' },
  { name: '03-vue', title: 'React + Vue', desc: 'A React host embedding a real Vue 3 SFC remote via the framework-neutral mount contract.', tags: ['vue', 'federation', 'mount'], icon: <BoxIcon className="h-5 w-5" />, run: 'jorvel dev' },
  { name: '04-polyglot', title: 'Polyglot', desc: 'One React host + React, Vue, Angular, Solid, and Svelte remotes — five frameworks, one app, all Tailwind.', tags: ['vue', 'angular', 'svelte'], icon: <ServerIcon className="h-5 w-5" />, run: 'jorvel dev' },
  { name: '05-tailwind', title: 'Tailwind CSS', desc: 'React host + remote with Tailwind wired end to end — PostCSS through rspack, not a CDN.', tags: ['tailwind', 'postcss'], icon: <GlobeIcon className="h-5 w-5" />, run: 'jorvel dev' },
  { name: '06-shadcn', title: 'shadcn/ui', desc: 'A Tailwind-wired React remote ready for shadcn/ui — scaffold, then npx shadcn add.', tags: ['shadcn', 'ui', 'tailwind'], icon: <BoxIcon className="h-5 w-5" />, run: 'jorvel dev' },
];

const secondary =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-medium !text-foreground/80 transition hover:border-foreground/25 hover:bg-secondary hover:!text-foreground';

function CloneButton({ name, run }: { name: string; run: string }) {
  const [copied, setCopied] = React.useState(false);
  const cmd = `git clone https://github.com/${REPO} && cd JorvelJS/examples/${name} && pnpm install && ${run}`;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/20"
      aria-label={`Copy clone & run command for ${name}`}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? 'Copied to clipboard' : 'Clone & run'}
    </button>
  );
}

export function ShowcaseGrid() {
  return (
    <div className="jorvel-showcase not-prose my-8 grid gap-5 sm:grid-cols-2">
      {PROJECTS.map((p) => (
        <MagicCard key={p.name} className="overflow-hidden rounded-2xl" gradientFrom="#6366f1" gradientTo="#22d3ee">
          <div className="flex h-full flex-col p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/25 text-accent ring-1 ring-inset ring-white/10">
                {p.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight text-foreground">{p.title}</h3>
                <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground/80">
                  examples/{p.name}
                </p>
              </div>
            </div>

            <p className="mt-3.5 text-[13.5px] leading-relaxed text-muted-foreground">{p.desc}</p>

            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-auto space-y-2 border-t border-border/70 pt-4">
              <a
                href={`https://stackblitz.com/github/${REPO}/tree/main/examples/${p.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold !text-white shadow-sm transition hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, hsl(244 78% 60%), hsl(190 84% 52%))' }}
              >
                <ExternalIcon className="h-4 w-4" /> Open in StackBlitz
              </a>
              <div className="flex gap-2">
                <a href={`https://codesandbox.io/s/github/${REPO}/tree/main/examples/${p.name}`} target="_blank" rel="noopener noreferrer" className={secondary}>
                  <ExternalIcon className="h-3.5 w-3.5" /> CodeSandbox
                </a>
                <a href={`https://codespaces.new/${REPO}?machine=basicLinux32gb`} target="_blank" rel="noopener noreferrer" className={secondary}>
                  <GitHubIcon className="h-3.5 w-3.5" /> Codespaces
                </a>
                <a href={`https://github.com/${REPO}/tree/main/examples/${p.name}`} target="_blank" rel="noopener noreferrer" className={secondary}>
                  <GitHubIcon className="h-3.5 w-3.5" /> GitHub
                </a>
              </div>
              <CloneButton name={p.name} run={p.run} />
            </div>
          </div>
        </MagicCard>
      ))}
    </div>
  );
}
