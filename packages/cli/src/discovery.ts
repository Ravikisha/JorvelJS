import path from 'node:path';
import fs from 'fs-extra';

export interface AppMeta {
  name: string;
  type: 'host' | 'remote';
  port: number;
  exposes?: Record<string, string>;
}

export interface DiscoveredApp {
  /** Absolute path to the app directory (e.g. `…/apps/shell`). */
  dir: string;
  /** Folder basename. Note: may differ from `meta.name`. */
  folder: string;
  /** Parsed `jorvel.app.json`. */
  meta: AppMeta;
}

const NOISE = new Set(['node_modules', 'dist', 'build', '.cache', '.next', 'coverage']);

/**
 * Walk `<workspaceDir>/apps/*`, return every directory that contains a
 * `jorvel.app.json`. Skips dotfiles, symlinks, and well-known noise directories.
 *
 * Replaces the duplicated discovery loops in `dev.ts`, `build.ts`,
 * `federation.ts`, `routes.ts`, `ci.ts`, `typecheck.ts`.
 */
export async function discoverApps(
  workspaceDir: string,
  /** Apps directory relative to the workspace root. Defaults to `apps`; pass `cfg.appsDir` to honor a custom layout. */
  appsSubdir = 'apps',
): Promise<DiscoveredApp[]> {
  const appsDir = path.join(workspaceDir, appsSubdir);
  if (!(await fs.pathExists(appsDir))) return [];

  const entries = await fs.readdir(appsDir);
  const out: DiscoveredApp[] = [];

  for (const folder of entries) {
    if (folder.startsWith('.') || NOISE.has(folder)) continue;
    const dir = path.join(appsDir, folder);
    let stat;
    try {
      stat = await fs.lstat(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;

    const metaPath = path.join(dir, 'jorvel.app.json');
    if (!(await fs.pathExists(metaPath))) continue;

    let meta: AppMeta;
    try {
      meta = (await fs.readJson(metaPath)) as AppMeta;
    } catch {
      continue;
    }

    out.push({ dir, folder, meta });
  }

  return out;
}

/** Find the host app, if any. Throws if multiple hosts are present. */
export async function findHostApp(workspaceDir: string, appsSubdir = 'apps'): Promise<DiscoveredApp | null> {
  const apps = await discoverApps(workspaceDir, appsSubdir);
  const hosts = apps.filter((a) => a.meta.type === 'host');
  if (hosts.length === 0) return null;
  if (hosts.length > 1) {
    throw new Error(
      `Multiple host apps found (${hosts.map((h) => h.meta.name).join(', ')}). JORVEL supports a single host per workspace.`,
    );
  }
  return hosts[0]!;
}

export async function findRemoteApps(workspaceDir: string, appsSubdir = 'apps'): Promise<DiscoveredApp[]> {
  const apps = await discoverApps(workspaceDir, appsSubdir);
  return apps.filter((a) => a.meta.type === 'remote');
}
