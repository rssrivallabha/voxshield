'use client';

import * as React from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { UserRole } from '@/types/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [email, setEmail] = React.useState('operator@voxshield.sec');
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('admin');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-muted-foreground">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        await login({ email, roleOverride: selectedRole });
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 p-6 rounded-lg border border-panel-border bg-panel-elevated shadow-panel">
          <div className="flex items-center gap-3 border-b border-panel-border pb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <svg className="h-6 w-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2a10 10 0 0 0-7 17l5-5 5 5a10 10 0 1 0 7-17z" />
                <path d="M9 9l6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">VoxShield Platform</h1>
              <p className="text-xs text-muted-foreground">Enterprise Voice Security Authentication</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Select Operational Role (Dev / Fixture)</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['operator', 'analyst', 'admin'] as UserRole[]).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant={selectedRole === role ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedRole(role);
                      setEmail(`${role}@voxshield.sec`);
                    }}
                  >
                    {role.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Authenticating...' : 'Authenticate & Access Console'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center pt-2 border-t border-panel-border">
            VoxShield Frontend Auth Provider • Backend Enforcement Required
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
