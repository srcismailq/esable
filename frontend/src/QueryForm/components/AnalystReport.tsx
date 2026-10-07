import ReactMarkdown from 'react-markdown';
import { QueryResponse } from '../hooks/useQueryEngine';

interface AnalystReportProps {
  responsePayload: QueryResponse | null;
  errorMessage: string | null;
}

export default function AnalystReport({ responsePayload, errorMessage }: AnalystReportProps) {
  return (
    <>
      {/* Alert Banner Block */}
      {errorMessage && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: 'rgba(239, 68, 68, 0.15)', // Muted transparent dark red
          color: '#fca5a5', // Light salmon red for high readability
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px', 
          marginBottom: '20px' 
        }}>
          <strong>Notification:</strong> {errorMessage}
        </div>
      )}

      {/* Main Analysis Container */}
      {responsePayload && (
        <div style={{ 
          border: '1px solid #1e293b', // Deep slate border
          borderRadius: '8px', 
          padding: '20px', 
          backgroundColor: '#111827' // Slightly lighter dark background (Slate-900) for visual depth
        }}>
          <h2 style={{ marginTop: 0 }}>🤖 Analyst Report</h2>
          
          <div style={{ lineHeight: '1.6', color: '#e2e8f0' }}> {/* Soft white text for less eye strain */}
            <ReactMarkdown>{responsePayload.final_answer || ''}</ReactMarkdown>
          </div>

          {/* Collapsible Technical Metadata block */}
          {responsePayload.cube_json_query && (
            <details style={{ marginTop: '20px', cursor: 'pointer' }}>
              <summary style={{ color: '#94a3b8', fontWeight: 'bold' }}>📡 View Outbound Cube.js JSON Query</summary>
              <pre style={{ 
                backgroundColor: '#030712', // Ultra-dark gray codeblock background
                color: '#38bdf8', // Cyber cyan code text color
                padding: '12px', 
                borderRadius: '6px', 
                overflowX: 'auto', 
                marginTop: '10px', 
                fontSize: '14px',
                border: '1px solid #1f2937'
              }}>
                {JSON.stringify(responsePayload.cube_json_query, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );
}
