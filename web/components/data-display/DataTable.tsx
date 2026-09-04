"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  columns: Array<{
    key: string;
    header: string;
    render?: (row: T, index: number) => React.ReactNode;
    className?: string;
    headerClassName?: string;
    width?: string;
    align?: "left" | "center" | "right";
  }>;
  data: T[];
  keyExtractor: (row: T) => string;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  rowClassName,
  onRowClick,
  emptyMessage = "No data available",
  striped = true,
  hoverable = true,
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-panel-border bg-panel overflow-hidden", className)}>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-panel-border bg-panel overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm" role="grid">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-left font-medium text-muted-foreground",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.headerClassName
                  )}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border">
            {data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row, index)}
                className={cn(
                  "transition-fast",
                  hoverable && "hover:bg-muted/30",
                  onRowClick && "cursor-pointer",
                  striped && index % 2 === 1 && "bg-muted/30",
                  rowClassName?.(row, index)
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2.5",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.className
                    )}
                  >
                    {col.render ? col.render(row, index) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface DataTableHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

export function DataTableHeader({ title, count, action }: DataTableHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {count !== undefined && (
          <p className="text-xs text-muted-foreground">{count} {count === 1 ? "item" : "items"}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}