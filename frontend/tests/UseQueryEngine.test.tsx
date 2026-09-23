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

  it('should process a successful stream transaction correctly', async () => {
    const encoder = new TextEncoder();
    
    // Simulate our state diff snapshots arriving over the network stream
    const frame1 = { cube_json_query: { query: {} }, final_answer: "", error_message: null };
    const frame2 = { cube_json_query: { query: {} }, final_answer: "Mock Report Content", error_message: null };

    const chunk1 = encoder.encode(`data: ${JSON.stringify(frame1)}\n\n`);
    const chunk2 = encoder.encode(`data: ${JSON.stringify(frame2)}\n\n`);

    // Mock the browser's ReadableStream reader loop structure
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: chunk1, done: false })
        .mockResolvedValueOnce({ value: chunk2, done: false })
        .mockResolvedValueOnce({ value: undefined, done: true }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => mockReader,
      },
    } as unknown as Response);

    const { result } = renderHook(() => useQueryEngine());

    act(() => {
      result.current.setUserQuery('Valid Streaming Query');
    });

    await act(async () => {
      await result.current.submitQuery();
    });

    expect(result.current.isLoading).toBe(false);
    // Verifies state was updated cleanly with the final complete snapshot data
    expect(result.current.responsePayload).toEqual(frame2);
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
