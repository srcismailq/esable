import ReactMarkdown from 'react-markdown';
import { QueryResponse } from '../hooks/useQueryEngine';
import remarkGfm from 'remark-gfm';

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
            border: '1px solid rgba(30, 41, 59, 0.5)', // Muted, semi-transparent deep slate border
            borderRadius: '12px', // Slightly rounder corners look better with glass effects
            padding: '20px', 
            
            /* Frosted Glass Core Styles */
            backgroundColor: 'rgba(17, 24, 39, 0.55)', // Semi-transparent Slate-900 (adjust 0.55 for more/less transparency)
            backdropFilter: 'blur(12px)', // Blurs the 3D component behind it
            WebkitBackdropFilter: 'blur(12px)', // Ensures Safari compatibility
            
            /* Optional: Subtle top highlight to simulate reflective glass */
            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 4px 30px rgba(0, 0, 0, 0.4)'
          }}>
            <h2 style={{ marginTop: 0 }}>🤖 Analyst Report</h2>
            
            <div style={{ lineHeight: '1.6', color: '#e2e8f0' }}> 
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {responsePayload.final_answer || ''}
              </ReactMarkdown>
            </div>

            {/* Collapsible Technical Metadata block */}
            {responsePayload.cube_json_query && (
              <details style={{ marginTop: '20px', cursor: 'pointer' }}>
                <summary style={{ color: '#94a3b8', fontWeight: 'bold' }}>📡 View Outbound Cube.js JSON Query</summary>
                <pre style={{ 
                  backgroundColor: 'rgba(3, 7, 18, 0.6)', // Transparent dark gray for the codeblock too
                  backdropFilter: 'blur(4px)',
                  color: '#38bdf8', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  overflowX: 'auto', 
                  marginTop: '10px', 
                  fontSize: '14px',
                  border: '1px solid rgba(31, 41, 55, 0.4)'
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
