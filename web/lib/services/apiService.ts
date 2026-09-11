import { IVoxShieldService } from './types';
import { CallSession, Incident, VoiceIdentity, SecurityPolicy, AuditLogEntry, DashboardMetrics } from '../../types/domain';
import { apiClient } from '../api/client';

export class ApiVoxShieldService implements IVoxShieldService {
    getVoiceIdentities(): Promise<VoiceIdentity[]> {
        return apiClient.get<VoiceIdentity[]>('/identities');
    }

    createVoiceIdentity(identity: { name: string; description: string; enrollment_audio_duration_s: number }): Promise<VoiceIdentity> {
        return apiClient.post<VoiceIdentity>('/identities', identity);
    }

    enrollVoiceIdentity(identityId: string, audioData: { audio_samples: number[]; sample_rate: number }): Promise<unknown> {
        return apiClient.post<unknown>(`/identities/${identityId}/enroll`, audioData);
    }

    getIdentityStatus(identityId: string): Promise<unknown> {
        return apiClient.get<unknown>(`/identities/${identityId}/status`);
    }

    deleteVoiceIdentity(identityId: string): Promise<unknown> {
        return apiClient.delete<unknown>(`/identities/${identityId}`);
    }
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
