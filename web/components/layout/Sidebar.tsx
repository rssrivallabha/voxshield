'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { hasPermission } from '@/lib/auth/rbac';
import { Permission } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { href: '/dashboard', label: 'Command Center', icon: 'layout-dashboard' },
  { href: '/calls', label: 'Active Calls', icon: 'phone', permission: 'calls:read' },
  { href: '/incidents', label: 'Incidents', icon: 'file-text', permission: 'incidents:read' },
  { href: '/identities', label: 'Identities', icon: 'users', permission: 'identities:read' },
  { href: '/policies', label: 'Policies', icon: 'shield', permission: 'policies:read' },
  { href: '/audit', label: 'Audit Log', icon: 'clipboard-list', permission: 'audit:read' },
  { href: '/settings', label: 'Settings', icon: 'settings', permission: 'settings:manage' },
  // Admin-only sections
  { href: '/admin/samples', label: 'Voice Samples', icon: 'file-text', adminOnly: true },
  { href: '/admin/training', label: 'Training', icon: 'cpu', adminOnly: true },
  { href: '/admin/models', label: 'Model Registry', icon: 'database', adminOnly: true },
];

const icons: Record<string, React.ReactNode> = {
  'layout-dashboard': (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  phone: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  'file-text': (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  shield: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  'clipboard-list': (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="9" y1="19" x2="15" y2="19" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  ),
settings: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  cpu: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9z" />
    </svg>
  ),
  database: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
};

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
}

export function Sidebar({ className, collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleNav = navigation.filter((item) => {
    if (item.adminOnly) {
      return user?.role === 'admin';
    }
    if (!item.permission) return true;
    return hasPermission(user, item.permission);
  });

  return (
    <aside
      className={cn(
        'flex flex-col h-full border-r border-panel-border bg-panel transition-standard',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center justify-center border-b border-panel-border">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg text-foreground" aria-label="VoxShield Home">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="h-5 w-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-7 17l5-5 5 5a10 10 0 1 0 7-17z" />
                <path d="M9 9l6 6" />
              </svg>
            </div>
            <span>VoxShield</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="flex items-center justify-center" aria-label="VoxShield Home">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="h-5 w-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-7 17l5-5 5 5a10 10 0 1 0 7-17z" />
                <path d="M9 9l6 6" />
              </svg>
            </div>
          </Link>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Navigation">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href || (pathname !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-fast',
                'focus-visible-ring',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                collapsed && 'justify-center'
              )}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              {icons[item.icon]}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-panel-border">
        {!collapsed && (
          <div className="rounded-lg border border-panel-border bg-panel-elevated p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">System Status</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-signal-active animate-live-indicator" aria-hidden="true" />
              <span>Operational</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
