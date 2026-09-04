"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "muted" | "risk";
  riskState?: import("@/types/risk").RiskState;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", riskState, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      outline: "border border-input text-foreground",
      muted: "bg-muted text-muted-foreground",
      risk: riskState
        ? `bg-risk-${riskState.toLowerCase().replace("_", "-")} text-risk-${riskState.toLowerCase().replace("_", "-")}-foreground`
        : "bg-muted text-muted-foreground",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
          "transition-fast",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
export { Badge };