// src/App.tsx
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAppOrchestrator } from './store/useAppOrchestrator';
import BackgroundCanvasManager from './Background/components/BackgroundCanvasManager.js';
import { useQueryEngine } from './QueryForm/hooks/useQueryEngine';
import QueryForm from './QueryForm/components/QueryForm';
import AnalystReport from './QueryForm/components/AnalystReport';
import LoadingScreen from './LoadingScreen/components/LoadingScreen';
import { globalInfraManager } from './LoadingScreen/services/InfraService.js';
import { Leva } from 'leva';

export default function App() {
  const { userQuery, responsePayload, isLoading, errorMessage, setUserQuery, submitQuery } = useQueryEngine();
  
  // 🎯 TWIN SELECTION GATES: Captures both raw data readiness and the state machine's form reveal time
  const isReady = useAppOrchestrator((state) => state.loadingView.progress === 100);
  const isInterfaceVisible = useAppOrchestrator((state) => state.dashboardView.isInterfaceVisible);
  const setQueryActive = useAppOrchestrator((state) => state.dashboardView.setQueryActive);

  useEffect(() => {
    globalInfraManager.connect();
    return () => globalInfraManager.disconnect();
  }, []);

  useEffect(() => {
    setQueryActive(isLoading);
  }, [isLoading, setQueryActive]);

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background-color: #0D1026; width: 100%; height: 100%; overflow-x: hidden; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
        <Canvas>
          <Leva hidden/>
          <BackgroundCanvasManager />
        </Canvas>
      </div>

      <div style={{ position: 'relative', zIndex: 1, color: '#FFFFFF', minHeight: '100vh', width: '100%' }}>
        
        {/* 🎯 THE DISAPPEARING ACT: The text screen completely unmounts/fades the second metrics hit 100% */}
        {!isReady && <LoadingScreen />}
        
        {/* The Query dashboard form waits explicitly for the state machine's 2-second isolation timer to clear */}
        {isInterfaceVisible && (
          <div style={{ 
            maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif',
            animation: 'fadeIn 0.5s ease-out forwards' 
          }}>
            <h1>⚡ Esable</h1>
            <QueryForm userQuery={userQuery} isLoading={isLoading} setUserQuery={setUserQuery} onSubmit={submitQuery} />
            <AnalystReport responsePayload={responsePayload} errorMessage={errorMessage} />
          </div>
        )}
      </div>
    </>
  );
}
