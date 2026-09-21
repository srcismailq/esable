import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQueryEngine } from '../src/hooks/useQueryEngine';

describe('useQueryEngine Behavioral Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with empty default states', () => {
    const { result } = renderHook(() => useQueryEngine());

    expect(result.current.userQuery).toBe('');
    expect(result.current.responsePayload).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('should update userQuery value when commanded', () => {
    const { result } = renderHook(() => useQueryEngine());

    act(() => {
      result.current.setUserQuery('Show 2025 spend');
    });

    expect(result.current.userQuery).toBe('Show 2025 spend');
  });

  it('should process a successful query transaction correctly', async () => {
    // Command the global fetch API to simulate a successful 200 OK server response
    const fakeResponse = {
      final_answer: 'Mock Report Content',
      cube_json_query: { query: {} },
      error_message: null,
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    } as Response);

    const { result } = renderHook(() => useQueryEngine());

    act(() => {
      result.current.setUserQuery('Valid Query');
    });

    // Fire the transaction command
    await act(async () => {
      await result.current.submitQuery();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.responsePayload).toEqual(fakeResponse);
    expect(result.current.errorMessage).toBeNull();
  });

  it('should capture and report validation boundaries when the server rejects input', async () => {
    // Command the global fetch API to simulate a bad request validation response
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Query cannot be empty' }),
    } as Response);

    const { result } = renderHook(() => useQueryEngine());

    await act(async () => {
      await result.current.submitQuery();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.responsePayload).toBeNull();
    expect(result.current.errorMessage).toBe('Query cannot be empty');
  });
});
