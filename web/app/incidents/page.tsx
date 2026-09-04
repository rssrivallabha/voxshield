'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { DataTable } from '@/components/data-display/DataTable';
import { RiskIndicator } from '@/components/data-display/RiskIndicator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useIncidents, useUpdateIncidentStatus } from '@/lib/hooks/useQueries';
import { alertTriangle } from '@/lib/icons';
import { RiskState } from '@/types/risk';
import { formatDateTime } from '@/lib/utils';
import { Incident } from '@/types/domain';

export default function IncidentsPage() {
  const { data: incidents = [], isLoading } = useIncidents();
  const updateStatusMutation = useUpdateIncidentStatus();

  const handleStatusChange = (id: string, newStatus: Incident['status']) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  return (
    <PermissionGuard permission="incidents:read">
      <div className="space-y-6">
        <PageHeader
          title="Incident Investigation"
          description="Review security events, risk escalations, and evidence payloads"
        />
        <Panel>
          <PanelHeader
            title="Security Incidents"
            description="High-risk threat incidents requiring investigation"
            icon={alertTriangle({ className: 'h-4 w-4' })}
          />
          <PanelBody className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'id', header: 'Incident ID', render: (row) => <span className="font-mono text-xs text-foreground font-semibold">{row.id}</span> },
                  { key: 'summary', header: 'Summary Description' },
                  { key: 'callerId', header: 'Caller ID' },
                  {
                    key: 'riskState',
                    header: 'Risk Level',
                    render: (row) => <RiskIndicator state={row.riskState as RiskState} size="sm" />,
                  },
                  {
                    key: 'assignedAnalyst',
                    header: 'Assigned Analyst',
                    render: (row) => <span className="text-xs">{row.assignedAnalyst || 'Unassigned'}</span>,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => {
                      const variantMap: Record<Incident['status'], 'destructive' | 'secondary' | 'default' | 'muted'> = {
                        OPEN: 'destructive',
                        IN_REVIEW: 'secondary',
                        RESOLVED: 'default',
                        DISMISSED: 'muted',
                      };
                      return <Badge variant={variantMap[row.status]}>{row.status}</Badge>;
                    },
                  },
                  {
                    key: 'createdAt',
                    header: 'Reported At',
                    render: (row) => <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>,
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    align: 'right',
                    render: (row) => (
                      <div className="flex items-center justify-end gap-1">
                        {row.status !== 'RESOLVED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => handleStatusChange(row.id, 'RESOLVED')}
                          >
                            Resolve
                          </Button>
                        )}
                        {row.status === 'OPEN' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => handleStatusChange(row.id, 'IN_REVIEW')}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={incidents}
                keyExtractor={(row) => row.id}
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}
