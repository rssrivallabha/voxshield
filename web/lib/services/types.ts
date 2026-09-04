import { CallSession, Incident, VoiceIdentity, SecurityPolicy, AuditLogEntry, DashboardMetrics } from '../../types/domain';

export interface IVoxShieldService {
  getDashboardMetrics(): Promise<DashboardMetrics>;
  getCallSessions(filters?: { riskState?: string }): Promise<CallSession[]>;
  getCallSessionDetail(id: string): Promise<CallSession | null>;
  getIncidents(filters?: { status?: string }): Promise<Incident[]>;
  getIncidentDetail(id: string): Promise<Incident | null>;
  updateIncidentStatus(id: string, status: Incident['status']): Promise<Incident>;
  getVoiceIdentities(): Promise<VoiceIdentity[]>;
  getSecurityPolicies(): Promise<SecurityPolicy[]>;
  toggleSecurityPolicy(id: string, enabled: boolean): Promise<SecurityPolicy>;
  getAuditLogs(): Promise<AuditLogEntry[]>;
}
