"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils";
import { RiskDot } from "@/components/data-display/RiskIndicator";
import { ConfidenceMeter } from "@/components/data-display/ConfidenceIndicator";

interface TimelineEvent {
  id: string;
  timestamp: Date | string;
  type: string;
  title: string;
  description?: string;
  riskState?: import("@/types/risk").RiskState;
  confidence?: number;
  metadata?: Record<string, unknown>;
  isLive?: boolean;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  reverse?: boolean;
  showTime?: boolean;
  showConfidence?: boolean;
}

export function Timeline({ events, className, reverse = false, showTime = true, showConfidence = true }: TimelineProps) {
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return reverse ? tb - ta : ta - tb;
  });

  return (
    <div className={cn("space-y-4", className)} role="log" aria-label="Event timeline">
      {sorted.map((event, index) => (
        <TimelineEventItem key={event.id} event={event} index={index} showTime={showTime} showConfidence={showConfidence} />
      ))}
    </div>
  );
}

interface TimelineEventItemProps {
  event: TimelineEvent;
  index: number;
  showTime: boolean;
  showConfidence: boolean;
}

function TimelineEventItem({ event, index, showTime, showConfidence }: TimelineEventItemProps) {
  const isLast = index === 0;

  return (
    <div className="relative flex gap-3">
      <div className="relative flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            "z-10 w-2.5 h-2.5 rounded-full border-2 border-background",
            event.riskState ? "bg-current" : "bg-muted-foreground/30"
          )}
        />
        {!isLast && <div className="mt-1 h-full w-px bg-border" />}
      </div>
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-start gap-2">
          {showTime && (
            <span className="flex-shrink-0 font-mono text-xs text-muted-foreground whitespace-nowrap">
              {formatTimestamp(event.timestamp)}
            </span>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{event.title}</span>
              {event.type && (
                <span className="text-xs text-muted-foreground font-mono">{event.type}</span>
              )}
              {event.isLive && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-live-indicator" aria-hidden="true" />
                  Live
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground">{event.description}</p>
            )}
            {event.riskState && (
              <RiskDot state={event.riskState} size="sm" title={event.description} />
            )}
            {showConfidence && event.confidence !== undefined && (
              <ConfidenceMeter value={event.confidence} size="sm" />
            )}
            {event.metadata && (
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <span key={key} className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}