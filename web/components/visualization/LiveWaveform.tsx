'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface LiveWaveformProps {
  isPlaying?: boolean;
  hasAnomaly?: boolean;
  syntheticProbPct?: number;
  snrDb?: number;
  micAudioData?: Uint8Array | null;
  className?: string;
}

export function LiveWaveform({
  isPlaying = false,
  hasAnomaly = false,
  syntheticProbPct = 0,
  snrDb = 30,
  micAudioData = null,
  className,
}: LiveWaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Background grid line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      const numBars = 48;
      const barWidth = 3;
      const gap = (width - numBars * barWidth) / (numBars + 1);

      phase += isPlaying ? 0.08 : 0.01;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 4;

        if (micAudioData && micAudioData.length > 0) {
          const dataIndex = Math.floor((i / numBars) * micAudioData.length);
          const rawVal = micAudioData[dataIndex] || 0;
          barHeight = Math.max(4, (rawVal / 255) * (height - 12));
        } else if (isPlaying) {
          const baseSine = Math.sin(phase + i * 0.2) * 0.5 + 0.5;
          const noise = Math.sin(phase * 2 + i * 0.5) * 0.3;
          const amplitude = Math.max(0.1, Math.min(1, (snrDb / 35)));
          barHeight = 6 + (baseSine + noise) * (height * 0.45) * amplitude;

          // Anomaly distortion spike in center-right band
          if (hasAnomaly && i >= 20 && i <= 36) {
            const anomalySpike = Math.sin(phase * 4 + i) * 16;
            barHeight += Math.abs(anomalySpike) * (syntheticProbPct / 100);
          }
        } else {
          barHeight = 4 + Math.sin(i * 0.4) * 2;
        }

        barHeight = Math.min(height - 8, Math.max(4, barHeight));

        const x = gap + i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        const isAnomalyRegion = hasAnomaly && i >= 20 && i <= 36;

        ctx.fillStyle = isAnomalyRegion
          ? `rgba(239, 68, 68, ${0.7 + Math.sin(phase * 5) * 0.3})`
          : isPlaying
          ? 'rgba(59, 130, 246, 0.85)'
          : 'rgba(148, 163, 184, 0.3)';

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, hasAnomaly, syntheticProbPct, snrDb, micAudioData]);

  return (
    <div className={cn('relative rounded-lg border border-panel-border bg-panel-elevated p-3 overflow-hidden', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Live Waveform Spectral Feed</span>
          {hasAnomaly && (
            <span className="inline-flex items-center gap-1 rounded bg-risk-critical-muted px-1.5 py-0.5 text-[10px] font-mono text-risk-critical font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-risk-critical animate-ping" />
              ANOMALY REGION DETECTED
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{isPlaying ? '16kHz PCM • Stream Active' : 'Idle'}</span>
      </div>
      <canvas ref={canvasRef} width={420} height={48} className="w-full h-12 block" />
    </div>
  );
}
