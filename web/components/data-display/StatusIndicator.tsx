"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "active" | "inactive" | "degraded" | "connecting" | "error";
  size?: "xs" | "sm" | "md";
  label?: string;
  className?: string;
  animate?: boolean;
}

const statusConfig = {
  active: { color: "bg-signal-active", label: "Active", animate: true },
  inactive: { color: "bg-signal-inactive", label: "Inactive", animate: false },
  degraded: { color: "bg-signal-degraded", label: "Degraded", animate: false },
  connecting: { color: "bg-primary", label: "Connecting…", animate: true },
  error: { color: "bg-destructive", label: "Error", animate: false },
};

const sizeClasses = {
  xs: { dot: "h-1.5 w-1.5", text: "text-xs", gap: "gap-1" },
  sm: { dot: "h-2 w-2", text: "text-sm", gap: "gap-1.5" },
  md: { dot: "h-2.5 w-2.5", text: "text-base", gap: "gap-2" },
};

export function StatusIndicator({ status, size = "sm", label, className, animate = true }: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizes = sizeClasses[size];
  const showPulse = animate && (status === "active" || status === "connecting");

  return (
    <span className={cn("inline-flex items-center", sizes.gap, className)}>
      <span
        className={cn(
          "rounded-full",
          config.color,
          sizes.dot,
          showPulse && "animate-live-indicator"
        )}
        aria-hidden="true"
      />
      {label && <span className={cn("font-medium", sizes.text)}>{label}</span>}
    </span>
  );
}

interface ConnectionStatusProps {
  status: "connected" | "connecting" | "disconnected" | "reconnecting" | "error";
  lastConnected?: Date | string;
  className?: string;
}

export function ConnectionStatus({ status, lastConnected, className }: ConnectionStatusProps) {
  const labels = {
    connected: "Connected",
    connecting: "Connecting…",
    disconnected: "Disconnected",
    reconnecting: "Reconnecting…",
    error: "Connection Error",
  };

  const statusMap = {
    connected: "active" as const,
    connecting: "connecting" as const,
    disconnected: "inactive" as const,
    reconnecting: "connecting" as const,
    error: "error" as const,
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StatusIndicator status={statusMap[status]} size="sm" label={labels[status]} />
      {lastConnected && status === "connected" && (
        <span className="text-xs text-muted-foreground">
          Last: {new Date(lastConnected).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}