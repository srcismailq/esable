// src/store/useAppOrchestrator.ts
import { create } from 'zustand';

export interface LoadingViewDomain {
  progress: number;
  statusText: string;
  updateStream: (progress: number, statusText: string) => void;
}

export interface DashboardViewDomain {
  isQueryActive: boolean;
  isInterfaceVisible: boolean; // 🎯 NEW INTERFACE CONTAINER GATE
  setQueryActive: (isActive: boolean) => void;
  setInterfaceVisible: (visible: boolean) => void;
}

export interface AppOrchestratorState {
  loadingView: LoadingViewDomain;
  dashboardView: DashboardViewDomain;
  resetOrchestrator: () => void;
}

const INITIAL_LOADING = { progress: 0, statusText: 'Establishing backend pipeline...' };
const INITIAL_DASHBOARD = { isQueryActive: false, isInterfaceVisible: false };

export const useAppOrchestrator = create<AppOrchestratorState>((set) => ({
  loadingView: {
    ...INITIAL_LOADING,
    updateStream: (progress, statusText) =>
      set((state) => ({
        loadingView: { ...state.loadingView, progress, statusText }
      })),
  },

  dashboardView: {
    ...INITIAL_DASHBOARD,
    setQueryActive: (isActive) =>
      set((state) => ({
        dashboardView: { ...state.dashboardView, isQueryActive: isActive }
      })),
    setInterfaceVisible: (isInterfaceVisible) =>
      set((state) => ({
        dashboardView: { ...state.dashboardView, isInterfaceVisible }
      })),
  },

  resetOrchestrator: () =>
    set((state) => ({
      loadingView: { ...state.loadingView, ...INITIAL_LOADING },
      dashboardView: { ...state.dashboardView, ...INITIAL_DASHBOARD },
    })),
}));
