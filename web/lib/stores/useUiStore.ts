import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  selectedCallId: string | null;
  selectedIncidentId: string | null;
  activeRiskFilter: string | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedCallId: (id: string | null) => void;
  setSelectedIncidentId: (id: string | null) => void;
  setActiveRiskFilter: (filter: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  selectedCallId: null,
  selectedIncidentId: null,
  activeRiskFilter: null,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedCallId: (id) => set({ selectedCallId: id }),
  setSelectedIncidentId: (id) => set({ selectedIncidentId: id }),
  setActiveRiskFilter: (filter) => set({ activeRiskFilter: filter }),
}));
