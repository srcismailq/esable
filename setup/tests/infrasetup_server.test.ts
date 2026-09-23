import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'http';
import { createStatusServer } from '../infrasetup_server.js';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn((cmd, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (cb) cb(null, '{}', '');
      return {} as any;
    }),
  };
});

import { exec } from 'child_process';

describe('State-Driven Infrastructure Server Behaviours', () => {
  let serverInstance: http.Server;
  const TEST_PORT = 3005;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/status`;

  beforeAll(async () => {
    serverInstance = createStatusServer();
    await new Promise<void>((resolve) => {
      serverInstance.listen(TEST_PORT, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => {
      serverInstance.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.mocked(exec).mockReset();
    vi.mocked(exec).mockImplementation((cmd, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (cb) cb(null, '{}', '');
      return {} as any;
    });
  });

  it('Behaviour 1: Should respond with correct CORS headers for the React frontend', async () => {
    const response = await fetch(BASE_URL, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('Behaviour 2: Should immediately emit an infrastructure handshake and trigger docker compose', async () => {
    const response = await fetch(BASE_URL);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();

    expect(exec).toHaveBeenCalledWith('docker compose up -d', expect.any(Object));
  });

  it('Behaviour 3: Should process container state transitions monotonically up to 100%', async () => {
    let mockPollCount = 0;

    vi.mocked(exec).mockImplementation(((cmd: string, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback;
      
      if (cmd.includes('up -d') || cmd.includes('down')) {
        if (cb) cb(null, '', '');
        return {} as any;
      }

      mockPollCount++;
      let jsonPayload = { Status: 'running', Health: { Status: 'starting' }, ExitCode: 0 };

      if (cmd.includes('postgres-lakehouse') && mockPollCount >= 2) {
        jsonPayload.Health.Status = 'healthy';
      }
      if (cmd.includes('warehouse-setup') && mockPollCount >= 4) {
        jsonPayload.Status = 'exited';
        jsonPayload.ExitCode = 0;
      }
      if (cmd.includes('cube-ready-notifier') && mockPollCount >= 6) {
        jsonPayload.Status = 'exited';
        jsonPayload.ExitCode = 0;
      }

      if (cb) cb(null, JSON.stringify(jsonPayload), '');
      return {} as any;
    }) as any);

    const response = await fetch(BASE_URL);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    const operationalPhases: string[] = [];
    let absoluteLastProgress = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunks = decoder.decode(value).split('\n\n');
      for (const chunk of chunks) {
        if (!chunk.trim() || !chunk.startsWith('data: ')) continue;
        
        const payload = JSON.parse(chunk.replace('data: ', '').trim());
        operationalPhases.push(payload.phase);
        
        expect(payload.progress).toBeGreaterThanOrEqual(absoluteLastProgress);
        absoluteLastProgress = payload.progress;

        if (payload.phase === 'complete') {
          await reader.cancel();
          break;
        }
      }
      if (absoluteLastProgress === 100) break;
    }

    expect(operationalPhases).toContain('database');
    expect(operationalPhases).toContain('pipeline');
    expect(operationalPhases).toContain('complete');
    expect(absoluteLastProgress).toBe(100);
  });

  it('Behaviour 4: Should immediately invoke "docker compose down" if the frontend disconnects prematurely', async () => {
    const response = await fetch(BASE_URL);
    const reader = response.body!.getReader();
    
    await reader.read();
    await reader.cancel();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('docker compose down'),
      expect.any(Object)
    );
  });

  it('Behaviour 5: Should forcefully clear the polling interval when a service returns a fatal crash exit code', async () => {
    let checkPollCount = 0;

    vi.mocked(exec).mockImplementation(((cmd: string, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback;
      
      if (cmd.includes('up -d') || cmd.includes('down')) {
        if (cb) cb(null, '', '');
        return {} as any;
      }

      checkPollCount++;

      if (cmd.includes('postgres-lakehouse')) {
        const payload = JSON.stringify({ Status: 'exited', ExitCode: 1 });
        if (cb) cb(null, payload, '');
        return {} as any;
      }

      if (cb) cb(null, JSON.stringify({ Status: 'running' }), '');
      return {} as any;
    }) as any);

    const response = await fetch(BASE_URL);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    let receivedErrorPayload = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunks = decoder.decode(value).split('\n\n');
      for (const chunk of chunks) {
        if (!chunk.trim() || !chunk.startsWith('data: ')) continue;
        const payload = JSON.parse(chunk.replace('data: ', '').trim());
        
        if (payload.phase === 'error') {
          receivedErrorPayload = true;
          break;
        }
      }
      if (receivedErrorPayload) {
        await reader.cancel();
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    const finalPollSnapshot = checkPollCount;

    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(receivedErrorPayload).toBe(true);
    expect(checkPollCount).toBe(finalPollSnapshot);
  });
});
