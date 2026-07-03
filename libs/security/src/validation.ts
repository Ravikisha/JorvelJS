/**
 * Tiny standard-schema-style validation — no zod/valibot dependency.
 *
 * Used to validate loader/action inputs and parsed form data. A `Validator<T>`
 * `.parse()`s an unknown input into `T` (throwing {@link ValidationError} on
 * failure) and `.safeParse()`s into a tagged result. Built-ins compose:
 *
 *     const schema = v.object({
 *       name: v.string(),
 *       age: v.number().optional(),
 *       tags: v.array(v.string()),
 *     });
 *     const data = schema.parse(input); // { name: string; age?: number; tags: string[] }
 *
 * Deliberately small but real: enough to gate request bodies without pulling in
 * a schema library, while matching the standard-schema shape.
 */

export interface ValidationIssue {
  /** Dotted path to the offending value (e.g. `user.age`). Empty for the root. */
  path: string;
  /** Human-readable message. */
  message: string;
}

/** Thrown by `Validator.parse` (and `validate` in throwing contexts). */
export class ValidationError extends Error {
  readonly status = 400;
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('; '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

export interface Validator<T> {
  /** Parse `input` into `T`, throwing {@link ValidationError} on failure. */
  parse(input: unknown): T;
  /** Parse `input` into a tagged result without throwing. */
  safeParse(input: unknown): SafeParseResult<T>;
  /** Return an optional variant that also accepts `undefined`. */
  optional(): Validator<T | undefined>;
}

/** Internal: a validator's core checker, collecting issues at `path`. */
type Check<T> = (input: unknown, path: string, issues: ValidationIssue[]) => T;

/** Internal handle: a validator plus its raw checker for nested composition. */
interface InternalValidator<T> extends Validator<T> {
  readonly check: Check<T>;
}

function makeValidator<T>(check: Check<T>): InternalValidator<T> {
  const self: InternalValidator<T> = {
    check,
    parse(input: unknown): T {
      const issues: ValidationIssue[] = [];
      const out = check(input, '', issues);
      if (issues.length > 0) throw new ValidationError(issues);
      return out;
    },
    safeParse(input: unknown): SafeParseResult<T> {
      const issues: ValidationIssue[] = [];
      const out = check(input, '', issues);
      return issues.length > 0 ? { success: false, issues } : { success: true, data: out };
    },
    optional(): Validator<T | undefined> {
      return makeValidator<T | undefined>((input, path, issues) =>
        input === undefined ? undefined : check(input, path, issues),
      );
    },
  };
  return self;
}

function fail(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function string(): Validator<string> {
  return makeValidator<string>((input, path, issues) => {
    if (typeof input !== 'string') {
      fail(issues, path, 'expected string');
      return '';
    }
    return input;
  });
}

function number(): Validator<number> {
  return makeValidator<number>((input, path, issues) => {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      fail(issues, path, 'expected number');
      return 0;
    }
    return input;
  });
}

function boolean(): Validator<boolean> {
  return makeValidator<boolean>((input, path, issues) => {
    if (typeof input !== 'boolean') {
      fail(issues, path, 'expected boolean');
      return false;
    }
    return input;
  });
}

function array<T>(item: Validator<T>): Validator<T[]> {
  return makeValidator<T[]>((input, path, issues) => {
    if (!Array.isArray(input)) {
      fail(issues, path, 'expected array');
      return [];
    }
    const out: T[] = [];
    const itemCheck = (item as InternalValidator<T>).check;
    for (let i = 0; i < input.length; i++) {
      out.push(itemCheck(input[i], path ? `${path}[${i}]` : `[${i}]`, issues));
    }
    return out;
  });
}

// Infer the output object type from a shape map.
type ObjectOutput<S extends Record<string, Validator<unknown>>> = {
  [K in keyof S]: S[K] extends Validator<infer U> ? U : never;
};

function object<S extends Record<string, Validator<unknown>>>(
  shape: S,
): Validator<ObjectOutput<S>> {
  return makeValidator<ObjectOutput<S>>((input, path, issues) => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      fail(issues, path, 'expected object');
      return {} as ObjectOutput<S>;
    }
    const record = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const child = shape[key] as InternalValidator<unknown>;
      const childPath = path ? `${path}.${key}` : key;
      out[key] = child.check(record[key], childPath, issues);
    }
    return out as ObjectOutput<S>;
  });
}

/** The built-in validator factory. */
export const v = { string, number, boolean, array, object };

/**
 * Validate `input` against `schema`, returning a tagged result (never throws).
 * Sugar over `schema.safeParse`.
 */
export function validate<T>(schema: Validator<T>, input: unknown): SafeParseResult<T> {
  return schema.safeParse(input);
}
