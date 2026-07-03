/**
 * Opinionated `Permissions-Policy` and `Referrer-Policy` defaults.
 *
 * `securityHeaders()` in `headers.ts` already wires these into the full preset;
 * this module exposes them standalone so you can compute just the policy pair
 * (e.g. to merge into an existing header map) and tune the feature allowlist.
 *
 * Deny-by-default: every powerful feature is locked to `()` (no origin) unless
 * you override it. An override of `['self']` allows the current origin,
 * `['*']` allows all, `[]` denies. Return shapes mirror `securityHeaders`:
 * lower-cased header names in a `Record<string, string>`.
 */

/** A feature → allowlist map. `[]` denies; `['self']`/`['*']`/origins allow. */
export type PermissionsPolicyMap = Record<string, readonly string[]>;

/**
 * Powerful features locked down by default. Mirrors common hardening guides:
 * sensors, payment, and ambient-capability features denied outright.
 */
const DEFAULT_PERMISSIONS_POLICY: PermissionsPolicyMap = {
  accelerometer: [],
  'ambient-light-sensor': [],
  autoplay: [],
  battery: [],
  camera: [],
  'display-capture': [],
  'document-domain': [],
  'encrypted-media': [],
  fullscreen: ['self'],
  geolocation: [],
  gyroscope: [],
  magnetometer: [],
  microphone: [],
  midi: [],
  payment: [],
  'picture-in-picture': [],
  'publickey-credentials-get': [],
  'screen-wake-lock': [],
  usb: [],
  'xr-spatial-tracking': [],
};

const DEFAULT_REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * Build a `Permissions-Policy` header value. Pass `overrides` to relax/lock
 * individual features; they shallow-merge over the deny-by-default set.
 */
export function permissionsPolicy(overrides: PermissionsPolicyMap = {}): string {
  const merged: PermissionsPolicyMap = { ...DEFAULT_PERMISSIONS_POLICY, ...overrides };
  return Object.entries(merged)
    .map(([feature, allow]) => `${feature}=(${allow.join(' ')})`)
    .join(', ');
}

/** Build a `Referrer-Policy` header value. Defaults to the secure-by-default. */
export function referrerPolicy(value: string = DEFAULT_REFERRER_POLICY): string {
  return value;
}

export interface PolicyHeadersOptions {
  /** Permissions-Policy overrides, or a raw header string. */
  permissions?: PermissionsPolicyMap | string;
  /** Referrer-Policy value. Default `strict-origin-when-cross-origin`. */
  referrer?: string;
}

/**
 * Return both policy headers as a `Record` ready to spread into a response.
 * Header names are lower-cased to match `securityHeaders()`.
 */
export function policyHeaders(opts: PolicyHeadersOptions = {}): {
  'Permissions-Policy': string;
  'Referrer-Policy': string;
} {
  const perms =
    typeof opts.permissions === 'string' ? opts.permissions : permissionsPolicy(opts.permissions);
  return {
    'Permissions-Policy': perms,
    'Referrer-Policy': referrerPolicy(opts.referrer),
  };
}
