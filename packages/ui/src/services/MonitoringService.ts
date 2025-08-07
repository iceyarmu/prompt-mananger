export class MonitoringService {
  private performanceObserver: PerformanceObserver;
  private errorQueue: Error[] = [];
  
  constructor() {
    this.setupPerformanceMonitoring();
    this.setupErrorTracking();
    this.setupAnalytics();
  }
  
  private setupPerformanceMonitoring() {
    // Core Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'largest-contentful-paint') {
            this.trackMetric('LCP', entry.startTime);
          } else if (entry.entryType === 'first-input') {
            this.trackMetric('FID', (entry as any).processingStart - entry.startTime);
          } else if (entry.entryType === 'layout-shift') {
            if (!(entry as any).hadRecentInput) {
              this.trackMetric('CLS', (entry as any).value);
            }
          }
        });
      });
      
      this.performanceObserver.observe({
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift']
      });
    }
    
    // Custom performance monitoring
    this.monitorFileOperations();
    this.monitorMemoryUsage();
  }
  
  private setupErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'javascript'
      });
    });
    
    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(event.reason, {
        type: 'promise-rejection'
      });
    });
    
    // Vue error handler
    if ((window as any).Vue) {
      (window as any).Vue.config.errorHandler = (error: Error, vm: any, info: string) => {
        this.trackError(error, {
          component: vm?.$options.name,
          errorInfo: info,
          type: 'vue'
        });
      };
    }
  }
  
  private setupAnalytics() {
    // User behavior tracking
    this.trackPageViews();
    this.trackFeatureUsage();
    this.trackUserJourney();
  }
  
  private monitorFileOperations() {
    // Override file operation methods to track performance
    const originalSave = (window as any).saveFile;
    if (originalSave) {
      (window as any).saveFile = async (...args: any[]) => {
        const start = performance.now();
        try {
          const result = await originalSave.apply(this, args);
          const duration = performance.now() - start;
          this.trackFileOperation('save', duration, true);
          return result;
        } catch (error) {
          const duration = performance.now() - start;
          this.trackFileOperation('save', duration, false);
          throw error;
        }
      };
    }
  }
  
  private monitorMemoryUsage() {
    setInterval(() => {
      if ('memory' in performance) {
        const usage = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
        this.trackMemoryUsage(usage);
      }
    }, 30000); // Every 30 seconds
  }
  
  private trackPageViews() {
    // Track initial page view
    this.sendAnalytic('page_view', {
      path: window.location.pathname,
      referrer: document.referrer,
      timestamp: Date.now()
    });
    
    // Track route changes (for SPA)
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      this.sendAnalytic('page_view', {
        path: window.location.pathname,
        timestamp: Date.now()
      });
    }.bind(this);
  }
  
  private trackFeatureUsage() {
    // Track feature usage
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const feature = target.getAttribute('data-track-feature');
      if (feature) {
        this.trackUserEngagement(feature, 'click', {
          element: target.tagName,
          text: target.textContent?.substring(0, 50)
        });
      }
    });
  }
  
  private trackUserJourney() {
    const journey: any[] = [];
    
    // Track significant user actions
    const trackAction = (action: string, details?: any) => {
      journey.push({
        action,
        details,
        timestamp: Date.now()
      });
      
      // Send journey data periodically
      if (journey.length >= 10) {
        this.sendAnalytic('user_journey', journey);
        journey.length = 0;
      }
    };
    
    // Attach to global event bus or specific events
    (window as any).trackUserAction = trackAction;
  }
  
  trackFileOperation(operation: string, duration: number, success: boolean) {
    const metric = {
      name: 'file_operation',
      operation,
      duration,
      success,
      timestamp: Date.now()
    };
    
    // Send to analytics
    this.sendMetric(metric);
    
    // Alert if performance degrades
    if (duration > 500) {
      this.sendAlert('slow_file_operation', {
        operation,
        duration,
        threshold: 500
      });
    }
  }
  
  trackMemoryUsage(usage: number) {
    this.sendMetric({
      name: 'memory_usage',
      value: usage,
      timestamp: Date.now()
    });
    
    if (usage > 180) {
      this.sendAlert('high_memory_usage', {
        usage,
        threshold: 180
      });
    }
  }
  
  trackUserEngagement(feature: string, action: string, metadata?: any) {
    this.sendMetric({
      name: 'user_engagement',
      feature,
      action,
      metadata,
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    });
  }
  
  trackMetric(name: string, value: number) {
    this.sendMetric({
      name,
      value,
      timestamp: Date.now()
    });
  }
  
  trackError(error: Error, context?: any) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    this.errorQueue.push(error);
    
    // Send to error tracking service
    this.sendError(errorData);
    
    // Keep only last 10 errors in memory
    if (this.errorQueue.length > 10) {
      this.errorQueue.shift();
    }
  }
  
  private sendMetric(metric: any) {
    // Send to your analytics service (e.g., Google Analytics, Mixpanel)
    if ((window as any).gtag) {
      (window as any).gtag('event', metric.name, metric);
    }
    
    // Also send to custom endpoint
    this.sendToEndpoint('/api/metrics', metric);
    
    // Log for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Metric:', metric);
    }
  }
  
  private sendAnalytic(eventName: string, data: any) {
    // Send to analytics service
    if ((window as any).gtag) {
      (window as any).gtag('event', eventName, data);
    }
    
    // Custom analytics endpoint
    this.sendToEndpoint('/api/analytics', {
      event: eventName,
      data,
      timestamp: Date.now()
    });
  }
  
  private sendError(errorData: any) {
    // Send to error tracking service (e.g., Sentry, Rollbar)
    if ((window as any).Sentry) {
      (window as any).Sentry.captureException(new Error(errorData.message), {
        extra: errorData
      });
    }
    
    // Custom error endpoint
    this.sendToEndpoint('/api/errors', errorData);
  }
  
  private sendAlert(alertType: string, data: any) {
    // Send to monitoring service (e.g., Sentry, DataDog)
    console.warn(`🚨 Alert: ${alertType}`, data);
    
    // Send to alerting endpoint
    this.sendToEndpoint('/api/alerts', {
      type: alertType,
      data,
      timestamp: Date.now()
    });
  }
  
  private async sendToEndpoint(endpoint: string, data: any) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      // Queue for retry if offline
      this.queueForRetry(endpoint, data);
    }
  }
  
  private queueForRetry(endpoint: string, data: any) {
    const queue = JSON.parse(localStorage.getItem('metricsQueue') || '[]');
    queue.push({ endpoint, data, timestamp: Date.now() });
    localStorage.setItem('metricsQueue', JSON.stringify(queue));
    
    // Retry when online
    window.addEventListener('online', () => {
      this.processQueuedMetrics();
    });
  }
  
  private async processQueuedMetrics() {
    const queue = JSON.parse(localStorage.getItem('metricsQueue') || '[]');
    
    for (const item of queue) {
      try {
        await this.sendToEndpoint(item.endpoint, item.data);
      } catch (error) {
        // Keep in queue if still failing
        continue;
      }
    }
    
    localStorage.removeItem('metricsQueue');
  }
  
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }
  
  // Public API for manual tracking
  public track(eventName: string, data?: any) {
    this.sendAnalytic(eventName, data);
  }
  
  public trackTiming(category: string, variable: string, time: number) {
    this.sendMetric({
      name: 'timing',
      category,
      variable,
      value: time,
      timestamp: Date.now()
    });
  }
  
  public setUser(userId: string, traits?: any) {
    // Set user context for all future events
    (window as any).userId = userId;
    
    this.sendAnalytic('identify', {
      userId,
      traits,
      timestamp: Date.now()
    });
  }
  
  public trackConversion(conversionType: string, value?: number) {
    this.sendAnalytic('conversion', {
      type: conversionType,
      value,
      timestamp: Date.now()
    });
  }
}