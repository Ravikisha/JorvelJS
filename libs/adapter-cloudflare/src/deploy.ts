/**
 * Deploy scaffold for `jorvel deploy --target cloudflare`.
 *
 * Kept in a SEPARATE module from the runtime worker (`./index`) on purpose: it
 * imports Node builtins (`node:fs`, `node:path`, `node:url`) which must never be
 * pulled into the Worker bundle. The CLI imports this via the
 * `@jorvel/adapter-cloudflare/deploy` subpath; the Worker runtime only ever
 * imports `@jorvel/adapter-cloudflare`.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface ScaffoldDeployOptions {
  cwd: string;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface ScaffoldDeployResult {
  files: { dest: string; written: boolean }[];
  nextHint: string;
}

export const deployTarget = 'cloudflare';

export async function scaffoldDeploy(opts: ScaffoldDeployOptions): Promise<ScaffoldDeployResult> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.resolve(here, '..', 'templates');
  const log = opts.log ?? (() => {});
  const result: ScaffoldDeployResult = {
    files: [],
    nextHint: '`wrangler deploy` (or `wrangler pages deploy apps/shell/dist`)',
  };
  const entries = ['wrangler.toml'];
  for (const name of entries) {
    const src = path.join(templatesDir, name);
    const dest = path.join(opts.cwd, name);
    let written = false;
    try {
      await fs.access(dest);
      log(`  skip  ${name} (exists)`);
    } catch {
      log(`  write ${name}`);
      if (!opts.dryRun) {
        const content = await fs.readFile(src, 'utf8');
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, content, 'utf8');
      }
      written = true;
    }
    result.files.push({ dest, written });
  }
  return result;
}
