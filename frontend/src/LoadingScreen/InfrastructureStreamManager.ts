export interface StreamState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  phase: string;
  progress: number;
  statusText: string;
  error: string | null;
  isReady: boolean;
}

export type Listener = (state: StreamState) => void;

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
  private listeners: Set<Listener> = new Set();
  
  private state: StreamState = {
    status: 'idle',
    phase: 'infrastructure',
    progress: 0,
    statusText: '',
    error: null,
    isReady: false,
  };

  constructor(
    url: string,
    // Dependency injection handles the raw browser object fallback seamlessly
    createEventSource: EventSourceFactory = (targetUrl) => new EventSource(targetUrl) as any
  ) {
    this.url = url;
    this.createEventSource = createEventSource;
  }

  public getState(): StreamState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public connect(): void {
    if (this.client) return;

    this.client = this.createEventSource(this.url);

    this.client.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // Defensive default protection to prevent React text nodes from choking on undefined properties
        const phase = payload.phase ?? 'infrastructure';
        const progress = typeof payload.progress === 'number' ? payload.progress : 0;
        const statusText = payload.status ?? '';

        if (phase === 'error') {
          this.updateState({
            status: 'error',
            phase,
            progress,
            statusText,
            error: statusText || 'An explicit backend error occurred.',
          });
          this.disconnect();
          return;
        }

        const isReady = progress === 100 || phase === 'complete';
        
        this.updateState({
          status: isReady ? 'ready' : 'loading',
          phase,
          progress,
          statusText,
          isReady,
        });

        if (isReady) {
          this.disconnect();
        }
      } catch (err) {
        // Quietly absorb malformed frames without resetting the previous healthy baseline snapshots
      }
    };

    this.client.onerror = () => {
      this.updateState({
        status: 'error',
        error: 'Connection lost with backend infrastructure stream.',
      });
      this.disconnect();
    };
  }

  public disconnect(): void {
    if (!this.client) return;
    this.client.close();
    this.client = null;
  }

  private updateState(partialState: Partial<StreamState>): void {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  private notify(): void {
    const activeSnapshot = this.getState();
    this.listeners.forEach((listener) => listener(activeSnapshot));
  }
}
