import { IVoxShieldService } from './types';
import { CallSession, Incident, VoiceIdentity, SecurityPolicy, AuditLogEntry, DashboardMetrics } from '../../types/domain';
import {
  MOCK_DASHBOARD_METRICS,
  MOCK_CALL_SESSIONS,
  MOCK_INCIDENTS,
  MOCK_IDENTITIES,
  MOCK_POLICIES,
  MOCK_AUDIT_LOGS,
} from '../../fixtures/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockVoxShieldService implements IVoxShieldService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    await delay(100);
    return { ...MOCK_DASHBOARD_METRICS };
  }

  async getCallSessions(filters?: { riskState?: string }): Promise<CallSession[]> {
    await delay(150);
    if (filters?.riskState) {
      return MOCK_CALL_SESSIONS.filter((c) => c.riskState === filters.riskState);
    }
    return [...MOCK_CALL_SESSIONS];
  }

  async getCallSessionDetail(id: string): Promise<CallSession | null> {
    await delay(100);
    const call = MOCK_CALL_SESSIONS.find((c) => c.id === id);
    return call ? { ...call } : null;
  }

  async getIncidents(filters?: { status?: string }): Promise<Incident[]> {
    await delay(150);
    if (filters?.status) {
      return MOCK_INCIDENTS.filter((i) => i.status === filters.status);
    }
    return [...MOCK_INCIDENTS];
  }

  async getIncidentDetail(id: string): Promise<Incident | null> {
    await delay(100);
    const inc = MOCK_INCIDENTS.find((i) => i.id === id);
    return inc ? { ...inc } : null;
  }

  async updateIncidentStatus(id: string, status: Incident['status']): Promise<Incident> {
    await delay(200);
    const inc = MOCK_INCIDENTS.find((i) => i.id === id);
    if (!inc) {
      throw new Error(`Incident ${id} not found`);
    }
    inc.status = status;
    inc.updatedAt = new Date().toISOString();
    return { ...inc };
  }

  async getVoiceIdentities(): Promise<VoiceIdentity[]> {
    await delay(150);
    return [...MOCK_IDENTITIES];
  }

  async getSecurityPolicies(): Promise<SecurityPolicy[]> {
    await delay(150);
    return [...MOCK_POLICIES];
  }

  async toggleSecurityPolicy(id: string, enabled: boolean): Promise<SecurityPolicy> {
    await delay(200);
    const pol = MOCK_POLICIES.find((p) => p.id === id);
    if (!pol) {
      throw new Error(`Policy ${id} not found`);
    }
    pol.enabled = enabled;
    pol.updatedAt = new Date().toISOString();
    return { ...pol };
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    await delay(150);
    return [...MOCK_AUDIT_LOGS];
  }
}
