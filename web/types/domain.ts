import { RiskState, ConfidenceLevel } from './risk';

export interface EvidenceItemData {
  id: string;
  type: string;
  source: string;
  description: string;
  confidence: number;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CallSession {
  id: string;
  callerId: string;
  targetChannel: string;
  startTime: string;
  durationMs: number;
  riskState: RiskState;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  snrDb: number;
  packetLossPct: number;
  latencyMs: number;
  evidence: EvidenceItemData[];
}

export interface Incident {
  id: string;
  callSessionId: string;
  callerId: string;
  riskState: RiskState;
  assignedAnalyst?: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  updatedAt: string;
  summary: string;
  evidenceCount: number;
}

export interface VoiceIdentity {
    id: string;
    name: string;
    accountRef: string;
    enrolledAt: string;
    lastVerifiedAt: string;
    status: 'ENROLLED' | 'PENDING' | 'REVOKED' | 'FLAGGED';
    confidenceScore: number;
    totalCalls: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  riskThreshold: RiskState;
  action: 'MONITOR' | 'CHALLENGE_2FA' | 'ROUTE_TO_HUMAN' | 'TERMINATE_CALL';
  enabled: boolean;
  channelFilter: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  targetResource: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ipAddress: string;
  details: string;
}

export interface DashboardMetrics {
  activeCallsCount: number;
  monitoredCallsCount: number;
  suspiciousCallsCount: number;
  threatIncidents24h: number;
  avgLatencyMs: number;
  systemStatus: {
    voiceGateway: 'active' | 'degraded' | 'offline';
    analysisEngine: 'active' | 'degraded' | 'offline';
    speakerVerification: 'active' | 'degraded' | 'offline';
    policyEngine: 'active' | 'degraded' | 'offline';
  };
}
