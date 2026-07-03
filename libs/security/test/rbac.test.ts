import { describe, expect, it } from 'vitest';
import { createRbac, ForbiddenError } from '../src/rbac.js';

const rbac = createRbac({
  roles: {
    admin: ['*'],
    editor: ['posts:*', 'comments:read'],
    viewer: ['posts:read'],
  },
});

describe('createRbac.can', () => {
  it('allows an exact permission', () => {
    expect(rbac.can('viewer', 'posts:read')).toBe(true);
  });

  it('denies a permission the role lacks', () => {
    expect(rbac.can('viewer', 'posts:write')).toBe(false);
  });

  it('honours the namespace wildcard posts:*', () => {
    expect(rbac.can('editor', 'posts:write')).toBe(true);
    expect(rbac.can('editor', 'posts:delete')).toBe(true);
    expect(rbac.can('editor', 'comments:read')).toBe(true);
    expect(rbac.can('editor', 'comments:write')).toBe(false);
  });

  it('honours the global wildcard *', () => {
    expect(rbac.can('admin', 'anything:at-all')).toBe(true);
  });

  it('accepts an array of roles and unions their grants', () => {
    expect(rbac.can(['viewer', 'editor'], 'posts:write')).toBe(true);
  });

  it('treats anonymous (null/undefined) as no grants', () => {
    expect(rbac.can(null, 'posts:read')).toBe(false);
    expect(rbac.can(undefined, 'posts:read')).toBe(false);
  });

  it('ignores unknown roles', () => {
    expect(rbac.can('ghost', 'posts:read')).toBe(false);
  });

  it('namespace wildcard does not match a different namespace prefix', () => {
    expect(rbac.can('editor', 'postsx:read')).toBe(false);
  });
});

describe('createRbac.requirePermission', () => {
  it('passes silently when granted', () => {
    expect(() => rbac.requirePermission('admin', 'x:y')).not.toThrow();
  });

  it('throws ForbiddenError (403) when denied', () => {
    try {
      rbac.requirePermission('viewer', 'posts:write');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as ForbiddenError).status).toBe(403);
      expect((e as ForbiddenError).message).toContain('posts:write');
    }
  });
});

describe('createRbac role checks', () => {
  it('hasRole / hasAnyRole / hasAllRoles', () => {
    expect(rbac.hasRole(['admin', 'viewer'], 'admin')).toBe(true);
    expect(rbac.hasRole('viewer', 'admin')).toBe(false);
    expect(rbac.hasAnyRole('viewer', ['admin', 'viewer'])).toBe(true);
    expect(rbac.hasAnyRole('viewer', ['admin', 'editor'])).toBe(false);
    expect(rbac.hasAllRoles(['admin', 'editor'], ['admin', 'editor'])).toBe(true);
    expect(rbac.hasAllRoles(['admin'], ['admin', 'editor'])).toBe(false);
  });

  it('requireRole throws ForbiddenError when missing', () => {
    expect(() => rbac.requireRole('viewer', 'admin')).toThrow(ForbiddenError);
    expect(() => rbac.requireRole('viewer', 'viewer')).not.toThrow();
  });
});
