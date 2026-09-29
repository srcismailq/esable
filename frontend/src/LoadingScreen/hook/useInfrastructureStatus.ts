import { useSyncExternalStore } from 'react';
import { globalInfraManager } from '../services/InfraService.js';
import type { StreamState } from '../InfrastructureStreamManager.js';

/**
 * Custom React hook providing strict TypeScript tracking of the backend infrastructure stream.
 * Synchronizes external class snapshots instantly with the React rendering loops.
 */
export function useInfrastructureStatus(): StreamState {
  return useSyncExternalStore<StreamState>(
    // 1. Tell React how to subscribe to updates. 
    // We pass a bound reference to keep 'this' pointer context inside your class.
    (callback) => globalInfraManager.subscribe(callback),
    
    // 2. Tell React how to fetch the latest immutable state snapshot.
    () => globalInfraManager.getState()
  );
}
