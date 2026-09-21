import { useQueryEngine } from './hooks/useQueryEngine';
import QueryForm from './components/QueryForm';
import AnalystReport from './components/AnalystReport';

export default function App() {
  const {
    userQuery,
    responsePayload,
    isLoading,
    errorMessage,
    setUserQuery,
    submitQuery,
  } = useQueryEngine();

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1>⚡ FinOps Semantic Engine</h1>
      
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
