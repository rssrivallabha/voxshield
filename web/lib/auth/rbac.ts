import { User, UserRole, Permission } from '../../types/auth';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  operator: [
    'calls:read',
    'calls:manage',
    'incidents:read',
    'policies:read',
  ],
  analyst: [
    'calls:read',
    'incidents:read',
    'incidents:write',
    'identities:read',
    'identities:write',
    'policies:read',
    'audit:read',
  ],
  admin: [
    'calls:read',
    'calls:manage',
    'incidents:read',
    'incidents:write',
    'identities:read',
    'identities:write',
    'policies:read',
    'policies:write',
    'audit:read',
    'settings:manage',
  ],
  system: [
    'calls:read',
    'calls:manage',
    'incidents:read',
    'incidents:write',
    'identities:read',
    'identities:write',
    'policies:read',
    'policies:write',
    'audit:read',
    'settings:manage',
  ],
};

export function hasRole(user: User | null | undefined, roles: UserRole | UserRole[]): boolean {
  if (!user) return false;
  const roleList = Array.isArray(roles) ? roles : [roles];
  return roleList.includes(user.role);
}

export function hasPermission(
  user: User | null | undefined,
  permissions: Permission | Permission[]
): boolean {
  if (!user) return false;
  
  if (user.role === 'admin') return true;

  const required = Array.isArray(permissions) ? permissions : [permissions];
  const userPerms = ROLE_PERMISSIONS[user.role] || [];

  return required.every((p) => userPerms.includes(p));
}

export function can(
  user: User | null | undefined,
  permission: Permission
): boolean {
  return hasPermission(user, permission);
}
