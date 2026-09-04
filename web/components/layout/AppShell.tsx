'use client';

import * as React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Panel, PanelBody } from '@/components/ui/Panel';
import { useUiStore } from '@/lib/stores/useUiStore';
import { AuthGuard } from '@/components/auth/AuthGuard';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Panel>
              <PanelBody>{children}</PanelBody>
            </Panel>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
