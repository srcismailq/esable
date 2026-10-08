// src/App.tsx
import { Canvas } from '@react-three/fiber';
import BackgroundScene from './Background/components/BackgroundScene';

import { useQueryEngine } from './QueryForm/hooks/useQueryEngine';
import QueryForm from './QueryForm/components/QueryForm';
import AnalystReport from './QueryForm/components/AnalystReport';
import { useInfrastructureStatus } from './LoadingScreen/hook/useInfrastructureStatus';
import LoadingScreen from './LoadingScreen/components/LoadingScreen';
import { useLoadingLifecycle } from './LoadingScreen/hook/useLoadingLifecycle';

export default function App() {
  const {
    userQuery,
    responsePayload,
    isLoading,
    errorMessage,
    setUserQuery,
    submitQuery,
  } = useQueryEngine();

  const infraStatus = useInfrastructureStatus();
  const { isAppReady, isExiting, stableStatusSnapshot, onScreenMasked } = useLoadingLifecycle(infraStatus);

  return (
    <>
      <style>{`
        html, body { 
          margin: 0; 
          padding: 0; 
          background-color: #0D1026; 
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* GLOBAL 3D BACKDROP CONTEXT LAYER */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
        <Canvas>
          <BackgroundScene 
            statusSnapshot={stableStatusSnapshot} 
            isExiting={isExiting} 
            onScreenMasked={onScreenMasked} 
            isAppReady={isAppReady}
            isProcessing={isLoading} // Semantically maps the text-engine fetch states
          />
        </Canvas>
      </div>

      {/* HTML USER INTERFACE OVERLAY LAYER */}
      <div style={{ 
        position: 'relative', 
        zIndex: 1, 
        color: '#FFFFFF', 
        minHeight: '100vh', 
        width: '100%' 
      }}>
        
        {!isAppReady && (
          <LoadingScreen 
            statusSnapshot={stableStatusSnapshot} 
            isExiting={isExiting} 
            onTransitionComplete={onScreenMasked} 
          />
        )}

        {isAppReady && (
          <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto', 
            padding: '40px 20px', 
            fontFamily: 'sans-serif',
            animation: 'fadeIn 0.5s ease-out forwards' 
          }}>
            <h1>⚡ Esable</h1>
            <QueryForm 
              userQuery={userQuery} 
              isLoading={isLoading} 
              setUserQuery={setUserQuery} 
              onSubmit={submitQuery} 
            />
            <AnalystReport 
              responsePayload={responsePayload} 
              errorMessage={errorMessage} 
            />
          </div>
        )}
      </div>
    </>
  );
}
