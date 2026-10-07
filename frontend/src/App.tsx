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
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
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
  );
}
