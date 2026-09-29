import http from 'http';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { stderr } from 'process';

const FRONTEND_ORIGIN = 'http://localhost:5173';
const MONITOR_INTERVAL_MS = 500;

// Matches your frontend's exact structural expectation
export interface StreamState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  phase: string;
  progress: number;
  statusText: string;
  error: string | null;
  isReady: boolean;
}

const INFRASTRUCTURE_STEPS = [
  { service: 'postgres-lakehouse', target: 'healthy', phase: 'database', progress: 30, statusText: 'Database server online. Running system health validation...' },
  { service: 'warehouse-setup', target: 'exited', phase: 'pipeline', progress: 75, statusText: 'Analytical data pipeline executing migrations and dbt models...' },
  { service: 'cube-ready-notifier', target: 'exited', phase: 'complete', progress: 100, statusText: 'Ready' }
] as const;

class InfrastructureStateMachine extends EventEmitter {
  private currentState: StreamState = {
    status: 'loading',
    phase: 'infrastructure',
    progress: 5,
    statusText: 'Spawning target framework configurations...',
    error: null,
    isReady: false
  };
  private isDeploying = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  public getState(): StreamState {
    return this.currentState;
  }

  private updateState(newState: Partial<StreamState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.emit('change', this.currentState);
  }

  public start() {
    if (this.isDeploying) return;
    this.isDeploying = true;

    console.log('🔄 Executing: docker compose up -d');
    exec('docker compose up -d', (err, stdout, stderr) => {
      if (err) {
        const errorText = typeof stderr === 'string' ? stderr : (err.message || String(err));
        console.error(`❌ Docker Compose Up Failure:\n${errorText}`);
        this.handleFailure(`Docker Compose Initialization Failed: ${errorText.trim()}`);
      }
    });

    let currentStepIndex = 0;

    this.monitorInterval = setInterval(() => {
      if (currentStepIndex >= INFRASTRUCTURE_STEPS.length) {
        this.cleanup();
        return;
      }

      const currentStep = INFRASTRUCTURE_STEPS[currentStepIndex];
      if (!currentStep) return;

      // 1. First, try inspecting using the exact raw service name
      const primaryCmd = `docker inspect --format="{{json .State}}" ${currentStep.service}`;

      exec(primaryCmd, (error, stdout, stderr) => {
        if (!this.isDeploying) return;

        let cleanStdout = (stdout || '').toString().trim();

        // 2. If it failed, let's try reading through standard compose naming schemes fallback
        if ((error || !cleanStdout) && !cleanStdout.startsWith('{')) {
          // Try standard Compose V2 format: [current_dir_name]-[service_name]-1
          // Since we can't guess your folder name reliably, we run a query to look up the ID
          const fallbackCmd = `docker compose ps -q ${currentStep.service}`;
          
          exec(fallbackCmd, (fbErr, fbStdout) => {
            const containerId = (fbStdout || '').toString().trim();
            if (!containerId) {
              // Wait silently for a few ticks; container might still be registering in engine
              return;
            }

            // Inspect using the concrete matching container hash ID
            exec(`docker inspect --format="{{json .State}}" ${containerId}`, (idErr, idStdout) => {
              if (idStdout) {
                this.processContainerState(idStdout, currentStep, () => currentStepIndex++);
              }
            });
          });
          return;
        }

        // Standard route succeeded
        this.processContainerState(cleanStdout, currentStep, () => currentStepIndex++);
      });
    }, MONITOR_INTERVAL_MS);
  }

  private processContainerState(rawJson: string, currentStep: typeof INFRASTRUCTURE_STEPS[number], advanceStep: () => void) {
    try {
      const cleanJson = rawJson.trim();
      if (!cleanJson || !cleanJson.startsWith('{')) return;

      const state = JSON.parse(cleanJson);
      
      const hasCrashed = state.Status === 'exited' && state.ExitCode !== 0;
      const healthCheckFailed = state.Health?.Status === 'unhealthy';

      if (hasCrashed) {
        this.handleFailure(`Component "${currentStep.service}" exited unexpectedly with code ${state.ExitCode}.`);
        return;
      }

      if (healthCheckFailed) {
        this.handleFailure(`Component "${currentStep.service}" failed health check updates.`);
        return;
      }

      const isHealthy = state.Health?.Status === 'healthy';
      const isExitedCleanly = state.Status === 'exited' && state.ExitCode === 0;

      let stepPassed = false;
      if (currentStep.target === 'healthy' && isHealthy) stepPassed = true;
      if (currentStep.target === 'exited' && isExitedCleanly) stepPassed = true;

      if (stepPassed) {
        const dynamicIsReady = currentStep.progress === 100;
        console.log(`✅ Success: ${currentStep.service} -> reached target "${currentStep.target}"`);
        
        this.updateState({
          status: dynamicIsReady ? 'ready' : 'loading',
          phase: currentStep.phase,
          progress: currentStep.progress,
          statusText: currentStep.statusText,
          isReady: dynamicIsReady
        });
        
        advanceStep();
      }
    } catch (err) {
      // Absorb transient parsing frames safely while stream sets up
    }
  }

  private handleFailure(errorMessage: string) {
    this.updateState({
      status: 'error',
      phase: 'error',
      statusText: 'Deployment pipeline halted.',
      error: errorMessage,
      isReady: false
    });
    this.cleanup();
  }

  private cleanup() {
    this.isDeploying = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

const shutdown = () => {
  exec('docker compose down', () => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export function createStatusServer(orchestratorInstance?: InfrastructureStateMachine): http.Server {
  const orchestrator = orchestratorInstance || new InfrastructureStateMachine();
  if (!orchestratorInstance) {
    orchestrator.start();
  }
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

      // Stream initial frontend-ready state snapshot instantly
      res.write(`data: ${JSON.stringify(orchestrator.getState())}\n\n`);

      const onStateChange = (state: StreamState) => {
        res.write(`data: ${JSON.stringify(state)}\n\n`);
        if (state.status === 'ready' || state.status === 'error') {
          res.end();
        }
      };

      orchestrator.on('change', onStateChange);

      req.on('close', () => {
        orchestrator.off('change', onStateChange);
        res.end();
      });
      return;
    }

    res.writeHead(404).end();
  });
}
