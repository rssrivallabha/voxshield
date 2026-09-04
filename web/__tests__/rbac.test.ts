import { describe, it, expect } from 'vitest';
import { hasRole, hasPermission, can } from '../lib/auth/rbac';
import { User } from '../types/auth';

describe('RBAC Permission Helpers', () => {
  const operatorUser: User = {
    id: '1',
    email: 'op@test.com',
    name: 'Operator',
    role: 'operator',
  };

  const analystUser: User = {
    id: '2',
    email: 'analyst@test.com',
    name: 'Analyst',
    role: 'analyst',
  };

  const adminUser: User = {
    id: '3',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'admin',
  };

  it('hasRole identifies matching user roles correctly', () => {
    expect(hasRole(operatorUser, 'operator')).toBe(true);
    expect(hasRole(operatorUser, ['operator', 'analyst'])).toBe(true);
    expect(hasRole(operatorUser, 'admin')).toBe(false);
    expect(hasRole(null, 'operator')).toBe(false);
  });

  it('operator possesses calls:read and calls:manage but not settings:manage or audit:read', () => {
    expect(hasPermission(operatorUser, 'calls:read')).toBe(true);
    expect(hasPermission(operatorUser, 'calls:manage')).toBe(true);
    expect(hasPermission(operatorUser, 'audit:read')).toBe(false);
    expect(hasPermission(operatorUser, 'settings:manage')).toBe(false);
  });

  it('analyst possesses audit:read and identities:write but not settings:manage', () => {
    expect(hasPermission(analystUser, 'audit:read')).toBe(true);
    expect(hasPermission(analystUser, 'identities:write')).toBe(true);
    expect(hasPermission(analystUser, 'settings:manage')).toBe(false);
  });

  it('admin possesses all permissions', () => {
    expect(hasPermission(adminUser, 'settings:manage')).toBe(true);
    expect(hasPermission(adminUser, 'audit:read')).toBe(true);
    expect(can(adminUser, 'policies:write')).toBe(true);
  });
});
