import { type StreamState } from '../InfrastructureStreamManager';

interface LoadingScreenProps {
  statusSnapshot: StreamState;
}

export default function LoadingScreen({ statusSnapshot }: LoadingScreenProps) {
  const { progress, statusText, status, error } = statusSnapshot;

  if (status === 'error') {
    return (
      <div style={{ maxWidth: '500px', margin: '100px auto', padding: '20px', fontFamily: 'sans-serif', border: '1px solid #ffccd5', backgroundColor: '#fff5f5', borderRadius: '8px' }}>
        <h2 style={{ color: '#e53e3e', marginTop: 0 }}>🚨 Infrastructure Setup Failed</h2>
        <p style={{ color: '#4a5568', lineHeight: '1.5' }}>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ padding: '10px 16px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Retry Environment Boot
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto', padding: '0 20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h2 style={{ color: '#2d3748' }}>⚡ Initializing Esable Core</h2>
      <p style={{ color: '#718096', fontSize: '14px', minHeight: '20px' }}>{statusText || 'Establishing backend pipeline...'}</p>
      
      {/* Outer Progress Container */}
      <div style={{ width: '100%', height: '12px', backgroundColor: '#edf2f7', borderRadius: '6px', overflow: 'hidden', margin: '20px 0' }}>
        {/* Dynamic Inner Fill */}
        <div style={{ 
          width: `${progress}%`, 
          height: '100%', 
          backgroundColor: '#3182ce', 
          transition: 'width 0.3s ease-in-out',
          borderRadius: '6px'
        }} />
      </div>
      
      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#4a5568' }}>{progress}% Complete</span>
    </div>
  );
}
