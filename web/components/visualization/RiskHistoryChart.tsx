'use client';

import * as React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

interface RiskHistoryChartProps {
  history: Array<{ timeSeconds: number; fusedRiskScore: number; riskState: string }>;
  className?: string;
}

export function RiskHistoryChart({ history, className }: RiskHistoryChartProps) {
  const formattedData = history.map((item) => ({
    time: `T+${item.timeSeconds}s`,
    score: item.fusedRiskScore,
    state: item.riskState,
  }));

  return (
    <div className={cn('rounded-lg border border-panel-border bg-panel p-4 space-y-3 shadow-panel', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Telemetry Time-Series</h3>
          <p className="text-sm font-semibold text-foreground">Risk Trajectory Over Session</p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-panel-elevated text-muted-foreground border border-panel-border">
          {history.length} Telemetry Frame{history.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="h-36 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
            <YAxis domain={[0, 110]} stroke="#64748b" fontSize={10} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded border border-panel-border bg-panel-elevated p-2 text-xs font-mono shadow-md">
                      <p className="text-foreground font-bold">{data.time}</p>
                      <p className="text-primary">Fused Risk: {data.score}</p>
                      <p className="text-muted-foreground uppercase">{data.state}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'CRITICAL', fill: '#ef4444', fontSize: 9 }} />
            <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'HIGH RISK', fill: '#f59e0b', fontSize: 9 }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6, fill: '#ef4444' }}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
