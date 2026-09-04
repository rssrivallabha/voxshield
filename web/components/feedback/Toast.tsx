"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id?: string;
  variant?: "default" | "destructive" | "success" | "warning" | "info";
  title: string;
  description?: string;
  action?: React.ReactNode;
  onClose: () => void;
  duration?: number;
}

const variantStyles = {
  default: "border-border",
  destructive: "border-destructive/30",
  success: "border-risk-trusted/30",
  warning: "border-risk-monitor/30",
  info: "border-primary/30",
};

const variantIcons = {
  default: (
    <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  destructive: (
    <svg className="h-5 w-5 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5 text-risk-trusted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-risk-monitor" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

export function Toast({ variant = "default", title, description, action, onClose, duration = 5000 }: ToastProps) {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 shadow-modal bg-background",
        "animate-in slide-in-from-right-full duration-200",
        variantStyles[variant]
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">{variantIcons[variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 mt-1">{action}</div>}
      <button
        onClick={onClose}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-fast"
        aria-label="Dismiss notification"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, "onClose">) => void;
  removeToast: (title: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, "onClose">) => {
    const id = Math.random().toString(36).slice(2);
    const newToast = { ...toast, id, onClose: () => {} };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[500] flex flex-col gap-2 w-80 max-w-[calc(100vw-1rem)]">
        {toasts.map((toast, index) => (
          <Toast
            key={toast.id || index}
            {...toast}
            onClose={() => removeToast(toast.id || "")}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}