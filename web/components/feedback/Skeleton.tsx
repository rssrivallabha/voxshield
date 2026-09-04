"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse-soft rounded bg-muted", className)}
      {...props}
    />
  );
}

interface SkeletonRowProps {
  lines?: number;
  className?: string;
  avatar?: boolean;
  action?: boolean;
}

export function SkeletonRow({ lines = 3, className, avatar = false, action = false }: SkeletonRowProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {avatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-1/2" />
        ))}
      </div>
      {action && <Skeleton className="h-8 w-20 rounded shrink-0" />}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-lg border border-panel-border bg-panel p-4 space-y-3", className)}>
      <SkeletonRow lines={2} avatar />
      <SkeletonRow lines={3} />
      <SkeletonRow lines={1} action />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, cols = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn("rounded-lg border border-panel-border bg-panel overflow-hidden", className)}>
      <div className="p-4 border-b border-panel-border">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-3/4" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-panel-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {Array.from({ length: cols }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-3/4" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}