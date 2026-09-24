import { useQueryEngine } from './QueryForm/hooks/useQueryEngine';
import QueryForm from './QueryForm/components/QueryForm';
import AnalystReport from './QueryForm/components/AnalystReport';
import { useInfrastructureStatus } from './LoadingScreen/hook/useInfrastructureStatus';
import LoadingScreen from './LoadingScreen/components/LoadingScreen';

export default function App() {
  const {
    userQuery,
    responsePayload,
    isLoading,
    errorMessage,
    setUserQuery,
    submitQuery,
  } = useQueryEngine();

  const infraStatus = useInfrastructureStatus('http://localhost:8080/status');
  if (!infraStatus.isReady) {
    return <LoadingScreen statusSnapshot={infraStatus} />;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1>⚡ Esable</h1>
      
      {/* 1. Input Command Surface */}
      <QueryForm 
        userQuery={userQuery} 
        isLoading={isLoading} 
        setUserQuery={setUserQuery} 
        onSubmit={submitQuery} 
      />

      {/* 2. Visual Output Panel */}
      <AnalystReport 
        responsePayload={responsePayload} 
        errorMessage={errorMessage} 
      />
    </div>
  );
}
