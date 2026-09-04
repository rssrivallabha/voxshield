'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { shieldAlert } from '@/lib/icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { UserRole } from '@/types/auth';

interface UnauthorizedStateProps {
  requiredPermission?: string;
  requiredRole?: UserRole | UserRole[];
  title?: string;
  description?: string;
}

export function UnauthorizedState({
  requiredPermission,
  requiredRole,
  title = 'Access Restricted',
  description = 'You do not have permission to view this resource or perform this action.',
}: UnauthorizedStateProps) {
  const { user, switchRole } = useAuth();

  const roleText = requiredRole
    ? Array.isArray(requiredRole)
      ? requiredRole.join(' or ')
      : requiredRole
    : null;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px] rounded-lg border border-panel-border bg-panel-elevated">
      <div className="h-12 w-12 rounded-full bg-risk-critical-muted text-risk-critical flex items-center justify-center mb-4">
        {shieldAlert({ className: 'h-6 w-6' })}
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>

      <div className="p-3 rounded-md border border-panel-border bg-panel text-xs text-muted-foreground space-y-1 mb-6 text-left w-full max-w-md">
        <p><span className="font-mono text-foreground font-medium">Current User:</span> {user?.name || 'Unauthenticated'} ({user?.role || 'none'})</p>
        {requiredPermission && <p><span className="font-mono text-foreground font-medium">Required Permission:</span> {requiredPermission}</p>}
        {roleText && <p><span className="font-mono text-foreground font-medium">Required Role:</span> {roleText}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground w-full mb-1">Development Role Switcher:</p>
        {(['operator', 'analyst', 'admin'] as UserRole[]).map((r) => (
          <Button
            key={r}
            variant={user?.role === r ? 'primary' : 'outline'}
            size="sm"
            onClick={() => switchRole(r)}
          >
            Switch to {r.toUpperCase()}
          </Button>
        ))}
      </div>
    </div>
  );
}
