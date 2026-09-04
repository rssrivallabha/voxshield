export type RiskState =
  | "TRUSTED"
  | "MONITOR"
  | "SUSPICIOUS"
  | "HIGH_RISK"
  | "CRITICAL"
  | "UNVERIFIED"
  | "INSUFFICIENT_EVIDENCE";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type SignalStatus = "ACTIVE" | "INACTIVE" | "DEGRADED";

export interface RiskStateConfig {
  state: RiskState;
  label: string;
  description: string;
  icon: string;
  colorClass: string;
  foregroundClass: string;
  mutedClass: string;
  borderClass: string;
  priority: number;
}

export const RISK_STATE_CONFIGS: Record<RiskState, RiskStateConfig> = {
  TRUSTED: {
    state: "TRUSTED",
    label: "Trusted",
    description: "Voice integrity verified; no anomalies detected",
    icon: "shield-check",
    colorClass: "bg-risk-trusted",
    foregroundClass: "text-risk-trusted-foreground",
    mutedClass: "bg-risk-trusted-muted",
    borderClass: "border-risk-trusted",
    priority: 0,
  },
  MONITOR: {
    state: "MONITOR",
    label: "Monitor",
    description: "Minor anomalies; elevated attention recommended",
    icon: "eye",
    colorClass: "bg-risk-monitor",
    foregroundClass: "text-risk-monitor-foreground",
    mutedClass: "bg-risk-monitor-muted",
    borderClass: "border-risk-monitor",
    priority: 1,
  },
  SUSPICIOUS: {
    state: "SUSPICIOUS",
    label: "Suspicious",
    description: "Significant anomalies; synthetic speech indicators present",
    icon: "alert-triangle",
    colorClass: "bg-risk-suspicious",
    foregroundClass: "text-risk-suspicious-foreground",
    mutedClass: "bg-risk-suspicious-muted",
    borderClass: "border-risk-suspicious",
    priority: 2,
  },
  HIGH_RISK: {
    state: "HIGH_RISK",
    label: "High Risk",
    description: "Strong evidence of manipulation; verification required",
    icon: "shield-alert",
    colorClass: "bg-risk-high",
    foregroundClass: "text-risk-high-foreground",
    mutedClass: "bg-risk-high-muted",
    borderClass: "border-risk-high",
    priority: 3,
  },
  CRITICAL: {
    state: "CRITICAL",
    label: "Critical",
    description: "Confirmed impersonation indicators; immediate action required",
    icon: "octagon-alert",
    colorClass: "bg-risk-critical",
    foregroundClass: "text-risk-critical-foreground",
    mutedClass: "bg-risk-critical-muted",
    borderClass: "border-risk-critical",
    priority: 4,
  },
  UNVERIFIED: {
    state: "UNVERIFIED",
    label: "Unverified",
    description: "No enrolled voice profile; identity cannot be verified",
    icon: "user-x",
    colorClass: "bg-risk-unverified",
    foregroundClass: "text-risk-unverified-foreground",
    mutedClass: "bg-risk-unverified-muted",
    borderClass: "border-risk-unverified",
    priority: 5,
  },
  INSUFFICIENT_EVIDENCE: {
    state: "INSUFFICIENT_EVIDENCE",
    label: "Insufficient Evidence",
    description: "Audio quality insufficient for reliable analysis",
    icon: "mic-off",
    colorClass: "bg-risk-insufficient",
    foregroundClass: "text-risk-insufficient-foreground",
    mutedClass: "bg-risk-insufficient-muted",
    borderClass: "border-risk-insufficient",
    priority: 6,
  },
};

export function getRiskConfig(state: RiskState): RiskStateConfig {
  return RISK_STATE_CONFIGS[state];
}

export function compareRisk(a: RiskState, b: RiskState): number {
  return RISK_STATE_CONFIGS[a].priority - RISK_STATE_CONFIGS[b].priority;
}

export const CONFIDENCE_CONFIGS: Record<ConfidenceLevel, { label: string; colorClass: string }> = {
  HIGH: { label: "High", colorClass: "text-confidence-high" },
  MEDIUM: { label: "Medium", colorClass: "text-confidence-medium" },
  LOW: { label: "Low", colorClass: "text-confidence-low" },
};

export const SIGNAL_STATUS_CONFIGS: Record<SignalStatus, { label: string; colorClass: string }> = {
  ACTIVE: { label: "Active", colorClass: "text-signal-active" },
  INACTIVE: { label: "Inactive", colorClass: "text-signal-inactive" },
  DEGRADED: { label: "Degraded", colorClass: "text-signal-degraded" },
};