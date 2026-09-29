import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { InfrastructureStreamManager, type StreamState } from '../InfrastructureStreamManager';

// Mock client interface to isolate network behavior
interface MockEventSourceClient {
  onmessage?: (ev: { data: string }) => void;
  onerror?: (ev: any) => void;
  close: () => void;
}

describe('InfrastructureStreamManager', () => {
  let mockEventSource: MockEventSourceClient;
  let createMockEventSource: Mock;

  beforeEach(() => {
    mockEventSource = {
      close: vi.fn(),
    };
    // Factory mock to inject into the manager instead of global EventSource
    createMockEventSource = vi.fn().mockReturnValue(mockEventSource);
  });

  // --- 1. Connection & Lifecycle ---
  it('should initialize with idle status, 0 progress, and no errors', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    expect(manager.getState()).toEqual({
      status: 'idle',
      phase: 'infrastructure',
      progress: 0,
      statusText: '',
      error: null,
      isReady: false,
    });
  });

  it('should trigger the stream client with the correct endpoint on connect', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();
    expect(createMockEventSource).toHaveBeenCalledWith('http://localhost/status');
    expect(mockEventSource.onmessage).toBeTypeOf('function');
    expect(mockEventSource.onerror).toBeTypeOf('function');
  });

  // --- 2. Standard State Transitions & Data Parsing ---
  it('should parse valid JSON payloads and notify observers', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    const callback = vi.fn();
    
    manager.subscribe(callback);
    manager.connect();

    // Simulate backend SSE message frame
    mockEventSource.onmessage?.({
      data: JSON.stringify({ phase: 'database', progress: 30, status: 'Database server online.' }),
    });

    const expectedState: StreamState = {
      status: 'loading',
      phase: 'database',
      progress: 30,
      statusText: 'Database server online.',
      error: null,
      isReady: false,
    };

    expect(manager.getState()).toEqual(expectedState);
    expect(callback).toHaveBeenCalledWith(expectedState);
  });

  // --- 3. Completion & Clean Disconnection ---
  it('should transition to ready and close the connection when progress is 100', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();

    mockEventSource.onmessage?.({
      data: JSON.stringify({ phase: 'complete', progress: 100, status: 'Ready' }),
    });

    expect(manager.getState().isReady).toBe(true);
    expect(manager.getState().status).toBe('ready');
    expect(mockEventSource.close).toHaveBeenCalledTimes(1);
  });

  it('should explicitly invoke close on the stream client when disconnect is called', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();
    manager.disconnect();

    expect(mockEventSource.close).toHaveBeenCalledTimes(1);
  });

  // --- 4. Resiliency & Error Edge Cases ---
  it('should gracefully ignore malformed JSON payloads without throwing or wiping state', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();

    // Establish healthy baseline
    mockEventSource.onmessage?.({
      data: JSON.stringify({ phase: 'database', progress: 30, status: 'OK' }),
    });

    // Fire garbage payload
    expect(() => {
      mockEventSource.onmessage?.({ data: '{ incomplete json ...' });
    }).not.toThrow();

    // State should remain at the last healthy baseline
    expect(manager.getState().progress).toBe(30);
  });

  it('should handle explicitly reported backend errors, shift status, and close stream', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();

    mockEventSource.onmessage?.({
      data: JSON.stringify({ phase: 'error', progress: 30, status: 'Critical Failure: Component crashed' }),
    });

    expect(manager.getState().status).toBe('error');
    expect(manager.getState().error).toBe('Critical Failure: Component crashed');
    expect(mockEventSource.close).toHaveBeenCalledTimes(1);
  });

  it('should catch generic network drops via onerror and set an error status', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();

    mockEventSource.onerror?.(new Error('Network disconnected'));

    expect(manager.getState().status).toBe('error');
    expect(manager.getState().error).toContain('Connection lost');
  });

  it('should fall back to safe defaults if fields are missing in payload', () => {
    const manager = new InfrastructureStreamManager('http://localhost/status', createMockEventSource);
    manager.connect();

    // Payload missing 'status' text field completely
    mockEventSource.onmessage?.({
      data: JSON.stringify({ phase: 'pipeline', progress: 50 }),
    });

    expect(manager.getState().statusText).toBe(''); // Sanitized default instead of undefined
  });
});
