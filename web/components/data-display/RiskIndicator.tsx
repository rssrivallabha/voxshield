"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getRiskConfig } from "@/types/risk";
import { Badge } from "@/components/ui/Badge";

interface RiskIndicatorProps {
  state: import("@/types/risk").RiskState;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  "shield-check": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  eye: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  "alert-triangle": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  "shield-alert": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  "octagon-alert": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  "user-x": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="10" cy="7" r="4" />
      <path d="M15.31 15.31A14.1 14.1 0 0 0 20 10c0-1.2-.2-2.37-.58-3.42" />
      <line x1="17" y1="17" x2="22" y2="22" />
      <line x1="22" y1="17" x2="17" y2="22" />
    </svg>
  ),
  "mic-off": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 17a5 5 0 0 0-10 0" />
      <path d="M9 17v-5a3 3 0 0 1 3-3" />
      <path d="M12 2v5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
};

const sizeClasses = {
  xs: { badge: "", icon: "h-3 w-3", text: "text-xs", gap: "gap-1" },
  sm: { badge: "", icon: "h-3.5 w-3.5", text: "text-sm", gap: "gap-1.5" },
  md: { badge: "", icon: "h-4 w-4", text: "text-base", gap: "gap-2" },
  lg: { badge: "", icon: "h-5 w-5", text: "text-lg", gap: "gap-2" },
};

export function RiskIndicator({ state, size = "md", showLabel = true, showIcon = true, className }: RiskIndicatorProps) {
  const config = getRiskConfig(state);
  const sizes = sizeClasses[size];

  return (
    <Badge
      variant="risk"
      riskState={state}
      className={cn(
        "flex items-center",
        sizes.gap,
        className
      )}
    >
      {showIcon && (
        <span className={cn("flex-shrink-0", sizes.icon)}>
          {iconMap[config.icon]}
        </span>
      )}
      {showLabel && <span className={cn("font-medium", sizes.text)}>{config.label}</span>}
    </Badge>
  );
}

interface RiskDotProps {
  state: import("@/types/risk").RiskState;
  size?: "xs" | "sm" | "md";
  className?: string;
  title?: string;
}

export function RiskDot({ state, size = "sm", className, title }: RiskDotProps) {
  const config = getRiskConfig(state);
  const dotSizes = { xs: "h-1.5 w-1.5", sm: "h-2.5 w-2.5", md: "h-3.5 w-3.5" };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        config.colorClass,
        dotSizes[size],
        className
      )}
      title={title || config.description}
      role="status"
      aria-label={`${config.label}: ${config.description}`}
    />
  );
}

interface RiskBannerProps {
  state: import("@/types/risk").RiskState;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function RiskBanner({ state, title, description, action, className }: RiskBannerProps) {
  const config = getRiskConfig(state);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        config.mutedClass,
        config.borderClass,
        "border-l-4",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className={cn("flex-shrink-0 mt-0.5", config.foregroundClass)}>
        {iconMap[config.icon]}
      </div>
      <div className="flex-1 min-w-0">
        {title && <p className={cn("font-medium", config.foregroundClass)}>{title}</p>}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0 mt-1">{action}</div>}
    </div>
  );
}