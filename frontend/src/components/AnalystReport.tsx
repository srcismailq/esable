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
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '20px' }}>
          <strong>Notification:</strong> {errorMessage}
        </div>
      )}

      {/* Main Analysis Container */}
      {responsePayload && (
        <div style={{ border: '1px solid #eaeaea', borderRadius: '8px', padding: '20px', backgroundColor: '#fafafa' }}>
          <h2>🤖 Analyst Report</h2>
          
          <div style={{ lineHeight: '1.6' }}>
            <ReactMarkdown>{responsePayload.final_answer || ''}</ReactMarkdown>
          </div>

          {/* Collapsible Technical Metadata block */}
          {responsePayload.cube_json_query && (
            <details style={{ marginTop: '20px', cursor: 'pointer' }}>
              <summary style={{ color: '#666', fontWeight: 'bold' }}>📡 View Outbound Cube.js JSON Query</summary>
              <pre style={{ backgroundColor: '#f4f4f4', padding: '12px', borderRadius: '6px', overflowX: 'auto', marginTop: '10px', fontSize: '14px' }}>
                {JSON.stringify(responsePayload.cube_json_query, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );
}
