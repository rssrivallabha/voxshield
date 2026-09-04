import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        panel: {
          DEFAULT: "hsl(var(--panel))",
          border: "hsl(var(--panel-border))",
          elevated: "hsl(var(--panel-elevated))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          muted: "hsl(var(--primary-muted))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        risk: {
          trusted: {
            DEFAULT: "hsl(var(--risk-trusted))",
            foreground: "hsl(var(--risk-trusted-foreground))",
            muted: "hsl(var(--risk-trusted-muted))",
          },
          monitor: {
            DEFAULT: "hsl(var(--risk-monitor))",
            foreground: "hsl(var(--risk-monitor-foreground))",
            muted: "hsl(var(--risk-monitor-muted))",
          },
          suspicious: {
            DEFAULT: "hsl(var(--risk-suspicious))",
            foreground: "hsl(var(--risk-suspicious-foreground))",
            muted: "hsl(var(--risk-suspicious-muted))",
          },
          high: {
            DEFAULT: "hsl(var(--risk-high))",
            foreground: "hsl(var(--risk-high-foreground))",
            muted: "hsl(var(--risk-high-muted))",
          },
          critical: {
            DEFAULT: "hsl(var(--risk-critical))",
            foreground: "hsl(var(--risk-critical-foreground))",
            muted: "hsl(var(--risk-critical-muted))",
          },
          unverified: {
            DEFAULT: "hsl(var(--risk-unverified))",
            foreground: "hsl(var(--risk-unverified-foreground))",
            muted: "hsl(var(--risk-unverified-muted))",
          },
          insufficient: {
            DEFAULT: "hsl(var(--risk-insufficient))",
            foreground: "hsl(var(--risk-insufficient-foreground))",
            muted: "hsl(var(--risk-insufficient-muted))",
          },
        },
        confidence: {
          high: "hsl(var(--confidence-high))",
          medium: "hsl(var(--confidence-medium))",
          low: "hsl(var(--confidence-low))",
        },
        signal: {
          active: "hsl(var(--signal-active))",
          inactive: "hsl(var(--signal-inactive))",
          degraded: "hsl(var(--signal-degraded))",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      fontSize: {
        xs: ["0.7rem", { lineHeight: "1.4" }],
        sm: ["0.8125rem", { lineHeight: "1.5" }],
        base: ["0.9375rem", { lineHeight: "1.55" }],
        lg: ["1.0625rem", { lineHeight: "1.5" }],
        xl: ["1.25rem", { lineHeight: "1.4" }],
        "2xl": ["1.5rem", { lineHeight: "1.3" }],
        "3xl": ["1.875rem", { lineHeight: "1.25" }],
        "4xl": ["2.25rem", { lineHeight: "1.2" }],
      },
      spacing: {
        0: "0",
        1: "0.25rem",
        2: "0.5rem",
        3: "0.75rem",
        4: "1rem",
        5: "1.25rem",
        6: "1.5rem",
        8: "2rem",
        10: "2.5rem",
        12: "3rem",
        16: "4rem",
        20: "5rem",
        24: "6rem",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        elevated: "var(--shadow-elevated)",
        modal: "var(--shadow-modal)",
        focus: "var(--shadow-focus)",
        inner: "var(--shadow-inner)",
      },
      transitionDuration: {
        fast: "100ms",
        normal: "200ms",
        slow: "300ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        emphasize: "cubic-bezier(0.2, 0, 0, 1)",
      },
      zIndex: {
        dropdown: "100",
        sticky: "200",
        modal: "300",
        popover: "400",
        tooltip: "500",
      },
    },
  },
  plugins: [],
};
export default config;