import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { loadWorkspaceConfig } from '../config.js';
import { discoverApps } from '../discovery.js';
import { attachFederationDiff } from './federation-diff.js';
import { attachFederationImpact } from './federation-impact.js';

type AppFramework = 'react' | 'vue' | 'solid' | 'svelte' | 'angular';

type AppMeta = {
  name: string;
  type: 'host' | 'remote';
  port: number;
  framework?: AppFramework;
  exposes?: Record<string, string>;
  shared?: Array<string>;
};

/** Framework-runtime packages shared as singletons among same-framework apps. */
const FRAMEWORK_SHARED: Record<AppFramework, string[]> = {
  react: ['react', 'react-dom'],
  vue: ['vue'],
  solid: ['solid-js'],
  svelte: ['svelte'],
  angular: ['@angular/core', '@angular/common', '@angular/platform-browser', 'rxjs'],
};

type FederationConfig = {
  name: string;
  filename: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared: Record<string, { singleton: boolean; eager?: boolean; requiredVersion?: string | false }>;
};

/**
 * Default shared-dep config for an app.
 *
 * Module Federation requires `eager: true` on the HOST so the shared scope is
 * populated before any remote loads. On a REMOTE, eager-loading every shared
 * dep defeats the async-boundary that JORVEL relies on for share-scope
 * initialization (and inflates the initial chunk). Default per role:
 *
 *   host   → eager: true   (share-scope owner)
 *   remote → eager: false  (lazy-resolves via host scope)
 */
function defaultShared(
  role: 'host' | 'remote',
  framework: AppFramework = 'react',
): FederationConfig['shared'] {
  const eager = role === 'host';
  const shared: FederationConfig['shared'] = {
    // The event bus is the framework-neutral cross-app channel — always a
    // singleton so every app talks to the same instance.
    '@jorvel/event-bus': { singleton: true, eager, requiredVersion: false },
  };
  // The React runtime (router/RemoteOutlet) is shared only where React runs:
  // the host and React remotes. Non-React remotes never import it.
  if (framework === 'react') {
    shared['@jorvel/runtime'] = { singleton: true, eager, requiredVersion: false };
  }
  // Share this app's own framework runtime as a singleton (dedupes across
  // same-framework apps; a lone remote just consumes its own copy).
  for (const pkg of FRAMEWORK_SHARED[framework]) {
    shared[pkg] = { singleton: true, eager, requiredVersion: false };
  }
  return shared;
}

function mergeShared(...shared: Array<FederationConfig['shared']>) {
  return Object.assign({}, ...shared);
}

export function toFederationName(s: string) {
  // MF container names must be valid JS identifiers in many setups.
  // Keep it simple and consistent.
  return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

async function detectAppName(appDir: string, meta: AppMeta): Promise<string> {
  if (meta.name?.trim()) return meta.name;

  const pkgPath = path.join(appDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    if (typeof pkg.name === 'string' && pkg.name.trim()) {
      return pkg.name.split('/').pop() as string;
    }
  }

  return path.basename(appDir);
}

async function detectExposes(appDir: string, meta: AppMeta): Promise<Record<string, string> | undefined> {
  if (meta.type !== 'remote') return undefined;

  // If exposes are explicitly set in jorvel.app.json, respect them.
  if (meta.exposes && Object.keys(meta.exposes).length > 0) {
    return { ...meta.exposes };
  }

  // Default convention: a generated remote has src/remote.{tsx,jsx,ts,js}.
  // Probe in extension priority order — TS apps land on `.tsx`, JS apps on `.jsx`.
  const entryCandidates = ['remote.tsx', 'remote.jsx', 'remote.ts', 'remote.js'];
  for (const file of entryCandidates) {
    const full = path.join(appDir, 'src', file);
    if (await fs.pathExists(full)) {
      return { './App': `./src/${file}` };
    }
  }

  // Fallback: src/App.{tsx,jsx,ts,js}.
  const appCandidates = ['App.tsx', 'App.jsx', 'App.ts', 'App.js'];
  for (const file of appCandidates) {
    const full = path.join(appDir, 'src', file);
    if (await fs.pathExists(full)) {
      return { './App': `./src/${file}` };
    }
  }

  return undefined;
}

async function detectSharedFromPackageJson(appDir: string) {
  const pkgPath = path.join(appDir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return {};

  const pkg = (await fs.readJson(pkgPath)) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };

  // Safe defaults: only include deps that are likely to be shared singletons.
  const candidates = ['react', 'react-dom', 'react-router-dom', '@jorvel/event-bus', '@jorvel/runtime', '@jorvel/state', '@jorvel/ui'];
  const shared: FederationConfig['shared'] = {};
  for (const name of candidates) {
    if (deps[name]) shared[name] = { singleton: true, requiredVersion: false };
  }

  return shared;
}

async function detectSharedFromSource(appDir: string) {
  // Lightweight heuristic: look at imports in src/** for a few known packages.
  const srcDir = path.join(appDir, 'src');
  if (!(await fs.pathExists(srcDir))) return {};

  const entries = await fs.readdir(srcDir);
  const files = entries.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));

  const shared: FederationConfig['shared'] = {};
  const lookFor = ['react', 'react-dom', 'react-router-dom', '@jorvel/event-bus', '@jorvel/state', '@jorvel/ui', '@jorvel/runtime'];

  for (const file of files) {
    const content = await fs.readFile(path.join(srcDir, file), 'utf8');
    for (const pkg of lookFor) {
      if (content.includes(`from '${pkg}'`) || content.includes(`from \"${pkg}\"`) || content.includes(`require('${pkg}')`)) {
        shared[pkg] = { singleton: true, requiredVersion: false };
      }
    }
  }

  return shared;
}

async function writeFederationConfig(
  appDir: string,
  cfg: FederationConfig,
  envSuffix?: string | null,
) {
  const filename = envSuffix
    ? `jorvel.federation.${envSuffix}.json`
    : 'jorvel.federation.json';
  const outPath = path.join(appDir, filename);
  const withSchema = {
    $schema: '../../node_modules/@jorvel/types/schemas/jorvel.federation.json',
    ...cfg,
  };
  await fs.outputFile(outPath, JSON.stringify(withSchema, null, 2) + '\n', 'utf8');
}

export const federationCommand = new Command('federation')
  .description('Generate starter Module Federation config files (JSON) for apps')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option(
    '--env <name>',
    'Emit env-suffixed files (jorvel.federation.<env>.json). Useful for shipping prod remote URLs alongside dev defaults.',
  )
  .action(async (opts: { dir: string; env?: string }) => {
    const workspaceDir = path.resolve(opts.dir);

    // When --env is supplied, the host + remote outputs land under the
    // sibling jorvel.federation.<env>.json. Runtime loaders pick the correct
    // file via `JORVEL_FEDERATION_FILE` env var (see rspack.config.mjs).
    const envSuffix = opts.env && /^[a-z0-9-]+$/i.test(opts.env) ? opts.env : null;
    if (opts.env && !envSuffix) {
      console.error(
        kleur.red(`Invalid --env "${opts.env}". Use a-z, 0-9, hyphen (e.g. prod, staging).`),
      );
      process.exitCode = 1;
      return;
    }

  const { cfg: workspaceCfg, plugins } = await loadWorkspaceConfig(workspaceDir);
    const apps = await discoverApps(workspaceDir, workspaceCfg.appsDir);

    if (apps.length === 0) {
      console.log(kleur.yellow('No apps found (missing apps/*/jorvel.app.json).'));
      return;
    }

    const host = apps.find((a) => a.meta.type === 'host');
    const remotes = apps.filter((a) => a.meta.type === 'remote');

    // The container global (left of `@` in a `name@url` remote spec) must equal
    // the remote's ModuleFederationPlugin `name`, which is the *sanitized*
    // federation name (hyphens → underscores). The import-specifier key keeps the
    // raw app name. Track the sanitized name per remote dir so the host wires the
    // correct global — otherwise hyphenated remotes (e.g. `user-portal`) never load.
    const remoteFedName = new Map<string, string>();

    // Generate remotes first.
    for (const remote of remotes) {
      const detectedName = await detectAppName(remote.dir, remote.meta);
      remoteFedName.set(remote.dir, toFederationName(detectedName));
      const exposes = await detectExposes(remote.dir, remote.meta);
      const remoteFw = remote.meta.framework ?? 'react';
      // A non-React remote embeds via @jorvel/mount — don't scan its source for
      // React singletons (it has none); its framework runtime comes from defaultShared.
      const detectedShared =
        remoteFw === 'react'
          ? mergeShared(await detectSharedFromPackageJson(remote.dir), await detectSharedFromSource(remote.dir))
          : {};
      const shared = mergeShared(defaultShared('remote', remoteFw), detectedShared);

      // Allow workspace config to add extra shared singleton deps.
      const extraShared = (workspaceCfg.federation?.shared ?? []).reduce((acc, name) => {
        acc[name] = { singleton: true, requiredVersion: false };
        return acc;
      }, {} as FederationConfig['shared']);

      const cfg: FederationConfig = {
        name: toFederationName(detectedName),
        filename: 'remoteEntry.js',
        ...(exposes !== undefined ? { exposes } : {}),
        shared: mergeShared(shared, extraShared)
      };

      // Plugin hook: federationConfig
      let finalCfg: FederationConfig = cfg;
      for (const p of plugins) {
        if (!p.federationConfig) continue;
        const next = await p.federationConfig({
          workspaceDir,
          app: { ...remote.meta, dir: remote.dir },
          config: finalCfg,
        });
        if (next) finalCfg = next as FederationConfig;
      }

      await writeFederationConfig(remote.dir, finalCfg, envSuffix);
      const remoteFilename = envSuffix ? `jorvel.federation.${envSuffix}.json` : 'jorvel.federation.json';
      console.log(kleur.green(`wrote ${path.relative(workspaceDir, path.join(remote.dir, remoteFilename))}`));
    }

    if (host) {
      const detectedName = await detectAppName(host.dir, host.meta);
      const shared = mergeShared(defaultShared('host'), await detectSharedFromPackageJson(host.dir), await detectSharedFromSource(host.dir));

      const extraShared = (workspaceCfg.federation?.shared ?? []).reduce((acc, name) => {
        acc[name] = { singleton: true, requiredVersion: false };
        return acc;
      }, {} as FederationConfig['shared']);

      const cfg: FederationConfig = {
        name: toFederationName(detectedName),
        filename: 'remoteEntry.js',
  // Rspack dev-server serves remoteEntry at the root by default.
  // (Vite-style /assets/remoteEntry.js doesn't apply here.)
  // Key = raw app name (the import-specifier prefix: `import('user-portal/App')`).
  // Global (left of @) = sanitized federation name, matching the remote's container.
  remotes: Object.fromEntries(
    remotes.map((r) => [
      r.meta.name,
      `${remoteFedName.get(r.dir) ?? toFederationName(r.meta.name)}@http://localhost:${r.meta.port}/remoteEntry.js`,
    ]),
  ),
        shared: mergeShared(shared, extraShared)
      };

      let finalCfg: FederationConfig = cfg;
      for (const p of plugins) {
        if (!p.federationConfig) continue;
        const next = await p.federationConfig({
          workspaceDir,
          app: { ...host.meta, dir: host.dir },
          config: finalCfg,
        });
        if (next) finalCfg = next as FederationConfig;
      }

      await writeFederationConfig(host.dir, finalCfg, envSuffix);
      const hostFilename = envSuffix ? `jorvel.federation.${envSuffix}.json` : 'jorvel.federation.json';
      console.log(kleur.green(`wrote ${path.relative(workspaceDir, path.join(host.dir, hostFilename))}`));
    }

  console.log(kleur.cyan('Done. Next: run `jorvel dev` and open the host app; it should load the remote via Module Federation.'));
  });

// `jorvel federation diff --base <ref>` — CI gate for contract drift.
attachFederationDiff(federationCommand);
// `jorvel federation impact [remote]` — which hosts consume a remote.
attachFederationImpact(federationCommand);
