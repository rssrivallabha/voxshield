"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DividerProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
  label?: string;
}

export function Divider({ className, orientation = "horizontal", label }: DividerProps) {
  if (orientation === "vertical") {
    return <div className={cn("w-px self-stretch bg-border", className)} aria-hidden="true" />;
  }

  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)} aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return <div className={cn("h-px w-full bg-border", className)} aria-hidden="true" />;
}