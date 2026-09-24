import { useState, useEffect } from 'react';
import { InfrastructureStreamManager, type StreamState } from '../InfrastructureStreamManager.js';

export function useInfrastructureStatus(url: string): StreamState {
  // Initialize state directly from the manager's default snapshot
  const [state, setState] = useState<StreamState>(() => {
    return new InfrastructureStreamManager(url).getState();
  });

  useEffect(() => {
    const manager = new InfrastructureStreamManager(url);

    // Subscribe to state updates and map them to our React setter
    const unsubscribe = manager.subscribe(setState);
    
    // Kick off the SSE stream connection
    manager.connect();

    // Clean up completely when the component unmounts
    return () => {
      unsubscribe();
      manager.disconnect();
    };
  }, [url]);

  return state;
}
