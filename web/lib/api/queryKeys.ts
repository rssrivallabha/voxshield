export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  dashboard: {
    summary: ['dashboard', 'summary'] as const,
    metrics: ['dashboard', 'metrics'] as const,
    activeCalls: ['dashboard', 'active-calls'] as const,
  },
  calls: {
    all: ['calls'] as const,
    list: (filters?: Record<string, unknown>) => ['calls', 'list', filters] as const,
    detail: (id: string) => ['calls', 'detail', id] as const,
    evidence: (id: string) => ['calls', 'evidence', id] as const,
  },
  incidents: {
    all: ['incidents'] as const,
    list: (filters?: Record<string, unknown>) => ['incidents', 'list', filters] as const,
    detail: (id: string) => ['incidents', 'detail', id] as const,
  },
  identities: {
    all: ['identities'] as const,
    list: (filters?: Record<string, unknown>) => ['identities', 'list', filters] as const,
    detail: (id: string) => ['identities', 'detail', id] as const,
  },
  policies: {
    all: ['policies'] as const,
    list: () => ['policies', 'list'] as const,
    detail: (id: string) => ['policies', 'detail', id] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (filters?: Record<string, unknown>) => ['audit', 'list', filters] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
};
