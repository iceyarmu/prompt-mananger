import type { HighlightRequest, HighlightResponse } from '../workers/highlighter.worker';

export class HighlightService {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestCounter = 0;
  private workerReady = false;
  
  constructor() {
    this.initWorker();
  }
  
  private initWorker() {
    try {
      // Create worker with Vite's worker syntax
      this.worker = new Worker(
        new URL('../workers/highlighter.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Handle worker messages
      this.worker.addEventListener('message', (event: MessageEvent<HighlightResponse>) => {
        const { id, html, language, error } = event.data;
        const pending = this.pendingRequests.get(id);
        
        if (pending) {
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve({ html, language });
          }
          this.pendingRequests.delete(id);
        }
      });
      
      // Handle worker errors
      this.worker.addEventListener('error', (error) => {
        console.error('Highlight worker error:', error);
        // Reject all pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('Worker error'));
        });
        this.pendingRequests.clear();
      });
      
      this.workerReady = true;
    } catch (error) {
      console.error('Failed to initialize highlight worker:', error);
      this.workerReady = false;
    }
  }
  
  async highlight(code: string, language?: string): Promise<{ html: string; language?: string }> {
    // Fallback if worker is not available
    if (!this.worker || !this.workerReady) {
      // Use dynamic import as fallback
      const hljs = await import('highlight.js');
      
      if (language && hljs.default.getLanguage(language)) {
        const result = hljs.default.highlight(code, { language });
        return { html: result.value, language: result.language };
      } else {
        const result = hljs.default.highlightAuto(code);
        return { html: result.value, language: result.language };
      }
    }
    
    // Use worker for highlighting
    return new Promise((resolve, reject) => {
      const id = `highlight-${++this.requestCounter}`;
      
      this.pendingRequests.set(id, { resolve, reject });
      
      const request: HighlightRequest = { id, code, language };
      this.worker!.postMessage(request);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Highlight timeout'));
        }
      }, 5000);
    });
  }
  
  destroy() {
    if (this.worker) {
      // Reject all pending requests
      this.pendingRequests.forEach(({ reject }) => {
        reject(new Error('Service destroyed'));
      });
      this.pendingRequests.clear();
      
      // Terminate worker
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }
  }
}

// Singleton instance
let highlightService: HighlightService | null = null;

export function getHighlightService(): HighlightService {
  if (!highlightService) {
    highlightService = new HighlightService();
  }
  return highlightService;
}

export function destroyHighlightService() {
  if (highlightService) {
    highlightService.destroy();
    highlightService = null;
  }
}