import http from 'http';
import { EventEmitter } from 'events';

const FRONTEND_ORIGIN = 'http://localhost:5173';

// Adjust this interval to change your debugging velocity!
// 1000ms means it advances progress stages every 1 second.
const MOCK_STEP_INTERVAL_MS = 3000;

export interface StreamState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  phase: string;
  progress: number;
  statusText: string;
  error: string | null;
  isReady: boolean;
}

// These match your frontend expectation payload shapes identically
const MOCK_STEPS = [
  { phase: 'infrastructure', progress: 5, status: 'loading', text: 'Mock Setup: Spawning target framework configurations...' },
  { phase: 'database', progress: 30, status: 'loading', text: 'Mock Setup: Database server online. Running system health validation...' },
  { phase: 'pipeline', progress: 75, status: 'loading', text: 'Mock Setup: Analytical data pipeline executing migrations...' },
  { phase: 'complete', progress: 100, status: 'ready', text: 'Ready' }
] as const;

class MockInfrastructureStateMachine extends EventEmitter {
  private currentState: StreamState = {
    status: 'loading',
    phase: 'infrastructure',
    progress: 0,
    statusText: 'Initializing simulated pipeline...',
    error: null,
    isReady: false
  };
  private timer: NodeJS.Timeout | null = null;

  public getState(): StreamState {
    return this.currentState;
  }

  private updateState(newState: Partial<StreamState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.emit('change', this.currentState);
  }

  public start() {
    let internalStepIndex = 0;

    this.timer = setInterval(() => {
      if (internalStepIndex >= MOCK_STEPS.length) {
        this.cleanup();
        return;
      }

      const stepData = MOCK_STEPS[internalStepIndex];
      if(!stepData) throw new Error('no stepData')
      const dynamicIsReady = stepData.progress === 100;

      console.log(`⚡ [Mock SSE] Emitting Progress: ${stepData.progress}% - Phase: ${stepData.phase}`);

      this.updateState({
        status: stepData.status,
        phase: stepData.phase,
        progress: stepData.progress,
        statusText: stepData.text,
        isReady: dynamicIsReady
      });

      internalStepIndex++;
    }, MOCK_STEP_INTERVAL_MS);
  }

  private cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function createMockStatusServer(): http.Server {
  const mockOrchestrator = new MockInfrastructureStateMachine();
  mockOrchestrator.start();

  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    if (req.url === '/status' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Stream initial frame snapshot instantly upon browser mount
      res.write(`data: ${JSON.stringify(mockOrchestrator.getState())}\n\n`);

      const onStateChange = (state: StreamState) => {
        res.write(`data: ${JSON.stringify(state)}\n\n`);
        // Keep the stream connection alive short-term during the 'ready' flag 
        // to let the frontend finish processing its exit calculations before a cut.
        if (state.status === 'error') {
          res.end();
        }
      };

      mockOrchestrator.on('change', onStateChange);

      req.on('close', () => {
        mockOrchestrator.off('change', onStateChange);
        res.end();
      });
      return;
    }

    res.writeHead(404).end();
  });
}

import { fileURLToPath } from 'url';

// Automatically bind and execute standalone in an ES Module environment
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = 8080; // Match whatever port your raw server runs on
  createMockStatusServer().listen(PORT, () => {
    console.log(`🚀 Automated Mock Status Stream Server online at http://localhost:${PORT}/status`);
  });
}
