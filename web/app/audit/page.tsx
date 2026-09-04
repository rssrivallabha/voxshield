'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { DataTable } from '@/components/data-display/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuditLogs } from '@/lib/hooks/useQueries';
import { fileText } from '@/lib/icons';
import { formatDateTime } from '@/lib/utils';
import { AuditLogEntry } from '@/types/domain';

export default function AuditPage() {
  const { data: logs = [], isLoading } = useAuditLogs();

  return (
    <PermissionGuard permission="audit:read">
      <div className="space-y-6">
        <PageHeader
          title="Immutable Audit Logs"
          description="High-assurance audit trail of system events, decisions, and administrative actions"
        />
        <Panel>
          <PanelHeader
            title="Security Event Log"
            description="Cryptographically tamper-evident event stream"
            icon={fileText({ className: 'h-4 w-4' })}
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
                  { key: 'id', header: 'Log ID', render: (row) => <span className="font-mono text-xs text-foreground font-semibold">{row.id}</span> },
                  { key: 'timestamp', header: 'Timestamp', render: (row) => <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.timestamp)}</span> },
                  { key: 'actor', header: 'Actor', render: (row) => <span className="font-medium text-xs">{row.actor} ({row.actorRole})</span> },
                  { key: 'action', header: 'Action', render: (row) => <span className="font-mono text-xs text-primary">{row.action}</span> },
                  { key: 'targetResource', header: 'Target Resource', render: (row) => <span className="font-mono text-xs">{row.targetResource}</span> },
                  {
                    key: 'outcome',
                    header: 'Outcome',
                    render: (row) => {
                      const variantMap: Record<AuditLogEntry['outcome'], 'default' | 'destructive' | 'secondary'> = {
                        SUCCESS: 'default',
                        FAILURE: 'destructive',
                        DENIED: 'secondary',
                      };
                      return <Badge variant={variantMap[row.outcome]}>{row.outcome}</Badge>;
                    },
                  },
                  { key: 'details', header: 'Details Description' },
                ]}
                data={logs}
                keyExtractor={(row) => row.id}
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}
