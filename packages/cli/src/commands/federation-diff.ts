/**
 * `jorvel federation diff [--base <ref>]`
 *
 * Compares each app's `jorvel.federation.json` between a git base ref and the
 * working tree, classifies every change by severity, and exits non-zero when a
 * BREAKING change is present — a CI gate against accidental contract breaks
 * (removed exposes, dropped remotes, singleton demotions).
 *
 * The pure `diffFederationConfigs` core takes two name→config maps so it can be
 * unit-tested without git.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import kleur from 'kleur';
import { Command } from 'commander';
import { loadWorkspaceConfig } from '../config.js';
import { discoverApps } from '../discovery.js';

const execFileAsync = promisify(execFile);

export type DiffSeverity = 'breaking' | 'risky' | 'compatible' | 'info';

export interface SharedSpec {
  singleton?: boolean;
  eager?: boolean;
  requiredVersion?: string | false;
}

export interface DiffableFederationConfig {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, SharedSpec>;
}

export interface FederationChange {
  /** App container name the change belongs to. */
  app: string;
  /** Short category, e.g. `exposes`, `remotes`, `shared`, `app`. */
  kind: string;
  severity: DiffSeverity;
  detail: string;
}

const SEVERITY_RANK: Record<DiffSeverity, number> = {
  breaking: 3,
  risky: 2,
  info: 1,
  compatible: 0,
};

/**
 * Diff two collections of federation configs keyed by app name. `base` is the
 * old (git) side, `head` the new (working-tree) side.
 */
export function diffFederationConfigs(
  base: Record<string, DiffableFederationConfig>,
  head: Record<string, DiffableFederationConfig>,
): FederationChange[] {
  const changes: FederationChange[] = [];
  const names = new Set([...Object.keys(base), ...Object.keys(head)]);

  for (const name of [...names].sort()) {
    const b = base[name];
    const h = head[name];

    if (b && !h) {
      changes.push({ app: name, kind: 'app', severity: 'breaking', detail: `remote "${name}" removed — hosts importing it will fail to load` });
      continue;
    }
    if (!b && h) {
      changes.push({ app: name, kind: 'app', severity: 'compatible', detail: `new remote "${name}" added` });
      continue;
    }
    if (!b || !h) continue;

    diffExposes(name, b.exposes ?? {}, h.exposes ?? {}, changes);
    diffRemotes(name, b.remotes ?? {}, h.remotes ?? {}, changes);
    diffShared(name, b.shared ?? {}, h.shared ?? {}, changes);
  }

  // Stable order: severity desc, then app, then kind.
  return changes.sort(
    (a, z) =>
      SEVERITY_RANK[z.severity] - SEVERITY_RANK[a.severity] ||
      a.app.localeCompare(z.app) ||
      a.kind.localeCompare(z.kind),
  );
}

function diffExposes(
  app: string,
  base: Record<string, string>,
  head: Record<string, string>,
  out: FederationChange[],
) {
  for (const key of Object.keys(base)) {
    if (!(key in head)) {
      out.push({ app, kind: 'exposes', severity: 'breaking', detail: `exposed module "${key}" removed` });
    } else if (base[key] !== head[key]) {
      out.push({ app, kind: 'exposes', severity: 'info', detail: `exposed module "${key}" path ${base[key]} → ${head[key]}` });
    }
  }
  for (const key of Object.keys(head)) {
    if (!(key in base)) {
      out.push({ app, kind: 'exposes', severity: 'compatible', detail: `exposed module "${key}" added` });
    }
  }
}

function diffRemotes(
  app: string,
  base: Record<string, string>,
  head: Record<string, string>,
  out: FederationChange[],
) {
  for (const key of Object.keys(base)) {
    if (!(key in head)) {
      out.push({ app, kind: 'remotes', severity: 'breaking', detail: `remote dependency "${key}" removed from host` });
    } else if (base[key] !== head[key]) {
      out.push({ app, kind: 'remotes', severity: 'info', detail: `remote "${key}" url changed` });
    }
  }
  for (const key of Object.keys(head)) {
    if (!(key in base)) {
      out.push({ app, kind: 'remotes', severity: 'compatible', detail: `remote dependency "${key}" added` });
    }
  }
}

function diffShared(
  app: string,
  base: Record<string, SharedSpec>,
  head: Record<string, SharedSpec>,
  out: FederationChange[],
) {
  for (const dep of Object.keys(base)) {
    if (!(dep in head)) {
      out.push({ app, kind: 'shared', severity: 'risky', detail: `shared dep "${dep}" removed — version dedupe with other remotes is lost` });
      continue;
    }
    const b = base[dep]!;
    const h = head[dep]!;
    if (b.singleton === true && h.singleton === false) {
      out.push({ app, kind: 'shared', severity: 'breaking', detail: `shared dep "${dep}" demoted from singleton — duplicate copies may load (React-style breakage)` });
    }
    if (b.requiredVersion !== h.requiredVersion) {
      out.push({ app, kind: 'shared', severity: 'risky', detail: `shared dep "${dep}" requiredVersion ${fmt(b.requiredVersion)} → ${fmt(h.requiredVersion)}` });
    }
    if (b.eager !== h.eager) {
      out.push({ app, kind: 'shared', severity: 'info', detail: `shared dep "${dep}" eager ${!!b.eager} → ${!!h.eager}` });
    }
  }
  for (const dep of Object.keys(head)) {
    if (!(dep in base)) {
      out.push({ app, kind: 'shared', severity: 'compatible', detail: `shared dep "${dep}" added` });
    }
  }
}

function fmt(v: string | false | undefined): string {
  if (v === false) return 'false';
  if (v === undefined) return '(unset)';
  return v;
}

// ── Rendering ────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<DiffSeverity, (s: string) => string> = {
  breaking: (s) => kleur.red().bold(s),
  risky: (s) => kleur.yellow(s),
  info: (s) => kleur.cyan(s),
  compatible: (s) => kleur.green(s),
};

export function formatDiff(changes: FederationChange[]): string {
  if (changes.length === 0) return kleur.green('No federation contract changes.');
  const lines = changes.map((c) => {
    const tag = SEVERITY_LABEL[c.severity](c.severity.toUpperCase().padEnd(10));
    return `  ${tag} ${kleur.bold(c.app)} ${kleur.gray(`[${c.kind}]`)} ${c.detail}`;
  });
  const counts = changes.reduce<Record<string, number>>((acc, c) => {
    acc[c.severity] = (acc[c.severity] ?? 0) + 1;
    return acc;
  }, {});
  const summary = (['breaking', 'risky', 'info', 'compatible'] as DiffSeverity[])
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${s}`)
    .join(', ');
  return [...lines, '', kleur.gray(`  ${summary}`)].join('\n');
}

export function hasBreaking(changes: FederationChange[]): boolean {
  return changes.some((c) => c.severity === 'breaking');
}

// ── git + filesystem plumbing ────────────────────────────────────────────────

async function gitShow(workspaceDir: string, ref: string, relPath: string): Promise<string | null> {
  // git uses forward-slash paths regardless of OS.
  const spec = `${ref}:${relPath.split(path.sep).join('/')}`;
  try {
    const { stdout } = await execFileAsync('git', ['show', spec], { cwd: workspaceDir, maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  } catch {
    return null; // file absent at base (newly added) — treated as "no base entry"
  }
}

function parseConfig(raw: string | null): DiffableFederationConfig | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as DiffableFederationConfig;
    return obj && typeof obj.name === 'string' ? obj : null;
  } catch {
    return null;
  }
}

export interface RunDiffOptions {
  dir: string;
  base: string;
  env?: string;
  allowBreaking?: boolean;
  json?: boolean;
  /** Injectable for tests — defaults to real git. */
  readBase?: (relPath: string) => Promise<string | null>;
  log?: (msg: string) => void;
}

/**
 * Collect base+head configs for every app and diff them. Returns the changes
 * and the suggested exit code (1 when breaking and not allowed).
 */
export async function runFederationDiff(
  opts: RunDiffOptions,
): Promise<{ changes: FederationChange[]; exitCode: number }> {
  const workspaceDir = path.resolve(opts.dir);
  const log = opts.log ?? ((m: string) => console.log(m));
  const fileName = opts.env ? `jorvel.federation.${opts.env}.json` : 'jorvel.federation.json';

  const { cfg } = await loadWorkspaceConfig(workspaceDir);
  const apps = await discoverApps(workspaceDir, cfg.appsDir);

  const readBase = opts.readBase ?? ((rel: string) => gitShow(workspaceDir, opts.base, rel));

  const base: Record<string, DiffableFederationConfig> = {};
  const head: Record<string, DiffableFederationConfig> = {};

  for (const app of apps) {
    const abs = path.join(app.dir, fileName);
    const rel = path.relative(workspaceDir, abs);

    const headRaw = (await fs.pathExists(abs)) ? await fs.readFile(abs, 'utf8') : null;
    const headCfg = parseConfig(headRaw);
    if (headCfg) head[headCfg.name] = headCfg;

    const baseCfg = parseConfig(await readBase(rel));
    if (baseCfg) base[baseCfg.name] = baseCfg;
  }

  const changes = diffFederationConfigs(base, head);

  if (opts.json) {
    log(JSON.stringify({ base: opts.base, changes }, null, 2));
  } else {
    log(kleur.bold(`Federation contract diff vs ${kleur.cyan(opts.base)}:`));
    log(formatDiff(changes));
  }

  const breaking = hasBreaking(changes);
  const exitCode = breaking && !opts.allowBreaking ? 1 : 0;
  if (breaking && !opts.json) {
    log(
      opts.allowBreaking
        ? kleur.yellow('\nBreaking changes present (allowed via --allow-breaking).')
        : kleur.red('\nBreaking changes detected — failing. Re-run with --allow-breaking to override.'),
    );
  }
  return { changes, exitCode };
}

/** Attach the `diff` subcommand to the parent `federation` command. */
export function attachFederationDiff(parent: Command): void {
  parent
    .command('diff')
    .description('Diff federation contracts against a git base ref; fails on breaking changes (CI gate)')
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .option('-b, --base <ref>', 'Git ref to compare against', 'main')
    .option('--env <name>', 'Diff env-suffixed files (jorvel.federation.<env>.json)')
    .option('--allow-breaking', 'Report breaking changes but exit 0 anyway', false)
    .option('--json', 'Emit machine-readable JSON', false)
    .action(async (o: { dir: string; base: string; env?: string; allowBreaking?: boolean; json?: boolean }) => {
      const { exitCode } = await runFederationDiff({
        dir: o.dir,
        base: o.base,
        ...(o.env ? { env: o.env } : {}),
        allowBreaking: !!o.allowBreaking,
        json: !!o.json,
      });
      process.exitCode = exitCode;
    });
}
