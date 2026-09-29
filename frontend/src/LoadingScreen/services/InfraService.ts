import { InfrastructureStreamManager } from '../InfrastructureStreamManager.js';

// Replace with your actual local infra server URL 
const INFRA_STREAM_URL: string = 'http://localhost:8080/status';

/**
 * Single operational instance managing the underlying SSE socket.
 * It survives component unmounts and page refreshes seamlessly.
 */
export const globalInfraManager = new InfrastructureStreamManager(INFRA_STREAM_URL);

// Initiate the SSE line instantly when the app bundle evaluates
globalInfraManager.connect();
