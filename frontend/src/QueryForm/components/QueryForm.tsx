import React from 'react';

interface QueryFormProps {
  userQuery: string;
  isLoading: boolean;
  setUserQuery: (value: string) => void;
  onSubmit: () => void;
}

export default function QueryForm({ userQuery, isLoading, setUserQuery, onSubmit }: QueryFormProps) {
  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
      <input
        type="text"
        value={userQuery}
        onChange={(e) => setUserQuery(e.target.value)}
        placeholder="Ask Esable a question..."
        disabled={isLoading}
        style={{ flexGrow: 1, padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
      />
      <button
        type="submit"
        disabled={isLoading}
        style={{ padding: '12px 24px', fontSize: '16px', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none' }}
      >
        {isLoading ? 'Processing...' : 'Submit'}
      </button>
    </form>
  );
}
