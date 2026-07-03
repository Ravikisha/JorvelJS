#!/usr/bin/env node
/**
 * `create-jorvel` — the `npm create jorvel@latest <name>` entry point.
 *
 * Thin wrapper: it resolves the installed `jorvel` CLI and runs `jorvel init`
 * with the forwarded arguments. Keeping the scaffolding logic in one place
 * (the `init` command) means `create-jorvel` never drifts from `jorvel init`.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** Resolve the `jorvel` CLI entry (its `bin`/`main` → dist/index.js). */
export function resolveJorvelBin(): string {
  // `jorvel` is a direct dependency, so its package.json is always resolvable.
  const pkgPath = require.resolve('jorvel/package.json');
  const pkg = require('jorvel/package.json') as { bin?: Record<string, string> | string; main?: string };
  const binRel =
    typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin?.['jorvel'] ?? pkg.main ?? 'dist/index.js');
  return path.resolve(path.dirname(pkgPath), binRel);
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const binPath = resolveJorvelBin();
  // Prepend the `init` subcommand; pass everything else through verbatim so
  // `create-jorvel my-app --pm npm --template saas` works as expected.
  const result = spawnSync(process.execPath, [binPath, 'init', ...argv], { stdio: 'inherit' });
  if (result.error) {
    console.error(`create-jorvel: failed to launch jorvel — ${result.error.message}`);
    return 1;
  }
  return result.status ?? 0;
}

// Only auto-run when invoked as the binary (not when imported by a test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
