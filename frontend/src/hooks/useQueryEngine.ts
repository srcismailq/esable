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
        body: JSON.stringify({ user_query: userQuery }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract FastAPI's standard detail error message if present
        const serverError = data.detail || 'An unexpected server error occurred';
        setErrorMessage(typeof serverError === 'string' ? serverError : JSON.stringify(serverError));
        setResponsePayload(null);
      } else {
        setResponsePayload(data);
        setErrorMessage(null);
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
