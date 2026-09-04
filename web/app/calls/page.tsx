'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { DataTable } from '@/components/data-display/DataTable';
import { RiskIndicator } from '@/components/data-display/RiskIndicator';
import { ConfidenceIndicator } from '@/components/data-display/ConfidenceIndicator';
import { AudioQualityIndicator } from '@/components/data-display/AudioQualityIndicator';
import { EvidenceItem } from '@/components/data-display/EvidenceItem';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useCallSessions } from '@/lib/hooks/useQueries';
import { useUiStore } from '@/lib/stores/useUiStore';
import { phone } from '@/lib/icons';
import { RiskState } from '@/types/risk';
import { formatDuration } from '@/lib/utils';

export default function CallsPage() {
  const { data: calls = [], isLoading } = useCallSessions();
  const { selectedCallId, setSelectedCallId } = useUiStore();

  const activeCall = calls.find((c) => c.id === selectedCallId) || calls[0];

  return (
    <PermissionGuard permission="calls:read">
      <div className="space-y-6">
        <PageHeader
          title="Secure Call Operations"
          description="Monitor, analyze, and inspect voice interactions in real time"
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Panel>
              <PanelHeader
                title="Voice Sessions"
                description="Active and recent voice calls under analysis"
                icon={phone({ className: 'h-4 w-4' })}
              />
              <PanelBody className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'id', header: 'Session ID', render: (row) => <span className="font-mono text-xs text-foreground">{row.id}</span> },
                      { key: 'callerId', header: 'Caller ID' },
                      { key: 'targetChannel', header: 'Channel' },
                      {
                        key: 'durationMs',
                        header: 'Duration',
                        align: 'center',
                        render: (row) => <span className="font-mono text-xs">{formatDuration(row.durationMs)}</span>,
                      },
                      {
                        key: 'riskState',
                        header: 'Risk State',
                        render: (row) => <RiskIndicator state={row.riskState as RiskState} size="sm" />,
                      },
                      {
                        key: 'confidence',
                        header: 'Confidence',
                        align: 'center',
                        render: (row) => <ConfidenceIndicator level={row.confidence} value={Math.round(row.confidenceScore * 100)} />,
                      },
                    ]}
                    data={calls}
                    keyExtractor={(row) => row.id}
                    onRowClick={(row) => setSelectedCallId(row.id)}
                    rowClassName={(row) =>
                      row.id === activeCall?.id
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : row.riskState === 'CRITICAL'
                        ? 'bg-risk-critical/5'
                        : row.riskState === 'HIGH_RISK'
                        ? 'bg-risk-high/5'
                        : ''
                    }
                  />
                )}
              </PanelBody>
            </Panel>
          </div>

          <div>
            <Panel>
              <PanelHeader
                title="Session Inspector"
                description={activeCall ? `Details for ${activeCall.id}` : 'Select a call session'}
                icon={phone({ className: 'h-4 w-4' })}
              />
              <PanelBody className="space-y-4">
                {activeCall ? (
                  <>
                    <div className="p-3 rounded-lg border border-panel-border bg-panel-elevated space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">Risk Level</span>
                        <RiskIndicator state={activeCall.riskState} size="sm" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">Confidence</span>
                        <ConfidenceIndicator level={activeCall.confidence} value={Math.round(activeCall.confidenceScore * 100)} />
                      </div>
                      <div className="pt-2 border-t border-panel-border">
                        <AudioQualityIndicator
                          score={Math.min(100, Math.round(activeCall.snrDb * 3))}
                          status={activeCall.snrDb > 20 ? 'PASS' : activeCall.snrDb > 15 ? 'WARN' : 'INSUFFICIENT'}
                          flags={[`SNR: ${activeCall.snrDb}dB`, `Loss: ${activeCall.packetLossPct}%`]}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Evidence Telemetry</h4>
                      {activeCall.evidence.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3 border border-panel-border rounded-lg bg-panel-elevated">
                          No anomalous signals or manipulation detected on this session.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {activeCall.evidence.map((ev) => (
                            <EvidenceItem
                              key={ev.id}
                              id={ev.id}
                              source={ev.source}
                              label={ev.type}
                              value={ev.description}
                              confidence={Math.round(ev.confidence * 100)}
                              status={ev.severity === 'high' || ev.severity === 'critical' ? 'failed' : 'pending'}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Select a call session from the table to view real-time evidence telemetry.</p>
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
