/**
 * Runtime validation of `jorvel.config.json` against the canonical JSON Schema
 * shipped by `@jorvel/types`. The schema is the single source of truth for the
 * config shape (the TS `JorvelWorkspaceConfig` mirrors it), so validating
 * against it catches drift between what users write and what the CLI accepts.
 */

import { createRequire } from 'node:module';
import fs from 'fs-extra';
import Ajv, { type ValidateFunction } from 'ajv';

export interface ConfigValidationResult {
  valid: boolean;
  /** Human-readable messages like `/federation/sri: must be boolean`. */
  errors: string[];
}

let cachedValidator: ValidateFunction | null = null;

async function getValidator(): Promise<ValidateFunction> {
  if (cachedValidator) return cachedValidator;
  const require = createRequire(import.meta.url);
  // Resolve the bundled schema via the package's `exports` subpath.
  const schemaPath = require.resolve('@jorvel/types/schemas/jorvel.config.json');
  const schema = (await fs.readJson(schemaPath)) as Record<string, unknown>;
  // validateFormats:false — we only need structural/type/enum validation, and
  // the schema's `format: "uri"` annotations would otherwise log "unknown format"
  // warnings (ajv ships no format validators by default).
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  cachedValidator = ajv.compile(schema);
  return cachedValidator;
}

/**
 * Validate a parsed config object against the schema. Never throws — returns a
 * structured result so callers decide whether to warn or fail.
 */
export async function validateWorkspaceConfig(config: unknown): Promise<ConfigValidationResult> {
  try {
    const validate = await getValidator();
    const valid = validate(config) as boolean;
    if (valid) return { valid: true, errors: [] };
    const errors = (validate.errors ?? []).map((e) => {
      const where = e.instancePath || '(root)';
      return `${where}: ${e.message ?? 'invalid'}`;
    });
    return { valid: false, errors };
  } catch (err) {
    // Schema unreadable / ajv failure — don't block the CLI on validation.
    return { valid: false, errors: [`config validation unavailable: ${(err as Error).message}`] };
  }
}
