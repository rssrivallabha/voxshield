"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const defaultIcon = (
  <svg className="h-12 w-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M9.17 16.17a2.25 2.25 0 0 1-3.18 0l-2.09-2.09a2.25 2.25 0 0 1 0-3.18l4.5-4.5a2.25 2.25 0 0 1 3.18 0l4.5 4.5a2.25 2.25 0 0 1 0 3.18l-4.5 4.5a2.25 2.25 0 0 1-3.18 0z" />
    <path d="M15.17 10.17a2.25 2.25 0 0 1-3.18 0l-4.5-4.5a2.25 2.25 0 0 1 0-3.18l4.5-4.5a2.25 2.25 0 0 1 3.18 0l4.5 4.5a2.25 2.25 0 0 1 0 3.18l-4.5 4.5a2.25 2.25 0 0 1-3.18 0z" />
  </svg>
);

export function EmptyState({ icon = defaultIcon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-8 text-center", className)}>
      <div className="flex-shrink-0" aria-hidden="true">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function LoadingState({ size = "md", label, className }: LoadingStateProps) {
  const spinnerSizes = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };
  const labelSizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <svg
        className={cn("animate-spin text-primary", spinnerSizes[size])}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className={cn("text-muted-foreground", labelSizes[size])}>{label}</span>}
    </div>
  );
}

interface InlineLoadingProps {
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function InlineLoading({ size = "sm", className }: InlineLoadingProps) {
  const sizes = { xs: "h-3 w-3", sm: "h-4 w-4", md: "h-5 w-5" };
  return (
    <svg
      className={cn("animate-spin text-primary", sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

interface ErrorStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const defaultErrorIcon = (
  <svg className="h-12 w-12 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export function ErrorState({ title, description, icon = defaultErrorIcon, action, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-8 text-center", className)} role="alert">
      <div className="flex-shrink-0" aria-hidden="true">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}