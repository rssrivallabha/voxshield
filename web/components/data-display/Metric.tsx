"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MetricProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  icon?: React.ReactNode;
  className?: string;
  description?: string;
}

export function Metric({ label, value, trend, icon, className, description }: MetricProps) {
  return (
    <div className={cn("rounded-lg border border-panel-border bg-panel p-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={cn("text-xs font-medium", trend.value >= 0 ? "text-risk-trusted" : "text-risk-high")}>
            {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

interface MetricGridProps {
  metrics: Array<{
    label: string;
    value: string | number;
    trend?: { value: number; label: string };
    icon?: React.ReactNode;
    description?: string;
  }>;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ metrics, columns = 4, className }: MetricGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", 4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" }[columns],
        className
      )}
    >
      {metrics.map((m, i) => (
        <Metric key={i} {...m} />
      ))}
    </div>
  );
}