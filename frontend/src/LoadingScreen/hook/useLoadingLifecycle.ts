import { useState, useEffect, useRef } from 'react';
import { type StreamState } from '../InfrastructureStreamManager';

export function useLoadingLifecycle(infraStatus: StreamState) {
  const [visualPhase, setVisualPhase] = useState<'streaming' | 'animating' | 'done'>('streaming');
  
  // Cache the last known healthy stream payload so the 3D scene doesn't reset mid-flight
  const frozenStatusRef = useRef<StreamState>(infraStatus);

  if (visualPhase === 'streaming') {
    frozenStatusRef.current = infraStatus;
  }

  useEffect(() => {
    // The exact split-second it hits ready, lock down the phase state
    if (infraStatus.isReady && visualPhase === 'streaming') {
      setVisualPhase('animating');
    }
  }, [infraStatus.isReady, visualPhase]);

  return {
    isAppReady: visualPhase === 'done',
    isExiting: visualPhase === 'animating',
    // Use our frozen snapshot so 3D coordinates don't reset to zero on disconnect
    stableStatusSnapshot: frozenStatusRef.current,
    onScreenMasked: () => setVisualPhase('done')
  };
}
