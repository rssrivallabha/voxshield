"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "muted";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      asChild = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const baseStyles = "inline-flex items-center justify-center gap-2 font-medium transition-standard focus-visible-ring disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary",
      outline: "border border-input bg-transparent hover:bg-accent active:bg-accent",
      ghost: "bg-transparent hover:bg-accent active:bg-accent",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive",
      muted: "bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted",
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs",
      sm: "h-8 px-3 text-sm",
      md: "h-9 px-4 text-base",
      lg: "h-10 px-5 text-lg",
      icon: "h-9 w-9",
    };

    return (
      <Comp
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
        )}
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";
export { Button };