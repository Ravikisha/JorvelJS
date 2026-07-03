import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { execa } from 'execa';
import { loadWorkspaceConfig } from '../config.js';
import { validateWorkspaceConfig } from '../config-schema.js';

interface Check {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export const diagnoseCommand = new Command('diagnose')
  .description('Validate workspace health — Node, pnpm, configs, ports, deps.')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .action(async (opts: { cwd: string }) => {
    const cwd = path.resolve(opts.cwd);
    const checks: Check[] = [];

    checks.push(await checkNodeVersion());
    checks.push(await checkPnpm());
    checks.push(await checkWorkspaceRoot(cwd));
    checks.push(await checkWorkspaceConfig(cwd));
    checks.push(await checkConfigSchema(cwd));
    checks.push(await checkApps(cwd));
    checks.push(await checkHosts(cwd));
    checks.push(await checkPorts(cwd));
    checks.push(await checkEnvExample(cwd));
    checks.push(await checkRspackPeer(cwd));
    checks.push(await checkContractDrift(cwd));
    checks.push(await checkLockfile(cwd));
    checks.push(await checkTypeScript(cwd));

    printReport(checks);

    const fails = checks.filter((c) => c.status === 'fail').length;
    process.exit(fails > 0 ? 1 : 0);
  });

/** `.env` must define every key present in `.env.example`. */
async function checkEnvExample(cwd: string): Promise<Check> {
  const examplePath = path.join(cwd, '.env.example');
  if (!(await fs.pathExists(examplePath))) {
    return { name: '.env', status: 'warn', detail: 'no .env.example to validate against' };
  }
  const keysOf = (s: string) =>
    s.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0]!.trim()).filter(Boolean);
  const wanted = keysOf(await fs.readFile(examplePath, 'utf8'));
  const envPath = path.join(cwd, '.env');
  if (!(await fs.pathExists(envPath))) {
    return { name: '.env', status: 'warn', detail: `.env missing (copy .env.example; needs ${wanted.length} keys)` };
  }
  const have = new Set(keysOf(await fs.readFile(envPath, 'utf8')));
  const missing = wanted.filter((k) => !have.has(k));
  if (missing.length) return { name: '.env', status: 'fail', detail: `missing keys: ${missing.join(', ')}` };
  return { name: '.env', status: 'ok', detail: `${wanted.length} keys present` };
}

/** Each app should have @rspack/core available (peer for the dev/build pipeline). */
async function checkRspackPeer(cwd: string): Promise<Check> {
  const rootHas = await fs.pathExists(path.join(cwd, 'node_modules', '@rspack', 'core'));
  if (rootHas) return { name: 'rspack peer', status: 'ok', detail: '@rspack/core resolved' };
  // Not at root — check whether any app declares it (deps may not be installed yet).
  const metas = await readAppMetas(cwd);
  const appsDir = path.join(cwd, 'apps');
  for (const m of metas) {
    const pkgPath = path.join(appsDir, m.name, 'package.json');
    if (!(await fs.pathExists(pkgPath))) continue;
    const pkg = await fs.readJson(pkgPath).catch(() => ({}));
    if (pkg.devDependencies?.['@rspack/core'] || pkg.dependencies?.['@rspack/core']) {
      return { name: 'rspack peer', status: 'warn', detail: '@rspack/core declared but not installed — run install' };
    }
  }
  return { name: 'rspack peer', status: 'warn', detail: '@rspack/core not found (install deps)' };
}

/** Warn when jorvel.federation.json is missing or older than the app config that drives it. */
async function checkContractDrift(cwd: string): Promise<Check> {
  const metas = await readAppMetas(cwd);
  const appsDir = path.join(cwd, 'apps');
  const stale: string[] = [];
  const missing: string[] = [];
  for (const m of metas) {
    const appJson = path.join(appsDir, m.name, 'jorvel.app.json');
    const fed = path.join(appsDir, m.name, 'jorvel.federation.json');
    if (!(await fs.pathExists(fed))) { missing.push(m.name); continue; }
    try {
      const [a, f] = await Promise.all([fs.stat(appJson), fs.stat(fed)]);
      if (a.mtimeMs > f.mtimeMs) stale.push(m.name);
    } catch { /* ignore */ }
  }
  if (missing.length) return { name: 'contract drift', status: 'warn', detail: `no federation config: ${missing.join(', ')} — run \`jorvel federation\`` };
  if (stale.length) return { name: 'contract drift', status: 'warn', detail: `stale (app config newer): ${stale.join(', ')} — re-run \`jorvel federation\`` };
  return { name: 'contract drift', status: 'ok', detail: 'federation configs current' };
}

async function checkNodeVersion(): Promise<Check> {
  const v = process.versions.node;
  const major = Number(v.split('.')[0]);
  if (major >= 20) return { name: 'node version', status: 'ok', detail: v };
  return { name: 'node version', status: 'fail', detail: `${v} (>= 20 required)` };
}

async function checkPnpm(): Promise<Check> {
  try {
    const { stdout } = await execa('pnpm', ['--version'], { reject: false });
    if (!stdout) return { name: 'pnpm', status: 'fail', detail: 'not installed' };
    return { name: 'pnpm', status: 'ok', detail: stdout.trim() };
  } catch {
    return { name: 'pnpm', status: 'fail', detail: 'not installed — `npm i -g pnpm`' };
  }
}

async function checkWorkspaceRoot(cwd: string): Promise<Check> {
  const hasPkg = await fs.pathExists(path.join(cwd, 'package.json'));
  const hasWs = await fs.pathExists(path.join(cwd, 'pnpm-workspace.yaml'));
  if (!hasPkg) return { name: 'workspace root', status: 'fail', detail: 'package.json missing' };
  if (!hasWs) return { name: 'workspace root', status: 'warn', detail: 'pnpm-workspace.yaml missing' };
  return { name: 'workspace root', status: 'ok', detail: cwd };
}

async function checkWorkspaceConfig(cwd: string): Promise<Check> {
  try {
    const { cfg } = await loadWorkspaceConfig(cwd);
    if (!cfg) return { name: 'jorvel.config', status: 'warn', detail: 'not found' };
    return { name: 'jorvel.config', status: 'ok', detail: `name=${cfg.name ?? 'anonymous'}` };
  } catch (e) {
    return { name: 'jorvel.config', status: 'fail', detail: e instanceof Error ? e.message : String(e) };
  }
}

async function checkApps(cwd: string): Promise<Check> {
  const appsDir = path.join(cwd, 'apps');
  if (!(await fs.pathExists(appsDir))) {
    return { name: 'apps/', status: 'warn', detail: 'no apps directory — run `jorvel generate`' };
  }
  const dirs = await fs.readdir(appsDir);
  const valid: string[] = [];
  for (const d of dirs) {
    if (await fs.pathExists(path.join(appsDir, d, 'jorvel.app.json'))) valid.push(d);
  }
  if (valid.length === 0) return { name: 'apps/', status: 'warn', detail: '0 apps with jorvel.app.json' };
  return { name: 'apps/', status: 'ok', detail: `${valid.length} app(s): ${valid.join(', ')}` };
}

type AppMetaLite = { name: string; type?: string; port?: number };

async function readAppMetas(cwd: string): Promise<AppMetaLite[]> {
  const appsDir = path.join(cwd, 'apps');
  if (!(await fs.pathExists(appsDir))) return [];
  const dirs = await fs.readdir(appsDir);
  const metas: AppMetaLite[] = [];
  for (const d of dirs) {
    const mp = path.join(appsDir, d, 'jorvel.app.json');
    if (!(await fs.pathExists(mp))) continue;
    try {
      const m = (await fs.readJson(mp)) as AppMetaLite;
      metas.push({ ...m, name: m.name ?? d });
    } catch {
      /* skip unreadable */
    }
  }
  return metas;
}

async function checkConfigSchema(cwd: string): Promise<Check> {
  const jsonPath = path.join(cwd, 'jorvel.config.json');
  if (!(await fs.pathExists(jsonPath))) {
    return { name: 'config schema', status: 'ok', detail: 'no jorvel.config.json to validate' };
  }
  let parsed: unknown;
  try {
    parsed = await fs.readJson(jsonPath);
  } catch (e) {
    return { name: 'config schema', status: 'fail', detail: `invalid JSON: ${(e as Error).message}` };
  }
  const { valid, errors } = await validateWorkspaceConfig(parsed);
  if (valid) return { name: 'config schema', status: 'ok', detail: 'matches @jorvel/types schema' };
  return { name: 'config schema', status: 'fail', detail: errors.slice(0, 3).join('; ') };
}

async function checkHosts(cwd: string): Promise<Check> {
  const hosts = (await readAppMetas(cwd)).filter((m) => m.type === 'host').map((m) => m.name);
  if (hosts.length > 1) {
    return { name: 'host app', status: 'fail', detail: `multiple hosts: ${hosts.join(', ')}` };
  }
  if (hosts.length === 0) {
    return { name: 'host app', status: 'warn', detail: 'no host app (type=host)' };
  }
  return { name: 'host app', status: 'ok', detail: hosts[0]! };
}

async function checkPorts(cwd: string): Promise<Check> {
  const metas = await readAppMetas(cwd);
  const byPort = new Map<number, string[]>();
  for (const m of metas) {
    if (typeof m.port !== 'number') continue;
    const arr = byPort.get(m.port) ?? [];
    arr.push(m.name);
    byPort.set(m.port, arr);
  }
  const dups = [...byPort.entries()].filter(([, names]) => names.length > 1);
  if (dups.length > 0) {
    return {
      name: 'ports',
      status: 'fail',
      detail: dups.map(([p, names]) => `${p} → ${names.join(' & ')}`).join('; '),
    };
  }
  return { name: 'ports', status: 'ok', detail: metas.length ? 'no port conflicts' : 'no apps' };
}

async function checkLockfile(cwd: string): Promise<Check> {
  const lock = path.join(cwd, 'pnpm-lock.yaml');
  if (!(await fs.pathExists(lock))) return { name: 'lockfile', status: 'warn', detail: 'missing — run `pnpm install`' };
  return { name: 'lockfile', status: 'ok', detail: 'pnpm-lock.yaml present' };
}

async function checkTypeScript(cwd: string): Promise<Check> {
  const tsconfig = path.join(cwd, 'tsconfig.base.json');
  if (!(await fs.pathExists(tsconfig))) return { name: 'tsconfig', status: 'warn', detail: 'tsconfig.base.json missing' };
  return { name: 'tsconfig', status: 'ok', detail: 'tsconfig.base.json present' };
}

function printReport(checks: Check[]): void {
  console.log(kleur.bold('\nJORVEL diagnose\n'));
  for (const c of checks) {
    const badge =
      c.status === 'ok' ? kleur.green('OK ') : c.status === 'warn' ? kleur.yellow('WRN') : kleur.red('ERR');
    console.log(`  ${badge}  ${c.name.padEnd(22)} ${kleur.dim(c.detail)}`);
  }
  console.log();
}
