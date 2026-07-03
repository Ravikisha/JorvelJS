/**
 * `jorvel canary` — manage weighted/canary rollouts for a federated remote.
 *
 * Writes a `jorvel.federation.canary.json` next to the host's federation config:
 *
 *   { "remotes": { "dashboard": [ { "entryUrl": "…v2…", "weight": 10 },
 *                                 { "entryUrl": "…v1…", "weight": 90 } ] } }
 *
 * The runtime picks a version per user with `resolveWeightedRemotes` /
 * `pickWeightedRemote` (sticky by key). Dial the weight up, then `--promote` to
 * cut over, or `--rollback` to remove the canary entirely.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { findHostApp } from '../discovery.js';
import { JorvelCliError } from '../errors.js';

export interface WeightedEntry {
  entryUrl: string;
  weight: number;
}

export interface CanaryConfig {
  remotes: Record<string, WeightedEntry[]>;
}

export interface SetCanaryOptions {
  remote: string;
  canaryUrl: string;
  weight: number;
  stableUrl?: string;
}

/** Pure: produce the next canary config for a set/update. */
export function setCanary(current: CanaryConfig, opts: SetCanaryOptions): CanaryConfig {
  if (opts.weight < 0 || opts.weight > 100) {
    throw new JorvelCliError(`Weight must be 0–100 (got ${opts.weight}).`, { code: 'CANARY-001' });
  }
  const existing = current.remotes[opts.remote] ?? [];
  const stableUrl =
    opts.stableUrl ?? existing.find((e) => e.entryUrl !== opts.canaryUrl)?.entryUrl;
  const entries: WeightedEntry[] = [{ entryUrl: opts.canaryUrl, weight: opts.weight }];
  if (stableUrl && stableUrl !== opts.canaryUrl) {
    entries.push({ entryUrl: stableUrl, weight: 100 - opts.weight });
  }
  return { ...current, remotes: { ...current.remotes, [opts.remote]: entries } };
}

/** Pure: promote the canary to 100% (drop the stable entry). */
export function promoteCanary(current: CanaryConfig, remote: string): CanaryConfig {
  const entries = current.remotes[remote];
  if (!entries?.length) throw new JorvelCliError(`No canary for "${remote}".`, { code: 'CANARY-002' });
  const top = [...entries].sort((a, b) => b.weight - a.weight)[0]!;
  return { ...current, remotes: { ...current.remotes, [remote]: [{ entryUrl: top.entryUrl, weight: 100 }] } };
}

/** Pure: remove a remote's canary config (rollback to the host's default remote). */
export function rollbackCanary(current: CanaryConfig, remote: string): CanaryConfig {
  const next = { ...current.remotes };
  delete next[remote];
  return { ...current, remotes: next };
}

async function readConfig(file: string): Promise<CanaryConfig> {
  if (await fs.pathExists(file)) {
    const raw = await fs.readJson(file).catch(() => ({}));
    return { remotes: raw.remotes ?? {} };
  }
  return { remotes: {} };
}

export const canaryCommand = new Command('canary')
  .description('Weighted/canary rollout for a federated remote (writes jorvel.federation.canary.json)')
  .argument('<remote>', 'Remote name to canary')
  .option('-d, --dir <path>', 'Workspace root', process.cwd())
  .option('--url <entryUrl>', 'Canary remoteEntry.js URL')
  .option('--weight <n>', 'Canary traffic percentage (0–100)', '10')
  .option('--stable <entryUrl>', 'Stable remoteEntry.js URL (inferred if omitted)')
  .option('--promote', 'Cut the canary to 100% and drop the stable entry')
  .option('--rollback', 'Remove the canary for this remote')
  .option('--status', 'Print the current canary config and exit')
  .action(async (remote: string, opts: {
    dir: string; url?: string; weight: string; stable?: string;
    promote?: boolean; rollback?: boolean; status?: boolean;
  }) => {
    const workspaceDir = path.resolve(opts.dir);
    const host = await findHostApp(workspaceDir);
    if (!host) {
      throw new JorvelCliError('No host app found.', { code: 'CANARY-003', hint: 'Run inside a workspace with a host app.' });
    }
    const file = path.join(host.dir, 'jorvel.federation.canary.json');
    const current = await readConfig(file);

    if (opts.status) {
      const entries = current.remotes[remote];
      console.log(entries?.length
        ? entries.map((e) => `  ${e.weight}%  ${e.entryUrl}`).join('\n')
        : kleur.gray(`No canary for "${remote}".`));
      return;
    }

    let next: CanaryConfig;
    if (opts.rollback) {
      next = rollbackCanary(current, remote);
      console.log(kleur.yellow(`Rolled back canary for "${remote}".`));
    } else if (opts.promote) {
      next = promoteCanary(current, remote);
      console.log(kleur.green(`Promoted "${remote}" canary to 100%.`));
    } else {
      if (!opts.url) throw new JorvelCliError('--url <entryUrl> is required to set a canary.', { code: 'CANARY-004' });
      next = setCanary(current, { remote, canaryUrl: opts.url, weight: Number(opts.weight), ...(opts.stable ? { stableUrl: opts.stable } : {}) });
      console.log(kleur.green(`Set "${remote}" canary → ${opts.weight}% ${opts.url}`));
    }

    await fs.outputFile(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
    console.log(kleur.gray(`wrote ${path.relative(workspaceDir, file)}`));
  });
