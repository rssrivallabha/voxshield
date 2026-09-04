'use client';

import * as React from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { hasPermission, hasRole } from '@/lib/auth/rbac';
import { Permission, UserRole } from '@/types/auth';
import { UnauthorizedState } from '@/components/feedback/UnauthorizedState';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: Permission | Permission[];
  role?: UserRole | UserRole[];
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  children,
  permission,
  role,
  fallback,
}: PermissionGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  let isAllowed = true;

  if (role && !hasRole(user, role)) {
    isAllowed = false;
  }

  if (permission && !hasPermission(user, permission)) {
    isAllowed = false;
  }

  if (!isAllowed) {
    if (fallback) return <>{fallback}</>;
    return (
      <UnauthorizedState
        requiredPermission={permission ? (Array.isArray(permission) ? permission.join(', ') : permission) : undefined}
        requiredRole={role}
      />
    );
  }

  return <>{children}</>;
}
