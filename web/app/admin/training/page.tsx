'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/data-display/DataTable';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';


interface TrainingJob {
  job_id: string;
  dataset_version: number;
  parent_model_version: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  config_json: string;
  metrics_json: string | null;
  artifact_path: string | null;
  created_by: string;
}

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

export default function AdminTrainingPage() {
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<TrainingJob[]>({
    queryKey: ['admin', 'training', 'jobs'],
    queryFn: () => apiClient.get<TrainingJob[]>('/admin/training/jobs'),
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelVersion[]>({
    queryKey: ['admin', 'models'],
    queryFn: () => apiClient.get<ModelVersion[]>('/admin/models'),
  });

  const startMutation = useMutation({
    mutationFn: (config: { dataset_version: number; epochs: number; batch_size: number; lr: number; weight_decay: number; seed: number }) =>
      apiClient.post<{ job_id: string }>('/admin/training/start', config),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'training', 'jobs'] }); },
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

  const [showStart, setShowStart] = React.useState(false);
  const [config, setConfig] = React.useState({ dataset_version: 1, epochs: 5, batch_size: 16, lr: 1e-4, weight_decay: 1e-5, seed: 42 });

  return (
    <PermissionGuard permission="settings:manage">
      <div className="space-y-6">
        <PageHeader title="Training & Model Management" description="Start training jobs, review model versions, and control deployment lifecycle" />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Training Jobs */}
          <Panel>
            <PanelHeader
              title="Training Jobs"
              actions={
                <Button variant="outline" size="sm" onClick={() => setShowStart(true)} disabled={startMutation.isPending}>
                  Start Training
                </Button>
              }
            />
            <PanelBody className="p-0">
              {jobsLoading ? (
                <div className="p-4 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <DataTable
                  columns={[
                    { key: 'job_id', header: 'Job ID', render: (row) => <span className="font-mono text-xs">{row.job_id}</span> },
                    { key: 'status', header: 'Status', render: (row) => <Badge variant={row.status === 'VALIDATED' ? 'default' : row.status === 'RUNNING' ? 'secondary' : row.status === 'FAILED' ? 'destructive' : 'secondary'}>{row.status}</Badge> },
                    { key: 'dataset_version', header: 'Dataset Ver', align: 'center' },
                    { key: 'parent_model_version', header: 'Parent Model', render: (row) => <span className="font-mono text-xs">{row.parent_model_version ?? '—'}</span> },
                    { key: 'started_at', header: 'Started', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.started_at ? new Date(row.started_at).toLocaleString() : '—'}</span> },
                    { key: 'completed_at', header: 'Completed', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.completed_at ? new Date(row.completed_at).toLocaleString() : '—'}</span> },
                  ]}
                  data={jobs}
                  keyExtractor={(row) => row.job_id}
                />
              )}
              {showStart && (
                <form onSubmit={(e) => { e.preventDefault(); startMutation.mutate(config); setShowStart(false); }} className="p-4 border-t border-panel-border space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label>Dataset Version</Label><Input type="number" value={config.dataset_version} onChange={e => setConfig({...config, dataset_version: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><Label>Epochs</Label><Input type="number" value={config.epochs} onChange={e => setConfig({...config, epochs: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><Label>Batch Size</Label><Input type="number" value={config.batch_size} onChange={e => setConfig({...config, batch_size: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><Label>LR</Label><Input type="number" step="1e-5" value={config.lr} onChange={e => setConfig({...config, lr: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><Label>Weight Decay</Label><Input type="number" step="1e-6" value={config.weight_decay} onChange={e => setConfig({...config, weight_decay: Number(e.target.value)})} /></div>
                    <div className="space-y-1"><Label>Seed</Label><Input type="number" value={config.seed} onChange={e => setConfig({...config, seed: Number(e.target.value)})} /></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={startMutation.isPending}>{startMutation.isPending ? 'Starting...' : 'Start'}</Button>
                    <Button type="button" variant="secondary" onClick={() => setShowStart(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </PanelBody>
          </Panel>

          {/* Model Versions */}
          <Panel>
            <PanelHeader title="Model Versions" />
            <PanelBody className="p-0">
              {modelsLoading ? (
                <div className="p-4 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <DataTable
                  columns={[
                    { key: 'version_id', header: 'Version', render: (row) => <span className="font-mono text-xs font-semibold">{row.version_id}</span> },
                    { key: 'approval_state', header: 'Approval', render: (row) => <Badge variant={row.approval_state === 'APPROVED' ? 'default' : row.approval_state === 'PENDING' ? 'secondary' : 'destructive'}>{row.approval_state}</Badge> },
                    { key: 'deployed', header: 'Deployed', align: 'center', render: (row) => <Badge variant={row.deployed ? 'default' : 'secondary'}>{row.deployed ? 'Yes' : 'No'}</Badge> },
                    { key: 'created_at', header: 'Created', render: (row) => <span className="font-mono text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span> },
                    { key: 'approved_at', header: 'Approved', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.approved_at ? new Date(row.approved_at).toLocaleString() : '—'}</span> },
                    { key: 'deployed_at', header: 'Deployed At', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.deployed_at ? new Date(row.deployed_at).toLocaleString() : '—'}</span> },
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
      </div>
    </PermissionGuard>
  );
}