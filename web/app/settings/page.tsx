'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { envConfig } from '@/lib/config/env';
import { settings } from '@/lib/icons';

export default function SettingsPage() {
  return (
    <PermissionGuard permission="settings:manage">
      <div className="space-y-6">
        <PageHeader
          title="System Settings"
          description="Enterprise platform parameters, integration endpoints, and access control"
        />
        <Panel>
          <PanelHeader
            title="Platform Configuration"
            description="Core security parameters and integration endpoints"
            icon={settings({ className: 'h-4 w-4' })}
          />
          <PanelBody className="space-y-4">
            <div className="p-4 border border-panel-border rounded-lg bg-panel-elevated space-y-2">
              <h4 className="font-semibold text-foreground">API Transport Configuration</h4>
              <p className="text-sm text-muted-foreground font-mono">API Endpoint: {envConfig.apiUrl}</p>
              <p className="text-sm text-muted-foreground font-mono">WebSocket Endpoint: {envConfig.wsUrl}</p>
              <p className="text-sm text-muted-foreground font-mono">Mock Mode: {envConfig.useMockApi ? 'ACTIVE (Development Fixture)' : 'INACTIVE (Live API Transport)'}</p>
            </div>
            <div className="p-4 border border-panel-border rounded-lg bg-panel-elevated space-y-2">
              <h4 className="font-semibold text-foreground">Voice Gateway Adapter</h4>
              <p className="text-sm text-muted-foreground">Active Adapter: WebRTC / SIP Gateway (Simulated Mode active for evaluation)</p>
            </div>
            <div className="p-4 border border-panel-border rounded-lg bg-panel-elevated space-y-2">
              <h4 className="font-semibold text-foreground">Analysis Model Endpoints</h4>
              <p className="text-sm text-muted-foreground">Primary Detector: VoxShield Neural Classifier v2.4 (Local Fallback Ready)</p>
            </div>
            <div className="p-4 border border-panel-border rounded-lg bg-panel-elevated space-y-2">
              <h4 className="font-semibold text-foreground">Privacy & Retention</h4>
              <p className="text-sm text-muted-foreground">Raw Audio Storage: Disabled (Feature-only vector storage enabled)</p>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}
