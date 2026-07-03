import path from 'node:path';
import fs from 'fs-extra';
import { pathToFileURL } from 'node:url';
import kleur from 'kleur';
import type { JorvelWorkspaceConfig } from '@jorvel/types';
import { JorvelCliError } from './errors.js';
import { validateWorkspaceConfig } from './config-schema.js';

/**
 * The CLI config type is the shared `@jorvel/types` `JorvelWorkspaceConfig` with
 * one override: `plugins` here are live CLI plugin objects (functions), whereas
 * the shared/JSON-schema `plugins` is an opaque array (functions can't live in
 * JSON). Everything else is the single source of truth in `@jorvel/types` —
 * do NOT re-declare config fields here.
 */
export type CliWorkspaceConfig = Omit<JorvelWorkspaceConfig, 'plugins'> & {
  plugins?: CliPlugin[];
};

export type CliPlugin = {
  name: string;
  configResolved?: (cfg: CliWorkspaceConfig) => CliWorkspaceConfig | void | Promise<CliWorkspaceConfig | void>;
  federationConfig?: (args: {
    workspaceDir: string;
    app: { name: string; type: 'host' | 'remote'; port: number; dir: string };
    config: unknown;
  }) => unknown | void | Promise<unknown | void>;
  devPlan?: (plan: unknown) => unknown | void | Promise<unknown | void>;
};

const PROTO_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-merge `source` into `target`, ignoring prototype-pollution keys. Arrays
 * are replaced (not concatenated) — the layered config story we want is "JSON
 * sets defaults, TS overrides", and array concat would silently broaden
 * security-critical lists like `allowlist`.
 */
function deepMerge<T extends object>(target: T, source: Partial<T> | undefined): T {
  if (!source) return target;
  for (const key of Object.keys(source)) {
    if (PROTO_KEYS.has(key)) continue;
    const srcVal = (source as Record<string, unknown>)[key];
    const tgtVal = (target as Record<string, unknown>)[key];
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      (target as Record<string, unknown>)[key] = deepMerge({ ...tgtVal }, srcVal);
    } else {
      (target as Record<string, unknown>)[key] = srcVal;
    }
  }
  return target;
}

async function applyHook<T>(value: T, plugins: CliPlugin[], hook: keyof CliPlugin): Promise<T> {
  let out = value;
  for (const p of plugins) {
    const fn = p[hook] as ((arg: T) => T | void | Promise<T | void>) | undefined;
    if (!fn) continue;
    const next = await fn(out);
    if (next !== undefined) out = next as T;
  }
  return out;
}

function debugWarn(msg: string): void {
  if (process.env['JORVEL_DEBUG'] === '1' || process.env['JORVEL_DEBUG'] === 'true') {
    // eslint-disable-next-line no-console
    console.warn(kleur.yellow(`[jorvel] ${msg}`));
  }
}

async function loadJsonConfig(jsonPath: string): Promise<CliWorkspaceConfig | null> {
  try {
    return (await fs.readJson(jsonPath)) as CliWorkspaceConfig;
  } catch (err) {
    throw new JorvelCliError(
      `Failed to parse ${path.basename(jsonPath)}: ${(err as Error).message}`,
      {
        code: 'CONFIG-001',
        hint: [
          `File: ${jsonPath}`,
          'Hint: check for trailing commas or stray characters.',
        ],
      },
    );
  }
}

async function loadTsConfig(tsPath: string): Promise<CliWorkspaceConfig | null> {
  // We refuse to import `.ts` directly: at runtime the CLI ships as compiled
  // JS, so `await import('jorvel.config.ts')` either silently no-ops or runs
  // user code unchecked. We require a pre-transpiled `jorvel.config.js` (or .mjs)
  // sibling. Users who like TS should compile through tsx/jiti themselves.
  //
  // A `jorvel.config.ts` with NO compiled sibling is treated as a typed-but-not-
  // -loadable file: we skip it (debug-warn) rather than hard-throwing. `jorvel
  // init` ships a `jorvel.config.json` next to the `.ts` that carries the real
  // runtime values, so an unaccompanied `.ts` is a no-op, not a fatal error.
  const candidate = tsPath.replace(/\.ts$/, '.js');
  if (!(await fs.pathExists(candidate))) {
    debugWarn(
      `Found ${path.basename(tsPath)} but no compiled ${path.basename(candidate)} — skipping it. ` +
        `Compile it (e.g. \`tsc ${path.basename(tsPath)}\`) or rename to .js / .mjs to have it loaded.`,
    );
    return null;
  }
  try {
    const mod = (await import(pathToFileURL(candidate).href)) as Record<string, unknown>;
    const cfg = (mod['default'] ?? mod['config'] ?? null) as CliWorkspaceConfig | null;
    if (cfg && typeof cfg === 'object') return cfg;
    return null;
  } catch (err) {
    throw new JorvelCliError(
      `Failed to load ${path.basename(candidate)}: ${(err as Error).message}`,
      { code: 'CONFIG-003', hint: `File: ${candidate}` },
    );
  }
}

export interface LoadConfigResult {
  cfg: CliWorkspaceConfig;
  plugins: CliPlugin[];
  /** True if no `jorvel.config.{json,ts,js}` was found. */
  missing: boolean;
}

export async function loadWorkspaceConfig(workspaceDir: string): Promise<LoadConfigResult> {
  const jsonPath = path.join(workspaceDir, 'jorvel.config.json');
  const tsPath = path.join(workspaceDir, 'jorvel.config.ts');
  const jsPath = path.join(workspaceDir, 'jorvel.config.js');
  const mjsPath = path.join(workspaceDir, 'jorvel.config.mjs');

  let cfg: CliWorkspaceConfig = {};
  let foundAny = false;
  let loadedCompiled = false;

  if (await fs.pathExists(jsonPath)) {
    foundAny = true;
    const json = await loadJsonConfig(jsonPath);
    if (json) cfg = deepMerge<CliWorkspaceConfig>({} as CliWorkspaceConfig, { ...cfg, ...json });
  }

  for (const p of [mjsPath, jsPath]) {
    if (await fs.pathExists(p)) {
      foundAny = true;
      loadedCompiled = true;
      try {
        const mod = (await import(pathToFileURL(p).href)) as Record<string, unknown>;
        const next = (mod['default'] ?? mod['config'] ?? null) as CliWorkspaceConfig | null;
        if (next && typeof next === 'object') {
          cfg = deepMerge<CliWorkspaceConfig>(cfg, next);
        }
        break;
      } catch (err) {
        throw new JorvelCliError(
          `Failed to load ${path.basename(p)}: ${(err as Error).message}`,
          { code: 'CONFIG-003', hint: `File: ${p}` },
        );
      }
    }
  }

  // Only consult the `.ts` when no compiled `.js`/`.mjs` was already loaded —
  // `loadTsConfig` resolves the same `.js` sibling, so loading it here too would
  // merge the compiled config twice (and re-run its module side effects).
  if (!loadedCompiled && (await fs.pathExists(tsPath))) {
    foundAny = true;
    const tsCfg = await loadTsConfig(tsPath);
    if (tsCfg) cfg = deepMerge<CliWorkspaceConfig>(cfg, tsCfg);
  }

  if (!foundAny) {
    debugWarn(`No jorvel.config.{json,js,mjs,ts} found in ${workspaceDir}.`);
  } else {
    // Best-effort schema validation. Debug-only so a schema hiccup never blocks
    // a command — `jorvel config validate` surfaces the full report on demand.
    const { valid, errors } = await validateWorkspaceConfig(cfg);
    if (!valid) {
      for (const e of errors) debugWarn(`jorvel.config invalid — ${e}`);
    }
  }

  const plugins: CliPlugin[] = Array.isArray(cfg.plugins) ? Object.freeze([...cfg.plugins]) as CliPlugin[] : [];
  cfg = await applyHook(cfg, plugins, 'configResolved');

  return { cfg, plugins, missing: !foundAny };
}

export function getTailwindDefault(cfg: CliWorkspaceConfig): boolean | undefined {
  return cfg?.features?.tailwind;
}
