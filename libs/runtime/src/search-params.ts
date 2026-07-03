/**
 * @jorvel/runtime — typed search-param helpers.
 *
 * Validate and serialize URL query strings into typed objects using a minimal,
 * standard-schema-style validator. ANY library that exposes `parse(input)` —
 * Zod, Valibot, Yup wrappers, or a hand-written object — conforms. We do NOT
 * depend on zod.
 *
 * Exports:
 *   - `Validator<T>`            — the minimal `{ parse(input:unknown):T }` contract
 *   - `createSearchSchema(v)`   — wrap a validator into a reusable schema with
 *                                 `parse` / `serialize` helpers
 *   - `parseSearchParams(s, v)` — URLSearchParams | string → typed `T`
 *   - `buildSearchString(vals)` — typed object → `"a=1&b=2"` (no leading `?`)
 *   - `useTypedSearchParams(v)` — React hook → `[typed, setTyped]`, SSR-safe,
 *                                 built on the existing `useSearchParams` hook
 *
 * SSR-safe: parsing/serialization touch no browser globals; the hook reads the
 * router (which falls back to the server router under SSR) and never assumes
 * `window` at module scope.
 */

import React from 'react';
import { useSearchParams } from './hooks.js';
// Reuse the canonical validator contract from typed-routes so a single schema
// object works with both APIs (and there's one exported `Validator` type).
import type { Validator } from './typed-routes.js';

/** A reusable typed-search schema produced by {@link createSearchSchema}. */
export interface SearchSchema<T> {
  /** Underlying validator. */
  readonly validator: Validator<T>;
  /** URLSearchParams | string → typed `T`. */
  parse: (search: string | URLSearchParams) => T;
  /** typed `T` → query string (no leading `?`). */
  serialize: (values: T) => string;
}

/** Convert a search input into a plain `Record<string,string>` of entries. */
function toRecord(search: string | URLSearchParams): Record<string, string> {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  return Object.fromEntries(params);
}

/**
 * Parse a query string / URLSearchParams into a typed object via `validator`.
 * The raw entries are passed as a `Record<string,string>`, so a validator that
 * coerces (e.g. `page: "2"` → `2`) works as expected.
 */
export function parseSearchParams<T>(
  search: string | URLSearchParams,
  validator: Validator<T>,
): T {
  return validator.parse(toRecord(search));
}

/**
 * Serialize a typed object into a query string (no leading `?`). `null` /
 * `undefined` values are dropped; arrays expand to repeated keys; everything
 * else is `String()`-coerced.
 */
export function buildSearchString(values: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null) continue;
        sp.append(key, String(item));
      }
      continue;
    }
    sp.set(key, String(value));
  }
  return sp.toString();
}

/**
 * Wrap a validator into a reusable schema. Handy to define once and share
 * between a loader, a link builder, and {@link useTypedSearchParams}.
 */
export function createSearchSchema<T>(validator: Validator<T>): SearchSchema<T> {
  return {
    validator,
    parse: (search) => parseSearchParams(search, validator),
    serialize: (values) => buildSearchString(values as Record<string, unknown>),
  };
}

export interface UseTypedSearchParamsOptions {
  /** Use `history.replaceState` instead of `push` when writing. Default false. */
  replace?: boolean;
}

/**
 * React hook returning `[typed, setTyped]`. `typed` is the current query string
 * parsed through `validator`; `setTyped` serializes the next value and
 * navigates. Built on the existing {@link useSearchParams} hook so it shares the
 * router's reactivity and SSR behavior.
 *
 * `setTyped` accepts either the next values or an updater `(prev) => next`.
 */
export function useTypedSearchParams<T>(
  validator: Validator<T>,
  options?: UseTypedSearchParamsOptions,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [params, setParams] = useSearchParams();

  // Re-parse only when the raw query string changes.
  const raw = params.toString();
  const typed = React.useMemo(() => parseSearchParams(params, validator), [raw, validator]);

  const replace = options?.replace === true;
  const setTyped = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const value =
        typeof next === 'function'
          ? (next as (prev: T) => T)(parseSearchParams(new URLSearchParams(raw), validator))
          : next;
      const query = buildSearchString(value as Record<string, unknown>);
      setParams(new URLSearchParams(query), { replace });
    },
    [raw, validator, setParams, replace],
  );

  return [typed, setTyped];
}
