/**
 * `jorvel schema` — emit JSON Schemas for JORVEL config files.
 *
 * These are NOT hand-written here: they are RE-SOURCED from the authoritative
 * schemas shipped by `@jorvel/types` (`@jorvel/types/schemas/*.json`), the same
 * files `jorvel init` references via `$schema`. A previous version hand-built a
 * second, contradictory set (app `kind` vs the real `type`, federation `remotes`
 * as an array vs the real `name@url` map, config requiring `name`/`apps`), which
 * gave users wrong editor validation. One source of truth now.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

export type SchemaName = 'jorvel.config' | 'jorvel.app' | 'jorvel.federation';

/** The config files that have an authoritative bundled schema in @jorvel/types. */
const BUNDLED_SCHEMAS: SchemaName[] = ['jorvel.config', 'jorvel.app', 'jorvel.federation'];

export interface SchemaCatalog {
  [name: string]: Record<string, unknown>;
}

const requireFromHere = createRequire(import.meta.url);

function readBundledSchema(name: SchemaName): Record<string, unknown> {
  const p = requireFromHere.resolve(`@jorvel/types/schemas/${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
}

/** Load the authoritative schema catalog from @jorvel/types. */
export function buildSchemas(): SchemaCatalog {
  const catalog: SchemaCatalog = {};
  for (const name of BUNDLED_SCHEMAS) catalog[name] = readBundledSchema(name);
  return catalog;
}

export interface WriteSchemasOptions {
  outDir: string;
  pretty?: boolean;
  /** Replace the default catalog (testing). */
  catalog?: SchemaCatalog;
}

export interface WriteSchemasResult {
  files: Array<{ name: SchemaName | string; path: string; bytes: number }>;
}

export function writeSchemas(opts: WriteSchemasOptions): WriteSchemasResult {
  const catalog = opts.catalog ?? buildSchemas();
  fs.mkdirSync(opts.outDir, { recursive: true });
  const files: WriteSchemasResult['files'] = [];
  for (const [name, schema] of Object.entries(catalog)) {
    const body = opts.pretty === false ? JSON.stringify(schema) : JSON.stringify(schema, null, 2);
    const filePath = path.join(opts.outDir, `${name}.json`);
    fs.writeFileSync(filePath, body + '\n', 'utf8');
    files.push({ name, path: filePath, bytes: Buffer.byteLength(body, 'utf8') });
  }
  return { files };
}

export const schemaCommand = new Command('schema')
  .description('Emit the authoritative JORVEL JSON Schemas (config / app / federation) from @jorvel/types.')
  .option('--out <dir>', 'output directory', './schemas')
  .option('--minify', 'emit compact JSON (no indent)')
  .action((opts: { out: string; minify?: boolean }) => {
    const writeOpts: WriteSchemasOptions = {
      outDir: path.resolve(process.cwd(), opts.out),
    };
    if (opts.minify) writeOpts.pretty = false;
    const result = writeSchemas(writeOpts);
    for (const f of result.files) {
      console.log(`✓ ${f.name}.json (${f.bytes} bytes) → ${f.path}`);
    }
  });
