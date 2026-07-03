/**
 * `jorvel info` — print a shareable diagnostic bundle (like `next info`).
 * Paste it into a bug report; no secrets are included.
 */

import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import kleur from 'kleur';
import { loadWorkspaceConfig } from '../config.js';
import { discoverApps } from '../discovery.js';

const execFileAsync = promisify(execFile);

async function tryVersion(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 4000 });
    return stdout.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}

async function readPkgVersion(dir: string): Promise<string | null> {
  try {
    const pkg = await fs.readJson(path.join(dir, 'package.json'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

export interface InfoReport {
  os: string;
  node: string;
  packageManagers: Record<string, string | null>;
  jorvelCli: string | null;
  workspace: string | null;
  apps: Array<{ name: string; type: string; port: number }>;
  jorvelDeps: Record<string, string>;
}

/** Collect the report object (separate from rendering, for tests). */
export async function collectInfo(workspaceDir: string): Promise<InfoReport> {
  const [pnpmV, npmV, yarnV, bunV] = await Promise.all([
    tryVersion('pnpm', ['--version']),
    tryVersion('npm', ['--version']),
    tryVersion('yarn', ['--version']),
    tryVersion('bun', ['--version']),
  ]);

  const cliVersion = await readPkgVersion(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));

  let workspaceName: string | null = null;
  const apps: InfoReport['apps'] = [];
  const jorvelDeps: Record<string, string> = {};
  try {
    const { cfg } = await loadWorkspaceConfig(workspaceDir);
    workspaceName = cfg.name ?? null;
    const discovered = await discoverApps(workspaceDir, cfg.appsDir);
    for (const a of discovered) apps.push({ name: a.meta.name, type: a.meta.type, port: a.meta.port });
    // Collect @jorvel/* versions from the root package.json.
    const rootPkg = await fs.readJson(path.join(workspaceDir, 'package.json')).catch(() => ({}));
    for (const bag of [rootPkg.dependencies, rootPkg.devDependencies]) {
      if (!bag) continue;
      for (const [k, v] of Object.entries(bag)) {
        if (k === 'jorvel' || k.startsWith('@jorvel/')) jorvelDeps[k] = String(v);
      }
    }
  } catch {
    // not in a workspace — fine
  }

  return {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    node: process.version,
    packageManagers: { pnpm: pnpmV, npm: npmV, yarn: yarnV, bun: bunV },
    jorvelCli: cliVersion,
    workspace: workspaceName,
    apps,
    jorvelDeps,
  };
}

export function formatInfo(r: InfoReport): string {
  const lines: string[] = [];
  lines.push('JORVEL environment info');
  lines.push('');
  lines.push(`  OS:        ${r.os}`);
  lines.push(`  Node:      ${r.node}`);
  lines.push(`  jorvel:    ${r.jorvelCli ?? 'unknown'}`);
  const pms = Object.entries(r.packageManagers)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}@${v}`)
    .join(', ');
  lines.push(`  Pkg mgrs:  ${pms || 'none detected'}`);
  lines.push(`  Workspace: ${r.workspace ?? '(not in a JORVEL workspace)'}`);
  if (r.apps.length) {
    lines.push('  Apps:');
    for (const a of r.apps) lines.push(`    - ${a.name} (${a.type}) :${a.port}`);
  }
  const deps = Object.entries(r.jorvelDeps);
  if (deps.length) {
    lines.push('  @jorvel deps:');
    for (const [k, v] of deps) lines.push(`    - ${k} ${v}`);
  }
  return lines.join('\n');
}

export const infoCommand = new Command('info')
  .description('Print a shareable environment diagnostic bundle (paste into bug reports)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--json', 'Emit JSON', false)
  .action(async (opts: { dir: string; json?: boolean }) => {
    const report = await collectInfo(path.resolve(opts.dir));
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(kleur.bold(formatInfo(report)));
    }
  });
