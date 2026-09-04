'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { DataTable } from '@/components/data-display/DataTable';
import { RiskIndicator } from '@/components/data-display/RiskIndicator';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useSecurityPolicies, useToggleSecurityPolicy } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/auth/AuthContext';
import { hasPermission } from '@/lib/auth/rbac';
import { shield } from '@/lib/icons';
import { RiskState } from '@/types/risk';

export default function PoliciesPage() {
  const { data: policies = [], isLoading } = useSecurityPolicies();
  const toggleMutation = useToggleSecurityPolicy();
  const { user } = useAuth();
  const canEditPolicy = hasPermission(user, 'policies:write');

  const handleToggle = (id: string, currentEnabled: boolean) => {
    toggleMutation.mutate({ id, enabled: !currentEnabled });
  };

  return (
    <PermissionGuard permission="policies:read">
      <div className="space-y-6">
        <PageHeader
          title="Policy Engine Configuration"
          description="Configure automated risk response rules and verification triggers"
        />
        <Panel>
          <PanelHeader
            title="Active Security Policies"
            description="Rules governing interaction permissions based on fused risk score"
            icon={shield({ className: 'h-4 w-4' })}
          />
          <PanelBody className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'name', header: 'Policy Name' },
                  { key: 'description', header: 'Description' },
                  {
                    key: 'riskThreshold',
                    header: 'Trigger Threshold',
                    render: (row) => <RiskIndicator state={row.riskThreshold as RiskState} size="sm" />,
                  },
                  {
                    key: 'action',
                    header: 'Enforcement Action',
                    render: (row) => <span className="font-mono text-xs text-primary font-semibold">{row.action}</span>,
                  },
                  { key: 'channelFilter', header: 'Target Channels' },
                  {
                    key: 'enabled',
                    header: 'State',
                    align: 'center',
                    render: (row) => (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${row.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                        {row.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    header: 'Controls',
                    align: 'right',
                    render: (row) => (
                      <Button
                        variant={row.enabled ? 'outline' : 'primary'}
                        size="sm"
                        disabled={!canEditPolicy || toggleMutation.isPending}
                        onClick={() => handleToggle(row.id, row.enabled)}
                      >
                        {row.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    ),
                  },
                ]}
                data={policies}
                keyExtractor={(row) => row.id}
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}
