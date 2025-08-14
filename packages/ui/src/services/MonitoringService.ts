export class MonitoringService {
  private performanceObserver: PerformanceObserver;
  private errorQueue: Error[] = [];
  private systemMetrics: {
    currentSystem: 'old' | 'new';
    switchCount: number;
    errorsBySystem: { old: number; new: number };
    performanceBySystem: { old: number[]; new: number[] };
    lastSwitch: number;
  } = {
    currentSystem: 'old',
    switchCount: 0,
    errorsBySystem: { old: 0, new: 0 },
    performanceBySystem: { old: [], new: [] },
    lastSwitch: 0
  };
  
  constructor() {
    this.setupPerformanceMonitoring();
    this.setupErrorTracking();
    this.setupAnalytics();
    this.setupCutoverMonitoring();
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
  
  // System Cutover Monitoring Methods
  private setupCutoverMonitoring() {
    // Listen for system switch events
    window.addEventListener('system-switched', (event: any) => {
      this.trackSystemSwitch(event.detail?.system || 'unknown');
    });
    
    // Monitor performance by system
    this.trackSystemPerformance();
    
    // Setup cutover-specific dashboards
    this.initializeCutoverDashboard();
  }
  
  public trackSystemSwitch(newSystem: 'old' | 'new') {
    const previousSystem = this.systemMetrics.currentSystem;
    this.systemMetrics.currentSystem = newSystem;
    this.systemMetrics.switchCount++;
    this.systemMetrics.lastSwitch = Date.now();
    
    // Track the switch event
    this.sendAnalytic('system_cutover_switch', {
      from: previousSystem,
      to: newSystem,
      switchCount: this.systemMetrics.switchCount,
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    });
    
    // Track adoption metrics
    this.trackAdoptionRate();
  }
  
  public trackSystemError(error: Error, system: 'old' | 'new') {
    this.systemMetrics.errorsBySystem[system]++;
    
    this.sendMetric({
      name: 'system_error',
      system,
      errorCount: this.systemMetrics.errorsBySystem[system],
      errorMessage: error.message,
      timestamp: Date.now()
    });
    
    // Alert if error rate is high
    const errorRate = this.calculateErrorRate(system);
    if (errorRate > 0.05) { // 5% error rate threshold
      this.sendAlert('high_cutover_error_rate', {
        system,
        errorRate,
        threshold: 0.05,
        errorCount: this.systemMetrics.errorsBySystem[system]
      });
    }
  }
  
  public trackSystemPerformance() {
    setInterval(() => {
      const system = this.systemMetrics.currentSystem;
      const performance = this.measureSystemPerformance();
      
      this.systemMetrics.performanceBySystem[system].push(performance);
      
      // Keep only last 100 measurements
      if (this.systemMetrics.performanceBySystem[system].length > 100) {
        this.systemMetrics.performanceBySystem[system].shift();
      }
      
      // Send performance comparison
      this.sendMetric({
        name: 'system_performance_comparison',
        currentSystem: system,
        performance,
        oldSystemAvg: this.calculateAverage(this.systemMetrics.performanceBySystem.old),
        newSystemAvg: this.calculateAverage(this.systemMetrics.performanceBySystem.new),
        timestamp: Date.now()
      });
      
      // Alert if new system performs worse
      if (system === 'new' && performance > this.calculateAverage(this.systemMetrics.performanceBySystem.old) * 1.2) {
        this.sendAlert('new_system_performance_degradation', {
          currentPerformance: performance,
          oldSystemAverage: this.calculateAverage(this.systemMetrics.performanceBySystem.old),
          degradation: performance / this.calculateAverage(this.systemMetrics.performanceBySystem.old)
        });
      }
    }, 60000); // Every minute
  }
  
  private measureSystemPerformance(): number {
    // Measure current system performance
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navTiming) {
      return navTiming.loadEventEnd - navTiming.fetchStart;
    }
    return 0;
  }
  
  private calculateErrorRate(system: 'old' | 'new'): number {
    const totalRequests = 1000; // Assume 1000 requests as baseline
    return this.systemMetrics.errorsBySystem[system] / totalRequests;
  }
  
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
  
  public trackAdoptionRate() {
    // Track how many users are on each system
    this.sendMetric({
      name: 'cutover_adoption_rate',
      system: this.systemMetrics.currentSystem,
      switchCount: this.systemMetrics.switchCount,
      timeSinceLastSwitch: Date.now() - this.systemMetrics.lastSwitch,
      timestamp: Date.now()
    });
  }
  
  public trackCutoverSuccess(metric: string, value: number) {
    this.sendMetric({
      name: 'cutover_success_metric',
      metric,
      value,
      system: this.systemMetrics.currentSystem,
      timestamp: Date.now()
    });
  }
  
  private initializeCutoverDashboard() {
    // Create dashboard data structure
    const dashboard = {
      adoptionRate: 0,
      errorRates: { old: 0, new: 0 },
      performanceMetrics: { old: 0, new: 0 },
      switchCount: 0,
      activeUsers: { old: 0, new: 0 },
      lastUpdated: Date.now()
    };
    
    // Update dashboard every 30 seconds
    setInterval(() => {
      dashboard.adoptionRate = this.calculateAdoptionRate();
      dashboard.errorRates = {
        old: this.calculateErrorRate('old'),
        new: this.calculateErrorRate('new')
      };
      dashboard.performanceMetrics = {
        old: this.calculateAverage(this.systemMetrics.performanceBySystem.old),
        new: this.calculateAverage(this.systemMetrics.performanceBySystem.new)
      };
      dashboard.switchCount = this.systemMetrics.switchCount;
      dashboard.lastUpdated = Date.now();
      
      // Send dashboard update
      this.sendAnalytic('cutover_dashboard_update', dashboard);
      
      // Store in localStorage for UI display
      localStorage.setItem('cutoverDashboard', JSON.stringify(dashboard));
    }, 30000);
  }
  
  private calculateAdoptionRate(): number {
    // In a real scenario, this would query actual user distribution
    // For now, return a simulated value based on switch count
    return Math.min(this.systemMetrics.switchCount * 10, 100);
  }
  
  public getCutoverMetrics() {
    return {
      ...this.systemMetrics,
      dashboard: JSON.parse(localStorage.getItem('cutoverDashboard') || '{}')
    };
  }
  
  // Comparison metrics between old and new systems
  public trackComparisonMetric(metricName: string, oldValue: number, newValue: number) {
    const improvement = ((newValue - oldValue) / oldValue) * 100;
    
    this.sendMetric({
      name: 'system_comparison',
      metric: metricName,
      oldSystemValue: oldValue,
      newSystemValue: newValue,
      improvement: improvement,
      timestamp: Date.now()
    });
    
    // Track if new system is performing better
    if (improvement > 0) {
      this.trackCutoverSuccess(`${metricName}_improvement`, improvement);
    }
  }
}