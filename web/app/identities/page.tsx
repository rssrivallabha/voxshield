'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { DataTable } from '@/components/data-display/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useVoiceIdentities } from '@/lib/hooks/useQueries';
import { users } from '@/lib/icons';
import { formatDateTime } from '@/lib/utils';
import { VoiceIdentity } from '@/types/domain';

export default function IdentitiesPage() {
  const { data: identities = [], isLoading } = useVoiceIdentities();

  return (
    <PermissionGuard permission="identities:read">
      <div className="space-y-6">
        <PageHeader
          title="Identity & Voice Profiles"
          description="Manage enrolled speaker profiles and liveness biometric metadata"
        />
        <Panel>
          <PanelHeader
            title="Enrolled Identities"
            description="Verified executive and personnel voice profiles"
            icon={users({ className: 'h-4 w-4' })}
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
                  { key: 'id', header: 'Identity ID', render: (row) => <span className="font-mono text-xs text-foreground font-semibold">{row.id}</span> },
                  { key: 'name', header: 'Enrolled Person' },
                  { key: 'accountRef', header: 'Account Ref', render: (row) => <span className="font-mono text-xs">{row.accountRef}</span> },
                  {
                    key: 'status',
                    header: 'Voiceprint Status',
                    render: (row) => {
                      const variantMap: Record<VoiceIdentity['status'], 'default' | 'secondary' | 'muted' | 'destructive'> = {
                        ENROLLED: 'default',
                        PENDING: 'secondary',
                        REVOKED: 'muted',
                        FLAGGED: 'destructive',
                      };
                      return <Badge variant={variantMap[row.status]}>{row.status}</Badge>;
                    },
                  },
                  {
                    key: 'confidenceScore',
                    header: 'Match Score',
                    align: 'center',
                    render: (row) => <span className="font-mono text-sm">{Math.round(row.confidenceScore * 100)}%</span>,
                  },
                  { key: 'totalCalls', header: 'Verified Calls', align: 'center' },
                  {
                    key: 'lastVerifiedAt',
                    header: 'Last Verified',
                    render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.lastVerifiedAt ? formatDateTime(row.lastVerifiedAt) : '-'}</span>,
                  },
                ]}
                data={identities}
                keyExtractor={(row) => row.id}
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PermissionGuard>
  );
}
