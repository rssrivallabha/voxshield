"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RiskDot } from "@/components/data-display/RiskIndicator";
import { ConfidenceMeter } from "@/components/data-display/ConfidenceIndicator";

interface EvidenceItemProps {
  id: string;
  source: string;
  label: string;
  value: string | number;
  confidence?: number;
  riskState?: import("@/types/risk").RiskState;
  status?: "verified" | "pending" | "failed" | "unavailable";
  metadata?: Record<string, unknown>;
  className?: string;
}

const statusIcons = {
  verified: (
    <svg className="h-4 w-4 text-risk-trusted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  pending: (
    <svg className="h-4 w-4 text-primary animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
    </svg>
  ),
  failed: (
    <svg className="h-4 w-4 text-risk-critical" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  unavailable: (
    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
};

export function EvidenceItem({ id, source, label, value, confidence, riskState, status = "pending", metadata, className }: EvidenceItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-panel-border bg-panel p-3 transition-standard",
        "hover:border-border hover:bg-panel-elevated",
        className
      )}
      data-evidence-id={id}
    >
      <div className="flex-shrink-0 w-10 text-center text-muted-foreground">
        {statusIcons[status]}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{source}</span>
          <span className="font-medium text-foreground truncate">{label}</span>
          {riskState && <RiskDot state={riskState} size="xs" />}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="font-mono text-foreground tabular-nums">{value}</span>
          {confidence !== undefined && <ConfidenceMeter value={confidence} size="sm" />}
        </div>
        {metadata && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(metadata).map(([key, val]) => (
              <span key={key} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                {key}: {String(val)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EvidenceListProps {
  items: EvidenceItemProps[];
  className?: string;
  emptyMessage?: string;
}

export function EvidenceList({ items, className, emptyMessage = "No evidence available" }: EvidenceListProps) {
  if (items.length === 0) {
    return (
      <div className={cn("rounded-lg border border-panel-border bg-panel p-8 text-center", className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} role="list" aria-label="Evidence items">
      {items.map((item) => (
        <EvidenceItem key={item.id} {...item} />
      ))}
    </div>
  );
}