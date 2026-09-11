'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/data-display/DataTable';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatDateTime } from '@/lib/utils';

interface ModelVersion {
  version_id: string;
  parent_version_id: string | null;
  training_job_id: string;
  artifact_path: string;
  metrics_json: string;
  approval_state: string;
  deployed: number;
  created_at: string;
  approved_at: string | null;
  deployed_at: string | null;
}

export default function AdminModelsPage() {
  const queryClient = useQueryClient();

  const { data: models = [], isLoading } = useQuery<ModelVersion[]>({
    queryKey: ['admin', 'models'],
    queryFn: () => apiClient.get<ModelVersion[]>('/admin/models'),
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: (versionId: string) => apiClient.post(`/admin/models/${versionId}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'models'] }); },
  });

  const deployMutation = useMutation({
    mutationFn: (versionId: string) => apiClient.post(`/admin/models/${versionId}/deploy`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'models'] }); },
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => apiClient.post(`/admin/models/${versionId}/rollback`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'models'] }); },
  });

  return (
    <PermissionGuard permission="settings:manage">
      <div className="space-y-6">
        <PageHeader title="Model Registry" description="View and manage deployed model versions" />

        <Panel>
          <PanelHeader title="Model Versions" />
          <PanelBody className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <DataTable
                columns={[
                  { key: 'version_id', header: 'Version', render: (row) => <span className="font-mono text-xs font-semibold">{row.version_id}</span> },
                  { key: 'parent_version_id', header: 'Parent Version', render: (row) => <span className="font-mono text-xs">{row.parent_version_id ?? '—'}</span> },
                  { key: 'training_job_id', header: 'Training Job', render: (row) => <span className="font-mono text-xs">{row.training_job_id}</span> },
                  { key: 'approval_state', header: 'Approval', render: (row) => <Badge variant={row.approval_state === 'APPROVED' ? 'default' : row.approval_state === 'PENDING' ? 'secondary' : 'destructive'}>{row.approval_state}</Badge> },
                  { key: 'deployed', header: 'Deployed', align: 'center', render: (row) => <Badge variant={row.deployed ? 'default' : 'secondary'}>{row.deployed ? 'Yes' : 'No'}</Badge> },
                  { key: 'created_at', header: 'Created', render: (row) => <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span> },
                  { key: 'approved_at', header: 'Approved', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.approved_at ? formatDateTime(row.approved_at) : '—'}</span> },
                  { key: 'deployed_at', header: 'Deployed At', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.deployed_at ? formatDateTime(row.deployed_at) : '—'}</span> },
                  {
                    key: 'actions',
                    header: 'Actions',
                    align: 'center',
                    render: (row) => (
                      <div className="flex items-center justify-center gap-1">
                        {row.approval_state === 'PENDING' && (
                          <Button size="sm" variant="secondary" onClick={() => approveMutation.mutate(row.version_id)} disabled={approveMutation.isPending}>Approve</Button>
                        )}
                        {row.approval_state === 'APPROVED' && !row.deployed && (
                          <Button size="sm" variant="primary" onClick={() => deployMutation.mutate(row.version_id)} disabled={deployMutation.isPending}>Deploy</Button>
                        )}
                        {row.deployed && (
                          <Button size="sm" variant="outline" onClick={() => rollbackMutation.mutate(row.version_id)} disabled={rollbackMutation.isPending}>Rollback</Button>
                        )}
                      </div>
                    )
                  },
                ]}
                data={models}
                keyExtractor={(row) => row.version_id}
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}