"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  level: "HIGH" | "MEDIUM" | "LOW";
  value?: number;
  className?: string;
}

const config = {
  HIGH: { label: "High", color: "text-confidence-high", bar: "bg-confidence-high" },
  MEDIUM: { label: "Medium", color: "text-confidence-medium", bar: "bg-confidence-medium" },
  LOW: { label: "Low", color: "text-confidence-low", bar: "bg-confidence-low" },
};

export function ConfidenceIndicator({ level, value, className }: ConfidenceIndicatorProps) {
  const cfg = config[level];
  const pct = value !== undefined ? value : level === "HIGH" ? 90 : level === "MEDIUM" ? 50 : 20;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-standard", cfg.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
    </div>
  );
}

interface ConfidenceMeterProps {
  value: number;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceMeter({ value, label, size = "md", className }: ConfidenceMeterProps) {
  const clamp = Math.max(0, Math.min(100, value));
  const barColor =
    clamp >= 70 ? "bg-confidence-high" : clamp >= 40 ? "bg-confidence-medium" : "bg-confidence-low";
  const barSize = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="font-mono text-sm text-foreground">{clamp.toFixed(0)}%</span>
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", barSize)} role="progressbar" aria-valuenow={clamp} aria-valuemin={0} aria-valuemax={100} aria-label={label || "Confidence"}>
        <div
          className={cn("h-full rounded-full transition-standard", barColor)}
          style={{ width: `${clamp}%` }}
        />
      </div>
    </div>
  );
}