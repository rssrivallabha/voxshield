import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { voxShieldService } from '../services';
import { queryKeys } from '../api/queryKeys';
import { Incident } from '../../types/domain';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: queryKeys.dashboard.metrics,
    queryFn: () => voxShieldService.getDashboardMetrics(),
  });
}

export function useCallSessions(filters?: { riskState?: string }) {
  return useQuery({
    queryKey: queryKeys.calls.list(filters),
    queryFn: () => voxShieldService.getCallSessions(filters),
  });
}

export function useCallSessionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.calls.detail(id),
    queryFn: () => voxShieldService.getCallSessionDetail(id),
    enabled: Boolean(id),
  });
}

export function useIncidents(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.incidents.list(filters),
    queryFn: () => voxShieldService.getIncidents(filters),
  });
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Incident['status'] }) =>
      voxShieldService.updateIncidentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
    },
  });
}

export function useVoiceIdentities() {
  return useQuery({
    queryKey: queryKeys.identities.list(),
    queryFn: () => voxShieldService.getVoiceIdentities(),
  });
}

export function useSecurityPolicies() {
  return useQuery({
    queryKey: queryKeys.policies.list(),
    queryFn: () => voxShieldService.getSecurityPolicies(),
  });
}

export function useToggleSecurityPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      voxShieldService.toggleSecurityPolicy(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.all });
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: queryKeys.audit.list(),
    queryFn: () => voxShieldService.getAuditLogs(),
  });
}
