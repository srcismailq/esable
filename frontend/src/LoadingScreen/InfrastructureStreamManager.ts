// src/LoadingScreen/InfrastructureStreamManager.ts
import { useAppOrchestrator } from '../store/useAppOrchestrator';

interface MinimalEventSource {
  onmessage?: (ev: { data: string }) => void;
  onerror?: (ev: any) => void;
  close: () => void;
}

type EventSourceFactory = (url: string) => MinimalEventSource;

export class InfrastructureStreamManager {
  private url: string;
  private createEventSource: EventSourceFactory;
  private client: MinimalEventSource | null = null;
  // 🎯 NETWORK COUNTER: Tracks total frames received during this live session
  private packetCount: number = 0;

  constructor(
    url: string,
    createEventSource: EventSourceFactory = (targetUrl) => new EventSource(targetUrl) as any
  ) {
    this.url = url;
    this.createEventSource = createEventSource;
  }

    public connect(): void {
    if (this.client) return;

    this.packetCount = 0; 
    this.client = this.createEventSource(this.url);

    this.client.onmessage = (event) => {
      try {
        // 🎯 DISK LOG INJECTION: Paste this block right here at the top of the try loop!
        try {
          const payload = JSON.parse(event.data);
          const prog = payload.progress ?? 0;
          const statusStr = payload.status ?? '';
          
          const rawLog = localStorage.getItem('__esable_network_trace') || '[]';
          const history = JSON.parse(rawLog);
          
          history.push({
            timestamp: Date.now(),
            progress: prog,
            status: statusStr
          });
          
          localStorage.setItem('__esable_network_trace', JSON.stringify(history));
        } catch (e) {
          // silently catch JSON parse exceptions
        }

        // --- Rest of your original code continues below completely untouched ---
        this.packetCount++; 
        
        const payload = JSON.parse(event.data);
        const phase = payload.phase ?? 'infrastructure';
        const progress = typeof payload.progress === 'number' ? payload.progress : 0;
        const statusText = payload.status ?? '';

        if (phase === 'error') {
          this.disconnect();
          return;
        }

        useAppOrchestrator.getState().loadingView.updateStream(progress, statusText);

        const isFinished = progress === 100 || phase === 'complete';
        
        if (isFinished && this.packetCount > 1) {
          this.disconnect();
        }
      } catch (err) {
        // absorb malformed frames cleanly
      }
    };

    this.client.onerror = () => {
      this.disconnect();
    };
  }


  public disconnect(): void {
    if (!this.client) return;
    this.client.close();
    this.client = null;
  }
}
