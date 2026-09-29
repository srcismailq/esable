import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { createStatusServer, type StreamState } from '../infrasetup_server.js';
import { exec } from 'child_process';

// Mock only the 3rd-party OS boundary tool (child_process.exec)
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

describe('Docker Infrastructure Status Server (Public Behaviors)', () => {
  let server: http.Server;
  let port: number;
  let mockExec: any;

  beforeEach(async () => {
    mockExec = vi.mocked(exec);
    // Setup an ephemeral server on a dynamic random port for isolation
    server = createStatusServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(() => {
    server.close();
    vi.restoreAllMocks();
  });

  it('should return a 404 status code when hitting an unknown route', async () => {
    const res = await fetch(`http://localhost:${port}/unknown-route`);
    expect(res.status).toBe(404);
  });

  it('should return a 204 status code for OPTIONS preflight request', async () => {
    const res = await fetch(`http://localhost:${port}/status`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
  });

  it('should include permissive CORS origin headers pointing to port 5173', async () => {
    const res = await fetch(`http://localhost:${port}/status`, { method: 'OPTIONS' });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('should use the text/event-stream content type for status GET requests', async () => {
    const res = await fetch(`http://localhost:${port}/status`);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
  });

  it('should include real-time live connection sync headers', async () => {
    const res = await fetch(`http://localhost:${port}/status`);
    expect(res.headers.get('connection')).toBe('keep-alive');
  });

  it('should broadcast the initial infrastructure snapshot in the first network frame', async () => {
    const res = await fetch(`http://localhost:${port}/status`);
    const reader = res.body?.getReader();
    
    const { value } = await reader!.read();
    const chunkStr = new TextDecoder().decode(value);
    
    // Snip off the SSE data: prefix to inspect the payload raw text
    const jsonStr = chunkStr.replace('data: ', '').trim();
    const data = JSON.parse(jsonStr) as StreamState;

    expect(data.phase).toBe('infrastructure');
    expect(data.progress).toBe(5);
    expect(data.status).toBe('loading');
  });

  it('should execute docker compose down to clean up containers when a SIGTERM signal is received', async () => {
    // 1. Arrange: Spy on process.exit so the test process doesn't actually shut down
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // 2. Act: Manually fire the SIGTERM event on the Node process object
    process.emit('SIGTERM', 'SIGTERM');

    // 3. Assert: Verify the public side-effect was triggered
    expect(mockExec).toHaveBeenCalledWith('docker compose down', expect.any(Function));

    // Find the exact call index matching our command cleanly
    const matchingCall = mockExec.mock.calls.find((call: unknown[]) => call[0] === 'docker compose down');
    expect(matchingCall).toBeDefined();

    // Explicitly cast the callback argument to avoid implicit 'any' warnings
    const callback = matchingCall![1] as (err: Error | null, stdout: string, stderr: string) => void;
    
    // 4. Execute the callback to verify process.exit(0) is hit
    callback(null, 'stopped', '');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

});
