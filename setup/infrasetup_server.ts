import http from 'http';
import { exec } from 'child_process';

const INFRASTRUCTURE_STEPS = [
  { service: 'postgres-lakehouse', target: 'healthy', phase: 'database', progress: 30, status: 'Database server online. Running system health validation...' },
  { service: 'warehouse-setup', target: 'exited', phase: 'pipeline', progress: 75, status: 'Analytical data pipeline executing migrations and dbt models...' },
  { service: 'cube-ready-notifier', target: 'exited', phase: 'complete', progress: 100, status: 'Ready' }
] as const;

const shutdown = () => {
  exec('docker compose down', () => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export function createStatusServer(): http.Server {
  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
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

      res.write(`data: ${JSON.stringify({ phase: 'infrastructure', progress: 5, status: 'Spawning target framework configurations...' })}\n\n`);

      // Fixed: Removed invalid stdio object from exec
      exec('docker compose up -d');

      let currentStepIndex = 0;
      let isAborted = false;

      const monitorInterval = setInterval(() => {
        if (isAborted) {
          clearInterval(monitorInterval);
          return;
        }

        if (currentStepIndex >= INFRASTRUCTURE_STEPS.length) {
          clearInterval(monitorInterval);
          res.end();
          return;
        }

        const currentStep = INFRASTRUCTURE_STEPS[currentStepIndex];
        if (!currentStep) return;
        const inspectCmd = `docker inspect --format="{{json .State}}" ${currentStep.service}`;

        exec(inspectCmd, (error, stdout) => {
          if (isAborted) return;

          try {
            const cleanStdout = (stdout || '').toString().trim();
            if (!cleanStdout) return;

            const state = JSON.parse(cleanStdout);

            const hasCrashed = state.Status === 'exited' && state.ExitCode !== 0;
            const healthCheckFailed = state.Health?.Status === 'unhealthy';

            if (hasCrashed || healthCheckFailed) {
              isAborted = true; // Set flag early to abort subsequent calls
              clearInterval(monitorInterval);
              
              // Fixed: Fixed string backticks interpolation syntax error
              res.write(`data: ${JSON.stringify({
                phase: 'error',
                progress: currentStep.progress,
                status: `Critical Failure: Component ${currentStep.service} failed runtime checks.`
              })}\n\n`);
              res.end();
              return;
            }

            const isHealthy = state.Health?.Status === 'healthy';
            const isExitedCleanly = state.Status === 'exited' && state.ExitCode === 0;

            let stepPassed = false;
            if (currentStep.target === 'healthy' && isHealthy) stepPassed = true;
            if (currentStep.target === 'exited' && isExitedCleanly) stepPassed = true;

            if (stepPassed) {
              res.write(`data: ${JSON.stringify({
                phase: currentStep.phase,
                progress: currentStep.progress,
                status: currentStep.status
              })}\n\n`);

              currentStepIndex++;
            }
          } catch (err) {
            // Suppress JSON parsing errors safely during initialization frames
          }
        });
      }, 500);

      req.on('close', () => {
        isAborted = true;
        clearInterval(monitorInterval);
        res.end();
      });
      return;
    }

    res.writeHead(404).end();
  });
}
