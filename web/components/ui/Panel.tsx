"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-panel-border bg-panel shadow-panel overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  className,
  title,
  description,
  actions,
  icon,
}: {
  className?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-panel-border px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-t border-panel-border px-4 py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}