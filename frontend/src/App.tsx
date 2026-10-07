// App.tsx
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
  
  // Extract our stable status snapshot descriptor
  const { isAppReady, isExiting, stableStatusSnapshot, onScreenMasked } = useLoadingLifecycle(infraStatus);

  if (!isAppReady) {
    return (
      <LoadingScreen 
        statusSnapshot={stableStatusSnapshot} // <-- Pure cached data stream baseline
        isExiting={isExiting} 
        onTransitionComplete={onScreenMasked} 
      />
    );
  }

  
  return (
    <div style={{ 
      backgroundColor: '#0D1026', 
      color: '#FFFFFF', 
      minHeight: '100vh', 
      width: '100%' 
    }}>
      <style>{`
        body { 
          margin: 0; 
          padding: 0; 
          background-color: #0D1026; 
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '40px 20px', 
        fontFamily: 'sans-serif',
        // Applies a smooth 0.5-second fade and a slight upward slide
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
    </div>
  );
}
