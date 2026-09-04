'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { RiskIndicator } from '@/components/data-display/RiskIndicator';
import { RiskState } from '@/types/risk';

interface EvidenceFusionPanelProps {
  syntheticPoints: number | null;
  speakerMismatchPoints: number | null;
  acousticAnomalyPoints: number | null;
  contextualPoints: number | null;
  fusedScore: number | null;
  riskState: RiskState;
  isMlAvailable?: boolean;
  riskExplanation?: string;
  className?: string;
}

export function EvidenceFusionPanel({
  syntheticPoints,
  speakerMismatchPoints,
  acousticAnomalyPoints,
  contextualPoints,
  fusedScore,
  riskState,
  isMlAvailable = true,
  riskExplanation,
  className,
}: EvidenceFusionPanelProps) {
  const [displayScore, setDisplayScore] = React.useState<number | null>(fusedScore);
  const displayScoreRef = React.useRef<number | null>(fusedScore);

  React.useEffect(() => {
    if (!isMlAvailable || fusedScore === null) {
      setDisplayScore(null);
      displayScoreRef.current = null;
      return;
    }

    const start = displayScoreRef.current !== null ? displayScoreRef.current : 0;
    const end = fusedScore;
    if (start === end) return;

    const duration = 800;
    const startTime = performance.now();

    const updateScore = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(start + (end - start) * progress);
      setDisplayScore(current);
      displayScoreRef.current = current;
      if (progress < 1) {
        requestAnimationFrame(updateScore);
      }
    };

    requestAnimationFrame(updateScore);
  }, [fusedScore, isMlAvailable]);

  const items = [
    {
      label: 'Synthetic Voice Probe',
      points: syntheticPoints,
      text: syntheticPoints !== null ? `+${syntheticPoints}` : 'AWAITING ML INFERENCE',
      key: 'synth',
    },
    {
      label: 'Speaker Embedding Mismatch',
      points: speakerMismatchPoints,
      text: speakerMismatchPoints !== null ? `+${speakerMismatchPoints}` : 'AWAITING ML INFERENCE',
      key: 'spk',
    },
    {
      label: 'Acoustic / Spectral Anomaly',
      points: acousticAnomalyPoints,
      text: acousticAnomalyPoints !== null ? `+${acousticAnomalyPoints}` : '+0 (Measured Local)',
      key: 'ac',
    },
    {
      label: 'Contextual & Behavioral Risk',
      points: contextualPoints,
      text: contextualPoints !== null ? `+${contextualPoints}` : '+0',
      key: 'ctx',
    },
  ];

  return (
    <div className={cn('rounded-lg border border-panel-border bg-panel p-4 space-y-4 shadow-panel', className)}>
      <div className="flex items-center justify-between border-b border-panel-border pb-3">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Multi-Signal Evidence Fusion</h3>
          <p className="text-sm font-semibold text-foreground">
            {isMlAvailable ? 'Fused Risk Assessment Engine' : 'Local Acoustic Signal Telemetry'}
          </p>
        </div>
        <RiskIndicator state={riskState} size="md" />
      </div>

      <div className="space-y-2 font-mono text-xs">
        {items.map((item) => {
          const isPending = item.points === null;
          const isHigh = !isPending && (item.points as number) > 0;

          return (
            <div
              key={item.key}
              className={cn(
                'flex items-center justify-between p-2.5 rounded border transition-standard',
                isPending
                  ? 'border-panel-border bg-panel-elevated/50 text-muted-foreground'
                  : isHigh
                  ? 'border-risk-high/30 bg-risk-high/5 text-foreground'
                  : 'border-panel-border bg-panel-elevated text-muted-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isPending ? 'bg-amber-500/50' : isHigh ? 'bg-risk-high animate-live-indicator' : 'bg-muted'
                  )}
                />
                {item.label}
              </span>
              <span
                className={cn(
                  'font-bold',
                  isPending ? 'text-amber-500/80 text-[10px]' : isHigh ? 'text-risk-high' : 'text-muted-foreground'
                )}
              >
                {item.text}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-panel-border flex flex-col gap-2 bg-panel-elevated p-3 rounded-lg border border-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
              {isMlAvailable ? 'Authoritative Aggregate' : 'Risk Engine Decision'}
            </span>
            <span className="text-xs font-bold text-foreground">Fused Risk Score</span>
          </div>
          <div className="text-right">
            {isMlAvailable && displayScore !== null ? (
              <>
                <span
                  className={cn(
                    'text-2xl font-mono font-black tracking-tight tabular-nums',
                    displayScore >= 80
                      ? 'text-risk-critical'
                      : displayScore >= 60
                      ? 'text-risk-high'
                      : displayScore >= 40
                      ? 'text-risk-suspicious'
                      : displayScore >= 20
                      ? 'text-risk-monitor'
                      : 'text-risk-trusted'
                  )}
                >
                  {displayScore}
                </span>
                <span className="text-xs text-muted-foreground font-mono"> / 100</span>
              </>
            ) : (
              <span className="text-xs font-mono font-bold text-risk-unverified bg-risk-unverified-muted px-2 py-1 rounded">
                UNVERIFIED
              </span>
            )}
          </div>
        </div>

        {riskExplanation && (
          <p className="text-[11px] text-muted-foreground leading-normal border-t border-panel-border/50 pt-2">
            {riskExplanation}
          </p>
        )}
      </div>
    </div>
  );
}
