"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AudioQualityIndicatorProps {
  score?: number;
  status?: "PASS" | "WARN" | "FAIL" | "INSUFFICIENT" | "UNKNOWN";
  flags?: string[];
  className?: string;
}

export function AudioQualityIndicator({ score, status = "UNKNOWN", flags = [], className }: AudioQualityIndicatorProps) {
  const displayScore = score !== undefined ? Math.max(0, Math.min(100, score)) : 0;

  const getColor = (s: string) => {
    switch (s) {
      case "PASS":
        return "bg-confidence-high";
      case "WARN":
        return "bg-confidence-medium";
      case "FAIL":
      case "INSUFFICIENT":
        return "bg-risk-critical";
      default:
        return "bg-muted";
    }
  };

  const getLabel = (s: string) => {
    switch (s) {
      case "PASS": return "Adequate";
      case "WARN": return "Marginal";
      case "FAIL": return "Degraded";
      case "INSUFFICIENT": return "Insufficient";
      default: return "Unknown";
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)} role="status">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-standard", getColor(status))}
          style={{ width: `${displayScore}%` }}
        />
      </div>
      <span className="font-mono text-sm text-foreground">{displayScore.toFixed(0)}%</span>
      <span className={cn("text-xs font-medium", getColor(status) === "bg-confidence-high" ? "text-confidence-high" : getColor(status) === "bg-confidence-medium" ? "text-confidence-medium" : "text-muted-foreground")}>
        {getLabel(status)}
      </span>
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {flags.map((flag) => (
            <span key={flag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}