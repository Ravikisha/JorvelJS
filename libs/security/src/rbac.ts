/**
 * Role-Based Access Control — pure permission helpers atop the session model.
 *
 * A `roles` map associates each role name with the permission strings it
 * grants. Permissions are colon-namespaced (`posts:read`, `posts:write`) and
 * support wildcards:
 *   - `*`        — grants everything.
 *   - `posts:*`  — grants every action in the `posts` namespace.
 *
 * Everything here is a pure function over `(userRoles, permission)` — no I/O, no
 * crypto — so it runs anywhere (`@jorvel/runtime` loaders/actions, edge, Node).
 * Pull `userRoles` off the verified session (see `session.ts`) and gate.
 */

export type RoleMap = Record<string, readonly string[]>;

export interface RbacOptions {
  /** Map of role name → permission strings it grants (wildcards allowed). */
  roles: RoleMap;
}

/** Thrown by `requirePermission` / `requireRole`. Carries a 403 hint. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** A user's roles: a single role name, a list, or null/undefined (anonymous). */
export type UserRoles = string | readonly string[] | null | undefined;

function toRoleList(userRoles: UserRoles): string[] {
  if (userRoles == null) return [];
  return typeof userRoles === 'string' ? [userRoles] : [...userRoles];
}

/**
 * Does `granted` (a permission a role holds) satisfy a `required` permission?
 * `*` matches anything; `ns:*` matches any action under `ns`; otherwise exact.
 */
function grantMatches(granted: string, required: string): boolean {
  if (granted === '*' || granted === required) return true;
  if (granted.endsWith(':*')) {
    const ns = granted.slice(0, -1); // keep trailing ':' → 'posts:'
    return required.startsWith(ns);
  }
  return false;
}

export interface Rbac {
  /** True if any of the user's roles grants `permission`. */
  can(userRoles: UserRoles, permission: string): boolean;
  /** Throws {@link ForbiddenError} (403) unless `can` is true. */
  requirePermission(userRoles: UserRoles, permission: string): void;
  /** Throws {@link ForbiddenError} (403) unless the user holds `role`. */
  requireRole(userRoles: UserRoles, role: string): void;
  /** True if the user holds the exact `role`. */
  hasRole(userRoles: UserRoles, role: string): boolean;
  /** True if the user holds at least one of `roles`. */
  hasAnyRole(userRoles: UserRoles, roles: readonly string[]): boolean;
  /** True if the user holds every one of `roles`. */
  hasAllRoles(userRoles: UserRoles, roles: readonly string[]): boolean;
}

/** Build an {@link Rbac} checker from a role→permissions map. */
export function createRbac(opts: RbacOptions): Rbac {
  const roles = opts.roles;

  const can = (userRoles: UserRoles, permission: string): boolean => {
    for (const role of toRoleList(userRoles)) {
      const grants = roles[role];
      if (!grants) continue;
      for (const granted of grants) {
        if (grantMatches(granted, permission)) return true;
      }
    }
    return false;
  };

  const hasRole = (userRoles: UserRoles, role: string): boolean =>
    toRoleList(userRoles).includes(role);

  const hasAnyRole = (userRoles: UserRoles, want: readonly string[]): boolean => {
    const held = toRoleList(userRoles);
    return want.some((r) => held.includes(r));
  };

  const hasAllRoles = (userRoles: UserRoles, want: readonly string[]): boolean => {
    const held = toRoleList(userRoles);
    return want.every((r) => held.includes(r));
  };

  return {
    can,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    requirePermission(userRoles: UserRoles, permission: string): void {
      if (!can(userRoles, permission)) {
        throw new ForbiddenError(`Missing permission: ${permission}`);
      }
    },
    requireRole(userRoles: UserRoles, role: string): void {
      if (!hasRole(userRoles, role)) {
        throw new ForbiddenError(`Missing role: ${role}`);
      }
    },
  };
}
