import { IVoxShieldService } from './types';
import { CallSession, Incident, VoiceIdentity, SecurityPolicy, AuditLogEntry, DashboardMetrics } from '../../types/domain';
import { apiClient } from '../api/client';

export class ApiVoxShieldService implements IVoxShieldService {
  getDashboardMetrics(): Promise<DashboardMetrics> {
    return apiClient.get<DashboardMetrics>('/dashboard/summary');
  }

  getCallSessions(filters?: { riskState?: string }): Promise<CallSession[]> {
    const params = filters?.riskState ? `?risk_state=${encodeURIComponent(filters.riskState)}` : '';
    return apiClient.get<CallSession[]>(`/calls${params}`);
  }

  getCallSessionDetail(id: string): Promise<CallSession | null> {
    return apiClient.get<CallSession>(`/calls/${id}`);
  }

  getIncidents(filters?: { status?: string }): Promise<Incident[]> {
    const params = filters?.status ? `?status=${encodeURIComponent(filters.status)}` : '';
    return apiClient.get<Incident[]>(`/incidents${params}`);
  }

  getIncidentDetail(id: string): Promise<Incident | null> {
    return apiClient.get<Incident>(`/incidents/${id}`);
  }

  updateIncidentStatus(id: string, status: Incident['status']): Promise<Incident> {
    return apiClient.patch<Incident>(`/incidents/${id}`, { status });
  }

  getVoiceIdentities(): Promise<VoiceIdentity[]> {
    return apiClient.get<VoiceIdentity[]>('/identities');
  }

  getSecurityPolicies(): Promise<SecurityPolicy[]> {
    return apiClient.get<SecurityPolicy[]>('/policies');
  }

  toggleSecurityPolicy(id: string, enabled: boolean): Promise<SecurityPolicy> {
    return apiClient.patch<SecurityPolicy>(`/policies/${id}`, { enabled });
  }

  getAuditLogs(): Promise<AuditLogEntry[]> {
    return apiClient.get<AuditLogEntry[]>('/audit-logs');
  }
}
