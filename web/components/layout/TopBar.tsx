'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/DropdownMenu';
import { StatusIndicator } from '@/components/data-display/StatusIndicator';
import { useAuth } from '@/lib/auth/AuthContext';
import { UserRole } from '@/types/auth';

const userIcons: React.ReactNode = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="10" cy="7" r="4" />
    <path d="M15.31 15.31A14.1 14.1 0 0 0 20 10c0-1.2-.2-2.37-.58-3.42" />
  </svg>
);

interface TopBarProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  className?: string;
}

export function TopBar({ onToggleSidebar, sidebarCollapsed = false, className }: TopBarProps) {
  const pathname = usePathname();
  const { user, logout, switchRole } = useAuth();

  const pageTitle = pathname === '/'
    ? 'Dashboard'
    : pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'VoxShield';

  return (
    <header
      className={cn(
        'sticky top-0 z-[200] flex h-14 items-center gap-4 border-b border-panel-border bg-panel/80 backdrop-blur-sm px-4',
        className
      )}
      role="banner"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex-shrink-0"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </Button>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-foreground truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        <StatusIndicator status="active" size="sm" label="API Connected" animate />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9 px-3" aria-label="User menu">
              <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                {userIcons}
              </span>
              <div className="hidden sm:flex flex-col items-start text-left">
                <span className="text-xs font-medium leading-none">{user?.name || 'Operator'}</span>
                <span className="text-[10px] text-muted-foreground font-mono uppercase mt-0.5">{user?.role || 'operator'}</span>
              </div>
              <svg className="h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <div className="px-3 py-2 border-b border-panel-border">
              <p className="text-xs font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-[10px] font-mono text-primary uppercase mt-1">Role: {user?.role}</p>
            </div>

            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Switch Role (Dev / Fixture)
            </div>
            {(['operator', 'analyst', 'admin'] as UserRole[]).map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => switchRole(role)}
                className={cn('text-xs capitalize', user?.role === role && 'font-bold text-primary')}
              >
                {role} {user?.role === role ? '(Active)' : ''}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive text-xs" onClick={() => logout()}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
