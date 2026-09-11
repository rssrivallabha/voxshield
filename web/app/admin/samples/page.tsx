'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { upload as UploadIcon } from '@/lib/icons';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/data-display/DataTable';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatDateTime } from '@/lib/utils';

interface Sample {
  sample_id: string;
  original_filename: string;
  generated_reference_name: string;
  custom_display_name: string | null;
  admin_label: 'HUMAN' | 'AI';
  model_prediction: string | null;
  model_version_used_for_inference: string | null;
  raw_synthetic_probability: number | null;
  uploader_id: string;
  uploaded_at: string;
  duration_sec: number;
  sample_rate: number;
  channels: number;
  preprocessing_status: string;
  dataset_version: number;
  included_in_training: number;
  production_identity_id: string | null;
}

export default function AdminSamplesPage() {
  const queryClient = useQueryClient();

  const { data: samples = [], isLoading } = useQuery<Sample[]>({
    queryKey: ['admin', 'samples'],
    queryFn: () => apiClient.get<Sample[]>('/admin/samples'),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<Sample>('/admin/samples/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'samples'] }),
  });

  const [showUpload, setShowUpload] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [label, setLabel] = React.useState<'HUMAN' | 'AI'>('HUMAN');
  const [customName, setCustomName] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('admin_label', label);
    if (customName) fd.append('custom_display_name', customName);
    await uploadMutation.mutateAsync(fd);
    setShowUpload(false);
    setFile(null);
    setCustomName('');
  };

  return (
    <PermissionGuard permission="settings:manage">
      <div className="space-y-6">
        <PageHeader
          title="Admin Voice Samples"
          description="Manage labeled audio samples for training and reference"
        />
        <div className="flex items-center justify-between">
          <Button onClick={() => setShowUpload(true)} variant="primary" size="sm" disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Uploading...' : <><UploadIcon className="h-4 w-4 mr-1"/> Upload Sample</>}
          </Button>
        </div>

        {showUpload && (
          <Panel className="mb-4">
            <PanelHeader title="Upload Audio Sample" />
            <PanelBody>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="audioFile">Audio File (WAV, FLAC, OGG, MP3)</Label>
                  <Input id="audioFile" type="file" accept=".wav,.flac,.ogg,.mp3" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="label" value="HUMAN" checked={label === 'HUMAN'} onChange={() => setLabel('HUMAN')} />
                      <span>HUMAN</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="label" value="AI" checked={label === 'AI'} onChange={() => setLabel('AI')} />
                      <span>AI</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customName">Custom Display Name (optional)</Label>
                  <Input id="customName" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. CEO Voice" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={uploadMutation.isPending || !file}>
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => { setShowUpload(false); setFile(null); setCustomName(''); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </PanelBody>
          </Panel>
        )}

        <Panel>
          <PanelHeader title="Samples" />
          <PanelBody className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'generated_reference_name', header: 'Reference Name', render: (row) => <span className="font-mono text-xs font-semibold">{row.generated_reference_name}</span> },
                  { key: 'original_filename', header: 'Original Filename' },
                  { key: 'admin_label', header: 'Ground Truth', render: (row) => <Badge variant={row.admin_label === 'AI' ? 'destructive' : 'default'}>{row.admin_label}</Badge> },
                  { key: 'model_prediction', header: 'Model Prediction', render: (row) => <Badge variant={row.model_prediction === 'AI' ? 'destructive' : 'default'}>{row.model_prediction ?? '—'}</Badge> },
                  { key: 'raw_synthetic_probability', header: 'Raw Prob', render: (row) => <span className="font-mono text-xs">{row.raw_synthetic_probability !== null ? (row.raw_synthetic_probability * 100).toFixed(1) + '%' : '—'}</span> },
                  { key: 'duration_sec', header: 'Duration (s)', align: 'center', render: (row) => <span className="font-mono text-xs">{row.duration_sec.toFixed(1)}</span> },
                  { key: 'preprocessing_status', header: 'Status', render: (row) => <Badge variant={row.preprocessing_status === 'COMPLETED' ? 'default' : 'secondary'}>{row.preprocessing_status}</Badge> },
                  { key: 'included_in_training', header: 'In Training', align: 'center', render: (row) => <Badge variant={row.included_in_training ? 'default' : 'secondary'}>{row.included_in_training ? 'Yes' : 'No'}</Badge> },
                  { key: 'uploaded_at', header: 'Uploaded', render: (row) => <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.uploaded_at)}</span> },
                ]}
                data={samples}
                keyExtractor={(row) => row.sample_id}
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}