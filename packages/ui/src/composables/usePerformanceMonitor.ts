import { ref, onMounted, onUnmounted } from 'vue';

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  lastUpdate: number;
}

export function usePerformanceMonitor(enabled = false) {
  const metrics = ref<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    renderTime: 0,
    lastUpdate: Date.now()
  });

  let frameCount = 0;
  let lastFrameTime = performance.now();
  let animationFrameId: number | null = null;
  let metricsInterval: number | null = null;

  const measureFPS = () => {
    frameCount++;
    
    const now = performance.now();
    const delta = now - lastFrameTime;
    
    if (delta >= 1000) {
      metrics.value.fps = Math.round((frameCount * 1000) / delta);
      frameCount = 0;
      lastFrameTime = now;
    }
    
    if (enabled) {
      animationFrameId = requestAnimationFrame(measureFPS);
    }
  };

  const measureMemory = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.value.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    }
  };

  const measureRenderTime = () => {
    const paintEntries = performance.getEntriesByType('paint');
    const lastPaint = paintEntries[paintEntries.length - 1];
    
    if (lastPaint) {
      metrics.value.renderTime = Math.round(lastPaint.startTime);
    }
  };

  const startMonitoring = () => {
    if (!enabled) return;
    
    // Start FPS monitoring
    measureFPS();
    
    // Start periodic metrics collection
    metricsInterval = window.setInterval(() => {
      measureMemory();
      measureRenderTime();
      metrics.value.lastUpdate = Date.now();
    }, 1000);
  };

  const stopMonitoring = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }
  };

  const mark = (name: string) => {
    if (enabled) {
      performance.mark(name);
    }
  };

  const measure = (name: string, startMark: string, endMark?: string) => {
    if (enabled) {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
        
        const measures = performance.getEntriesByName(name, 'measure');
        const lastMeasure = measures[measures.length - 1];
        
        return lastMeasure ? lastMeasure.duration : 0;
      } catch (error) {
        console.error('Performance measurement error:', error);
        return 0;
      }
    }
    return 0;
  };

  const clearMarks = () => {
    if (enabled) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  };

  onMounted(() => {
    startMonitoring();
  });

  onUnmounted(() => {
    stopMonitoring();
    clearMarks();
  });

  return {
    metrics,
    mark,
    measure,
    clearMarks,
    startMonitoring,
    stopMonitoring
  };
}