import { FeatureFlagService } from './FeatureFlagService';
import { MonitoringService } from './MonitoringService';

export interface RollbackConfig {
  reason: string;
  type: 'emergency' | 'gradual' | 'targeted';
  targetGroups?: string[];
  metadata?: Record<string, any>;
}

export interface RollbackResult {
  success: boolean;
  startTime: number;
  endTime: number;
  affectedUsers: number;
  previousState: string;
  newState: string;
  errors: string[];
}

export class RollbackService {
  private featureFlagService: FeatureFlagService;
  private monitoringService: MonitoringService;
  private rollbackInProgress: boolean = false;
  private errorThreshold: number = 0.05; // 5% error rate
  private performanceThreshold: number = 1.5; // 50% slower
  private checkInterval: number = 30000; // 30 seconds
  private autoRollbackEnabled: boolean = true;
  private monitoringIntervalId: number | null = null;

  constructor() {
    this.featureFlagService = new FeatureFlagService();
    this.monitoringService = new MonitoringService();
    this.setupAutoRollback();
  }

  /**
   * Setup automatic rollback monitoring
   */
  private setupAutoRollback() {
    if (!this.autoRollbackEnabled) return;

    this.monitoringIntervalId = window.setInterval(() => {
      this.checkRollbackConditions();
    }, this.checkInterval);
  }

  /**
   * Check if automatic rollback conditions are met
   */
  private async checkRollbackConditions() {
    if (this.rollbackInProgress) return;

    const metrics = this.monitoringService.getCutoverMetrics();
    const dashboard = metrics.dashboard;

    // Check error rate threshold
    if (dashboard.errorRates?.new > this.errorThreshold) {
      console.warn('Error rate threshold exceeded, triggering automatic rollback');
      await this.executeRollback({
        reason: 'high_error_rate',
        type: 'emergency',
        metadata: {
          errorRate: dashboard.errorRates.new,
          threshold: this.errorThreshold
        }
      });
      return;
    }

    // Check performance degradation
    const performanceDegradation = dashboard.performanceMetrics?.new / dashboard.performanceMetrics?.old;
    if (performanceDegradation > this.performanceThreshold) {
      console.warn('Performance degradation detected, triggering automatic rollback');
      await this.executeRollback({
        reason: 'performance_degradation',
        type: 'gradual',
        metadata: {
          degradation: performanceDegradation,
          threshold: this.performanceThreshold,
          oldPerformance: dashboard.performanceMetrics.old,
          newPerformance: dashboard.performanceMetrics.new
        }
      });
      return;
    }

    // Check for critical service failures
    const healthStatus = await this.checkSystemHealth();
    if (!healthStatus.healthy && healthStatus.criticalFailures > 0) {
      console.error('Critical service failures detected, triggering emergency rollback');
      await this.executeRollback({
        reason: 'critical_service_failure',
        type: 'emergency',
        metadata: {
          failures: healthStatus.failedServices,
          criticalCount: healthStatus.criticalFailures
        }
      });
    }
  }

  /**
   * Execute rollback based on configuration
   */
  public async executeRollback(config: RollbackConfig): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      startTime: Date.now(),
      endTime: 0,
      affectedUsers: 0,
      previousState: this.featureFlagService.getCutoverVariant(),
      newState: 'old_system',
      errors: []
    };

    if (this.rollbackInProgress) {
      result.errors.push('Rollback already in progress');
      return result;
    }

    this.rollbackInProgress = true;

    try {
      // Notify monitoring service
      this.monitoringService.track('rollback_initiated', {
        reason: config.reason,
        type: config.type,
        metadata: config.metadata
      });

      // Send notification to users (if not emergency)
      if (config.type !== 'emergency') {
        await this.notifyUsers('rollback_starting', {
          estimatedTime: config.type === 'gradual' ? '30 minutes' : '5 minutes'
        });
      }

      switch (config.type) {
        case 'emergency':
          await this.performEmergencyRollback();
          break;
        case 'gradual':
          await this.performGradualRollback();
          break;
        case 'targeted':
          await this.performTargetedRollback(config.targetGroups || []);
          break;
      }

      // Verify rollback success
      const verificationResult = await this.verifyRollback();
      if (!verificationResult.success) {
        result.errors.push(...verificationResult.errors);
        throw new Error('Rollback verification failed');
      }

      result.success = true;
      result.newState = this.featureFlagService.getCutoverVariant();
      result.affectedUsers = await this.getAffectedUserCount();

    } catch (error) {
      console.error('Rollback failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      // Try emergency rollback as last resort
      if (config.type !== 'emergency') {
        console.error('Attempting emergency rollback as fallback');
        await this.performEmergencyRollback();
      }
    } finally {
      result.endTime = Date.now();
      this.rollbackInProgress = false;

      // Log rollback result
      this.monitoringService.track('rollback_completed', {
        ...result,
        duration: result.endTime - result.startTime
      });

      // Send final notification
      await this.notifyUsers('rollback_completed', {
        success: result.success,
        duration: result.endTime - result.startTime
      });
    }

    return result;
  }

  /**
   * Perform emergency rollback (immediate)
   */
  private async performEmergencyRollback() {
    console.log('Executing emergency rollback');
    
    // Immediately set feature flag to 0%
    this.featureFlagService.updateFlagPercentage('new_platform_enabled', 0);
    
    // Force refresh all active sessions
    await this.forceSessionRefresh();
    
    // Clear any cached new system data
    this.clearNewSystemCache();
    
    // Track emergency rollback
    this.monitoringService.track('emergency_rollback_executed', {
      timestamp: Date.now()
    });
  }

  /**
   * Perform gradual rollback (controlled)
   */
  private async performGradualRollback() {
    console.log('Executing gradual rollback');
    
    const steps = [100, 75, 50, 25, 10, 0];
    const currentPercentage = this.featureFlagService.getRolloutStatus('new_platform_enabled').percentage;
    
    // Find starting point
    const startIndex = steps.findIndex(step => step <= currentPercentage);
    
    for (let i = startIndex; i < steps.length; i++) {
      const targetPercentage = steps[i];
      
      // Update feature flag
      this.featureFlagService.updateFlagPercentage('new_platform_enabled', targetPercentage);
      
      // Wait for users to naturally migrate
      await this.waitForMigration(5000); // 5 seconds between steps
      
      // Check if we should continue
      const shouldContinue = await this.shouldContinueRollback();
      if (!shouldContinue) {
        console.log(`Rollback halted at ${targetPercentage}%`);
        break;
      }
    }
  }

  /**
   * Perform targeted rollback for specific user groups
   */
  private async performTargetedRollback(targetGroups: string[]) {
    console.log('Executing targeted rollback for groups:', targetGroups);
    
    // This would interact with a more sophisticated feature flag system
    // For now, we'll simulate by setting the flag to 0 for demonstration
    this.featureFlagService.updateFlagPercentage('new_platform_enabled', 0);
    
    // In a real implementation, you would:
    // 1. Update feature flag rules to exclude target groups
    // 2. Force refresh for users in target groups
    // 3. Monitor impact on targeted users
  }

  /**
   * Verify rollback was successful
   */
  private async verifyRollback(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check feature flag state
    const flagStatus = this.featureFlagService.getRolloutStatus('new_platform_enabled');
    if (flagStatus.percentage > 0) {
      errors.push(`Feature flag still at ${flagStatus.percentage}%`);
    }
    
    // Check active sessions
    const activeSessions = await this.getActiveNewSystemSessions();
    if (activeSessions > 0) {
      errors.push(`${activeSessions} sessions still on new system`);
    }
    
    // Check system health
    const health = await this.checkSystemHealth();
    if (!health.healthy) {
      errors.push('System health check failed post-rollback');
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<{
    healthy: boolean;
    criticalFailures: number;
    failedServices: string[];
  }> {
    // In a real implementation, this would check actual service health
    // For now, we'll simulate based on monitoring metrics
    const metrics = this.monitoringService.getCutoverMetrics();
    const errorRate = metrics.dashboard?.errorRates?.old || 0;
    
    return {
      healthy: errorRate < 0.01,
      criticalFailures: errorRate > 0.05 ? 1 : 0,
      failedServices: errorRate > 0.05 ? ['critical_service'] : []
    };
  }

  /**
   * Force refresh all active sessions
   */
  private async forceSessionRefresh() {
    // Broadcast refresh event
    window.dispatchEvent(new CustomEvent('system-rollback', {
      detail: { force: true }
    }));
    
    // In a real implementation, this would:
    // 1. Send WebSocket message to all connected clients
    // 2. Invalidate session tokens
    // 3. Force page reload
  }

  /**
   * Clear new system cache
   */
  private clearNewSystemCache() {
    // Clear localStorage items related to new system
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('new_system')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('new-system')) {
            caches.delete(name);
          }
        });
      });
    }
  }

  /**
   * Wait for user migration
   */
  private async waitForMigration(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Check if rollback should continue
   */
  private async shouldContinueRollback(): Promise<boolean> {
    // Check if system has stabilized
    const metrics = this.monitoringService.getCutoverMetrics();
    const errorRate = metrics.dashboard?.errorRates?.new || 0;
    
    // If error rate has dropped significantly, we might not need to continue
    return errorRate > 0.01; // Continue if error rate still above 1%
  }

  /**
   * Get count of active sessions on new system
   */
  private async getActiveNewSystemSessions(): Promise<number> {
    // In a real implementation, this would query backend
    // For now, estimate based on rollout percentage
    const status = this.featureFlagService.getRolloutStatus('new_platform_enabled');
    const totalUsers = 1000; // Assumed total
    return Math.floor((status.percentage / 100) * totalUsers);
  }

  /**
   * Get affected user count
   */
  private async getAffectedUserCount(): Promise<number> {
    // In a real implementation, this would track actual affected users
    return await this.getActiveNewSystemSessions();
  }

  /**
   * Send notification to users
   */
  private async notifyUsers(event: string, data: any) {
    // Dispatch event for UI components to handle
    window.dispatchEvent(new CustomEvent('rollback-notification', {
      detail: { event, data }
    }));
    
    // Log notification
    console.log(`Rollback notification: ${event}`, data);
    
    // In a real implementation, this would:
    // 1. Update status page
    // 2. Send emails to affected users
    // 3. Post to Slack/communication channels
  }

  /**
   * Manual rollback trigger for API endpoint
   */
  public async handleApiRollback(
    type: 'emergency' | 'gradual' | 'targeted',
    reason: string,
    metadata?: any
  ): Promise<RollbackResult> {
    // Validate request (in real app, check authorization)
    if (!reason) {
      throw new Error('Rollback reason is required');
    }
    
    return this.executeRollback({
      type,
      reason,
      metadata
    });
  }

  /**
   * Enable or disable automatic rollback
   */
  public setAutoRollback(enabled: boolean) {
    this.autoRollbackEnabled = enabled;
    
    if (enabled && !this.monitoringIntervalId) {
      this.setupAutoRollback();
    } else if (!enabled && this.monitoringIntervalId) {
      clearInterval(this.monitoringIntervalId);
      this.monitoringIntervalId = null;
    }
  }

  /**
   * Update rollback thresholds
   */
  public updateThresholds(config: {
    errorThreshold?: number;
    performanceThreshold?: number;
    checkInterval?: number;
  }) {
    if (config.errorThreshold !== undefined) {
      this.errorThreshold = config.errorThreshold;
    }
    if (config.performanceThreshold !== undefined) {
      this.performanceThreshold = config.performanceThreshold;
    }
    if (config.checkInterval !== undefined) {
      this.checkInterval = config.checkInterval;
      // Restart monitoring with new interval
      if (this.monitoringIntervalId) {
        clearInterval(this.monitoringIntervalId);
        this.setupAutoRollback();
      }
    }
  }

  /**
   * Get rollback service status
   */
  public getStatus() {
    return {
      autoRollbackEnabled: this.autoRollbackEnabled,
      rollbackInProgress: this.rollbackInProgress,
      thresholds: {
        error: this.errorThreshold,
        performance: this.performanceThreshold
      },
      checkInterval: this.checkInterval
    };
  }
}