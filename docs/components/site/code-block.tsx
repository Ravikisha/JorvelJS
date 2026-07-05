'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, CopyIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { highlight, languageFromString } from '@/lib/highlight';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

export function CodeBlock({
  code,
  language,
  filename,
  className,
  showLineNumbers,
  highlightLines,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const grammar = languageFromString(language);

  const tokenized = React.useMemo(() => highlight(code, grammar), [code, grammar]);
  const lines = React.useMemo(() => code.split('\n'), [code]);
  const tokenizedLines = React.useMemo(() => {
    if (!showLineNumbers && !highlightLines?.length) return null;
    return lines.map((line) => highlight(line, grammar));
  }, [lines, grammar, showLineNumbers, highlightLines]);

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }, [code]);

  return (
    <div
      className={cn(
        'code-block group relative my-4 overflow-hidden rounded-xl border border-white/5 bg-[hsl(240_10%_5%)] text-sm shadow-lg shadow-black/30',
        className,
      )}
    >
      {(filename || language) && (
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] py-2 pl-4 pr-11">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            </span>
            {filename && <span className="ml-3 truncate text-zinc-300">{filename}</span>}
          </div>
          {language && (
            <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
              {language}
            </span>
          )}
        </div>
      )}
      <pre className="code-pre m-0 overflow-x-auto rounded-none border-0 bg-transparent p-4 leading-relaxed">
        {tokenizedLines ? (
          <code className="font-mono text-[13px]">
            {tokenizedLines.map((line, idx) => {
              const lineNumber = idx + 1;
              const isHighlighted = highlightLines?.includes(lineNumber);
              return (
                <span
                  key={idx}
                  className={cn(
                    'flex',
                    isHighlighted && 'bg-accent/15 -mx-4 px-4 border-l-2 border-accent',
                  )}
                >
                  {showLineNumbers && (
                    <span
                      aria-hidden
                      className="mr-4 inline-block w-6 select-none text-right text-zinc-600"
                    >
                      {lineNumber}
                    </span>
                  )}
                  <span className="flex-1">
                    {line}
                    {idx < tokenizedLines.length - 1 ? '\n' : ''}
                  </span>
                </span>
              );
            })}
          </code>
        ) : (
          <code className="font-mono text-[13px]">{tokenized}</code>
        )}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className="absolute right-2 top-2 h-7 w-7 text-zinc-400 opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
