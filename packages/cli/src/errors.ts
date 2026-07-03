import kleur from 'kleur';

export type CliErrorOptions = {
  /** Command name/prefix, e.g. "ssr" or "dev". */
  command?: string;
  /** Exit code to set (default 1). */
  exitCode?: number;
  /** Optional extra hint line(s) printed in yellow (remediation guidance). */
  hint?: string | string[];
  /** Structured code for scripted CI consumption (e.g. "CONFIG-001"). */
  code?: string;
};

export class JorvelCliError extends Error {
  public readonly code?: string;
  public readonly hint?: string | string[];
  public readonly exitCode: number;
  constructor(message: string, opts: { code?: string; hint?: string | string[]; exitCode?: number } = {}) {
    super(message);
    this.name = 'JorvelCliError';
    if (opts.code !== undefined) this.code = opts.code;
    if (opts.hint !== undefined) this.hint = opts.hint;
    this.exitCode = opts.exitCode ?? 1;
  }
}

export function formatCliError(err: unknown): { message: string; stack?: string; code?: string } {
  if (err instanceof JorvelCliError) {
    const out: { message: string; stack?: string; code?: string } = { message: err.message };
    if (err.stack) out.stack = err.stack;
    if (err.code) out.code = err.code;
    return out;
  }
  if (err instanceof Error) {
    const out: { message: string; stack?: string } = { message: err.message };
    if (err.stack) out.stack = err.stack;
    return out;
  }
  return { message: String(err) };
}

export function printCliError(err: unknown, opts: CliErrorOptions = {}) {
  const { message, stack, code } = formatCliError(err);
  const prefix = opts.command ? `jorvel ${opts.command}` : 'jorvel';
  const codeStr = opts.code ?? code;
  const codePrefix = codeStr ? `[${codeStr}] ` : '';

  // eslint-disable-next-line no-console
  console.error(kleur.red(`${prefix} failed: ${codePrefix}${message}`));

  const hintFromErr = err instanceof JorvelCliError ? err.hint : undefined;
  const hints = (opts.hint ?? hintFromErr)
    ? Array.isArray(opts.hint ?? hintFromErr)
      ? (opts.hint ?? hintFromErr) as string[]
      : [(opts.hint ?? hintFromErr) as string]
    : [];
  for (const line of hints) {
    // eslint-disable-next-line no-console
    console.error(kleur.yellow(line));
  }

  // Deep-link to the error reference so users can self-serve a fix.
  if (codeStr) {
    // eslint-disable-next-line no-console
    console.error(kleur.dim(`Docs: https://jorveljs.vercel.app/docs/errors/${codeStr}`));
  }

  const debug = process.env['JORVEL_DEBUG'] === '1' || process.env['JORVEL_DEBUG'] === 'true';
  if (debug && stack) {
    // eslint-disable-next-line no-console
    console.error(kleur.gray(stack));
  }

  const exit = opts.exitCode ?? (err instanceof JorvelCliError ? err.exitCode : 1);
  process.exitCode = exit;
}

/**
 * Set process.exit synchronously after flushing stderr. Use only when you
 * cannot rely on `return` reaching the action's end (e.g. inside a watcher
 * callback that schedules child processes).
 */
export function failHard(err: unknown, opts: CliErrorOptions = {}): never {
  printCliError(err, opts);
  // process.exitCode is set by printCliError; force exit.
  process.exit(process.exitCode ?? opts.exitCode ?? 1);
}
