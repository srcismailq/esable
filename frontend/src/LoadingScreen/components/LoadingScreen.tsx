// src/LoadingScreen/components/LoadingScreen.tsx
import { useAppOrchestrator } from '../../store/useAppOrchestrator';

export default function LoadingScreen() {
  const progress = useAppOrchestrator((state) => state.loadingView.progress);
  const statusText = useAppOrchestrator((state) => state.loadingView.statusText);
  
  // 🎯 ZERO-DELAY DISMISSAL: Trigger opacity fade the exact frame progress registers completion
  const isReady = useAppOrchestrator((state) => state.loadingView.progress === 100);

  return (
    <div style={{ 
      maxWidth: '500px', margin: '100px auto', padding: '0 20px', fontFamily: 'sans-serif', textAlign: 'center',
      transition: 'opacity 0.25s ease-in-out',
      opacity: isReady ? 0 : 1,
      position: 'relative', zIndex: 2
    }}>
      <h2 style={{ color: '#c7d6ef' }}>⚡ Initializing Esable Core</h2>
      <p style={{ color: '#718096', fontSize: '14px', minHeight: '20px' }}>{statusText}</p>
      
      <div style={{ width: '100%', height: '12px', backgroundColor: '#edf2f7', borderRadius: '6px', overflow: 'hidden', margin: '20px 0' }}>
        <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#3182ce', transition: 'width 0.3s ease-in-out', borderRadius: '6px' }} />
      </div>
      
      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#4a5568' }}>{progress}% Complete</span>
    </div>
  );
}
