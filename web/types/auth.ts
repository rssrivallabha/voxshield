export type UserRole = 'operator' | 'analyst' | 'admin' | 'system';

export type Permission =
  | 'calls:read'
  | 'calls:manage'
  | 'incidents:read'
  | 'incidents:write'
  | 'identities:read'
  | 'identities:write'
  | 'policies:read'
  | 'policies:write'
  | 'audit:read'
  | 'settings:manage';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  department?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  roleOverride?: UserRole; // Useful for dev testing roles
}
