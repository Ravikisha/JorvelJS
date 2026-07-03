/**
 * `jorvel build --stats` — JSON summary of the workspace post-build.
 *
 * Combines per-app metadata + asset sizes + federation share scope into a
 * single document. The host-wide section flags shared-dep version conflicts
 * across remotes so deploy pipelines can fail fast.
 */

import path from 'node:path';
import fs from 'fs-extra';

export interface AppStats {
  name: string;
  type: 'host' | 'remote';
  port?: number;
  /** Total dist size in bytes (JS + CSS + map). */
  bytes: number;
  /** Per-asset list, sorted by size desc. */
  assets: Array<{ file: string; bytes: number }>;
  /** `remoteEntry.js` size if present (only for remotes). */
  remoteEntryBytes?: number;
  /** Shared deps + versions parsed from `jorvel.federation.json`. */
  shared: Record<string, string>;
}

export interface BuildStats {
  workspace: string;
  generatedAt: string;
  apps: AppStats[];
  /** Each pair of remotes that requested a different version of the same dep. */
  conflicts: Array<{
    dep: string;
    versions: Array<{ app: string; version: string }>;
  }>;
}

interface AppMeta {
  name: string;
  type: 'host' | 'remote';
  port?: number;
}

interface SharedConfigEntry {
  requiredVersion?: string;
  version?: string;
  singleton?: boolean;
}

function parseShared(json: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!json || typeof json !== 'object') return out;
  const shared = (json as { shared?: unknown }).shared;
  if (!shared || typeof shared !== 'object') return out;
  for (const [dep, value] of Object.entries(shared as Record<string, unknown>)) {
    if (typeof value === 'string') {
      out[dep] = value;
    } else if (value && typeof value === 'object') {
      const entry = value as SharedConfigEntry;
      out[dep] = entry.requiredVersion ?? entry.version ?? '*';
    }
  }
  return out;
}

async function walkAssets(distDir: string): Promise<Array<{ file: string; bytes: number }>> {
  const out: Array<{ file: string; bytes: number }> = [];
  if (!(await fs.pathExists(distDir))) return out;
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(p);
      } else if (entry.isFile() && /\.(js|css|map)$/.test(entry.name)) {
        const stat = await fs.stat(p);
        out.push({
          file: path.relative(distDir, p).replace(/\\/g, '/'),
          bytes: stat.size,
        });
      }
    }
  };
  await walk(distDir);
  out.sort((a, b) => b.bytes - a.bytes);
  return out;
}

export async function collectBuildStats(workspaceDir: string): Promise<BuildStats> {
  const appsDir = path.join(workspaceDir, 'apps');
  const apps: AppStats[] = [];
  if (await fs.pathExists(appsDir)) {
    const folders = await fs.readdir(appsDir);
    for (const folder of folders) {
      const appDir = path.join(appsDir, folder);
      const metaPath = path.join(appDir, 'jorvel.app.json');
      if (!(await fs.pathExists(metaPath))) continue;
      const meta = (await fs.readJson(metaPath)) as AppMeta;
      const fedPath = path.join(appDir, 'jorvel.federation.json');
      const fed = (await fs.pathExists(fedPath)) ? await fs.readJson(fedPath) : {};
      const shared = parseShared(fed);
      const distDir = path.join(appDir, 'dist');
      const assets = await walkAssets(distDir);
      const bytes = assets.reduce((acc, a) => acc + a.bytes, 0);
      const remoteEntry = assets.find((a) => /(^|\/)remoteEntry\.js$/.test(a.file));
      const stats: AppStats = {
        name: meta.name ?? folder,
        type: meta.type,
        ...(meta.port !== undefined ? { port: meta.port } : {}),
        bytes,
        assets,
        shared,
      };
      if (remoteEntry) stats.remoteEntryBytes = remoteEntry.bytes;
      apps.push(stats);
    }
  }

  const conflicts = detectConflicts(apps);

  return {
    workspace: workspaceDir,
    generatedAt: new Date().toISOString(),
    apps,
    conflicts,
  };
}

export function detectConflicts(apps: AppStats[]): BuildStats['conflicts'] {
  const byDep = new Map<string, Map<string, string[]>>();
  for (const app of apps) {
    for (const [dep, version] of Object.entries(app.shared)) {
      if (!byDep.has(dep)) byDep.set(dep, new Map());
      const versions = byDep.get(dep)!;
      const list = versions.get(version) ?? [];
      list.push(app.name);
      versions.set(version, list);
    }
  }
  const conflicts: BuildStats['conflicts'] = [];
  for (const [dep, versions] of byDep) {
    if (versions.size <= 1) continue;
    const detail: Array<{ app: string; version: string }> = [];
    for (const [version, appList] of versions) {
      for (const app of appList) detail.push({ app, version });
    }
    detail.sort((a, b) => a.app.localeCompare(b.app));
    conflicts.push({ dep, versions: detail });
  }
  return conflicts;
}

// ── First-load JS / size budgets ──────────────────────────────────────────────

export interface SizeBudgets {
  /** Max total dist bytes for any app. */
  perApp?: number;
  /** Max `remoteEntry.js` bytes for any remote. */
  remoteEntry?: number;
  /** Per-app override, keyed by app name (bytes). */
  apps?: Record<string, number>;
}

export interface BudgetViolation {
  app: string;
  kind: 'app' | 'remoteEntry';
  bytes: number;
  budget: number;
}

/**
 * Compare build stats against size budgets. Returns violations (empty = within
 * budget). Wire into CI: fail the job when the result is non-empty.
 */
export function checkBudgets(stats: BuildStats, budgets: SizeBudgets): BudgetViolation[] {
  const out: BudgetViolation[] = [];
  for (const app of stats.apps) {
    const appBudget = budgets.apps?.[app.name] ?? budgets.perApp;
    if (appBudget !== undefined && app.bytes > appBudget) {
      out.push({ app: app.name, kind: 'app', bytes: app.bytes, budget: appBudget });
    }
    if (
      budgets.remoteEntry !== undefined &&
      app.remoteEntryBytes !== undefined &&
      app.remoteEntryBytes > budgets.remoteEntry
    ) {
      out.push({ app: app.name, kind: 'remoteEntry', bytes: app.remoteEntryBytes, budget: budgets.remoteEntry });
    }
  }
  return out;
}

export async function writeBuildStats(workspaceDir: string, outPath: string): Promise<BuildStats> {
  const stats = await collectBuildStats(workspaceDir);
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, JSON.stringify(stats, null, 2) + '\n', 'utf8');
  return stats;
}
