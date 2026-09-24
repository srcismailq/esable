import { useState } from 'react';

// Define the public type contracts matching our FastAPI backend structures exactly
export interface QueryResponse {
  cube_json_query: Record<string, any> | null;
  final_answer: string | null;
  error_message: string | null;
}

export function useQueryEngine() {
  const [userQuery, setUserQuery] = useState<string>('');
  const [responsePayload, setResponsePayload] = useState<QueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Command the client to send the payload to the local FastAPI server
  const submitQuery = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setResponsePayload(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_query: userQuery, stream: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        const serverError = data.detail || 'An unexpected server error occurred';
        setErrorMessage(typeof serverError === 'string' ? serverError : JSON.stringify(serverError));
        setResponsePayload(null);
        setIsLoading(false);
        return; // Halt execution here since we have no stream to read
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error('Readable stream not supported by this browser.');
      }

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Decode incoming packet data and append it straight to our tracking buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split the cumulative text data into individual standalone lines
        const lines = buffer.split('\n');
        
        // Retain the final uncompleted line in buffer to handle network packet splits safely
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          
          // Parse only the Server-Sent Event lines that carry data payloads
          if (cleanLine.startsWith('data:')) {
            const jsonStr = cleanLine.replace('data:', '').trim();
            const snapshot: QueryResponse = JSON.parse(jsonStr);

            // Directly overwrite your state with the latest snapshot values
            setResponsePayload(snapshot);

            // Intercept and surface execution circuit breakers instantly if an error code pops up
            if (snapshot.error_message) {
              setErrorMessage(snapshot.error_message);
            }
          }
        }
      }
    } catch (networkError: any) {
      setErrorMessage(networkError.message || 'Network connection failed');
      setResponsePayload(null);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    userQuery,
    responsePayload,
    isLoading,
    errorMessage,
    setUserQuery,
    submitQuery,
  };
}
