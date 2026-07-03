/**
 * `jorvel federation impact [remote]` — remote impact analysis.
 *
 * Scans every app's `jorvel.federation.json` and reports which HOSTS consume
 * each remote (via their `remotes` map). Answers "if I change/retire remote X,
 * who breaks?" — the complement of `federation diff`.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { loadWorkspaceConfig } from '../config.js';
import { discoverApps } from '../discovery.js';

export interface ImpactEntry {
  /** Remote container name. */
  remote: string;
  /** Host app names that import this remote. */
  consumers: string[];
}

interface HostFed {
  host: string;
  /** import-specifier key → resolved global@url */
  remotes: Record<string, string>;
}

/** Pure: given host federation configs, map each referenced remote → its consumers. */
export function analyzeImpact(hosts: HostFed[]): ImpactEntry[] {
  const map = new Map<string, Set<string>>();
  for (const h of hosts) {
    for (const remoteKey of Object.keys(h.remotes ?? {})) {
      let set = map.get(remoteKey);
      if (!set) map.set(remoteKey, (set = new Set()));
      set.add(h.host);
    }
  }
  return [...map.entries()]
    .map(([remote, consumers]) => ({ remote, consumers: [...consumers].sort() }))
    .sort((a, b) => a.remote.localeCompare(b.remote));
}

export interface RunImpactOptions {
  dir: string;
  remote?: string;
  env?: string;
  json?: boolean;
  log?: (msg: string) => void;
}

export async function runImpact(opts: RunImpactOptions): Promise<ImpactEntry[]> {
  const workspaceDir = path.resolve(opts.dir);
  const log = opts.log ?? ((m: string) => console.log(m));
  const fileName = opts.env ? `jorvel.federation.${opts.env}.json` : 'jorvel.federation.json';

  const { cfg } = await loadWorkspaceConfig(workspaceDir);
  const apps = await discoverApps(workspaceDir, cfg.appsDir);

  const hosts: HostFed[] = [];
  for (const app of apps) {
    const fed = path.join(app.dir, fileName);
    if (!(await fs.pathExists(fed))) continue;
    const raw = await fs.readJson(fed).catch(() => null);
    if (raw?.remotes && typeof raw.remotes === 'object') {
      hosts.push({ host: app.meta.name, remotes: raw.remotes });
    }
  }

  let impact = analyzeImpact(hosts);
  if (opts.remote) impact = impact.filter((e) => e.remote === opts.remote);

  if (opts.json) {
    log(JSON.stringify(impact, null, 2));
    return impact;
  }

  if (impact.length === 0) {
    log(kleur.gray(opts.remote ? `No host consumes "${opts.remote}".` : 'No remotes are consumed by any host.'));
    return impact;
  }
  log(kleur.bold('Remote impact:'));
  for (const e of impact) {
    log(`  ${kleur.cyan(e.remote)} ← ${e.consumers.length} host(s): ${e.consumers.join(', ')}`);
  }
  return impact;
}

/** Attach `impact` under the parent `federation` command. */
export function attachFederationImpact(parent: Command): void {
  parent
    .command('impact')
    .description('Which hosts consume a remote (impact analysis before changing/retiring it)')
    .argument('[remote]', 'Limit to one remote (default: all)')
    .option('-d, --dir <path>', 'Workspace root', process.cwd())
    .option('--env <name>', 'Analyze env-suffixed federation files')
    .option('--json', 'Emit JSON', false)
    .action(async (remote: string | undefined, o: { dir: string; env?: string; json?: boolean }) => {
      await runImpact({
        dir: o.dir,
        ...(remote ? { remote } : {}),
        ...(o.env ? { env: o.env } : {}),
        json: !!o.json,
      });
    });
}
