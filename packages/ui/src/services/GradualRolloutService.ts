import { FeatureFlagService } from './FeatureFlagService';
import { MonitoringService } from './MonitoringService';
import { RollbackService } from './RollbackService';

export interface RolloutSegment {
  name: string;
  percentage: number;
  groups?: string[];
  conditions?: any[];
}

export interface RolloutSchedule {
  phase: number;
  targetPercentage: number;
  duration: number; // in milliseconds
  waitTime: number; // wait time before next phase
  segments?: RolloutSegment[];
  successCriteria?: RolloutCriteria;
}

export interface RolloutCriteria {
  maxErrorRate: number;
  minPerformance: number;
  minUserSatisfaction?: number;
  customMetrics?: Record<string, number>;
}

export interface RolloutConfig {
  strategy: 'linear' | 'exponential' | 'canary' | 'blue-green' | 'custom';
  schedule: RolloutSchedule[];
  autoAdvance: boolean;
  rollbackOnFailure: boolean;
  segments?: {
    beta: string[];
    internal: string[];
    vip: string[];
    general: string[];
  };
  globalCriteria: RolloutCriteria;
}

export class GradualRolloutService {
  private featureFlagService: FeatureFlagService;
  private monitoringService: MonitoringService;
  private rollbackService: RollbackService;
  
  private currentPhase: number = 0;
  private rolloutInProgress: boolean = false;
  private rolloutPaused: boolean = false;
  private rolloutTimer: number | null = null;
  private phaseStartTime: number = 0;
  private rolloutHistory: Array<{
    phase: number;
    percentage: number;
    timestamp: number;
    metrics: any;
    success: boolean;
  }> = [];

  constructor() {
    this.featureFlagService = new FeatureFlagService();
    this.monitoringService = new MonitoringService();
    this.rollbackService = new RollbackService();
  }

  /**
   * Create default rollout configurations
   */
  public getDefaultConfigs(): Record<string, RolloutConfig> {
    return {
      canary: this.createCanaryConfig(),
      linear: this.createLinearConfig(),
      exponential: this.createExponentialConfig(),
      blueGreen: this.createBlueGreenConfig()
    };
  }

  /**
   * Create canary deployment configuration
   */
  private createCanaryConfig(): RolloutConfig {
    return {
      strategy: 'canary',
      autoAdvance: true,
      rollbackOnFailure: true,
      schedule: [
        {
          phase: 1,
          targetPercentage: 1,
          duration: 3600000, // 1 hour
          waitTime: 300000, // 5 minutes
          segments: [
            { name: 'internal', percentage: 100, groups: ['internal_users'] }
          ],
          successCriteria: {
            maxErrorRate: 0.01,
            minPerformance: 0.9
          }
        },
        {
          phase: 2,
          targetPercentage: 5,
          duration: 7200000, // 2 hours
          waitTime: 600000, // 10 minutes
          segments: [
            { name: 'beta', percentage: 100, groups: ['beta_users'] }
          ],
          successCriteria: {
            maxErrorRate: 0.02,
            minPerformance: 0.85
          }
        },
        {
          phase: 3,
          targetPercentage: 10,
          duration: 14400000, // 4 hours
          waitTime: 900000, // 15 minutes
          successCriteria: {
            maxErrorRate: 0.03,
            minPerformance: 0.8
          }
        },
        {
          phase: 4,
          targetPercentage: 25,
          duration: 28800000, // 8 hours
          waitTime: 1800000, // 30 minutes
          successCriteria: {
            maxErrorRate: 0.04,
            minPerformance: 0.75
          }
        },
        {
          phase: 5,
          targetPercentage: 50,
          duration: 86400000, // 24 hours
          waitTime: 3600000, // 1 hour
          successCriteria: {
            maxErrorRate: 0.05,
            minPerformance: 0.7
          }
        },
        {
          phase: 6,
          targetPercentage: 100,
          duration: 172800000, // 48 hours
          waitTime: 0,
          successCriteria: {
            maxErrorRate: 0.05,
            minPerformance: 0.7
          }
        }
      ],
      segments: {
        beta: ['beta_users'],
        internal: ['internal_users', 'employees'],
        vip: ['vip_users', 'premium_users'],
        general: []
      },
      globalCriteria: {
        maxErrorRate: 0.05,
        minPerformance: 0.7,
        minUserSatisfaction: 0.8
      }
    };
  }

  /**
   * Create linear rollout configuration
   */
  private createLinearConfig(): RolloutConfig {
    const phases: RolloutSchedule[] = [];
    const increment = 10;
    
    for (let i = increment; i <= 100; i += increment) {
      phases.push({
        phase: i / increment,
        targetPercentage: i,
        duration: 3600000, // 1 hour per phase
        waitTime: 600000, // 10 minutes between phases
        successCriteria: {
          maxErrorRate: 0.05,
          minPerformance: 0.7
        }
      });
    }
    
    return {
      strategy: 'linear',
      autoAdvance: true,
      rollbackOnFailure: true,
      schedule: phases,
      globalCriteria: {
        maxErrorRate: 0.05,
        minPerformance: 0.7
      }
    };
  }

  /**
   * Create exponential rollout configuration
   */
  private createExponentialConfig(): RolloutConfig {
    return {
      strategy: 'exponential',
      autoAdvance: true,
      rollbackOnFailure: true,
      schedule: [
        {
          phase: 1,
          targetPercentage: 1,
          duration: 3600000,
          waitTime: 600000,
          successCriteria: { maxErrorRate: 0.01, minPerformance: 0.9 }
        },
        {
          phase: 2,
          targetPercentage: 2,
          duration: 3600000,
          waitTime: 600000,
          successCriteria: { maxErrorRate: 0.02, minPerformance: 0.85 }
        },
        {
          phase: 3,
          targetPercentage: 4,
          duration: 3600000,
          waitTime: 600000,
          successCriteria: { maxErrorRate: 0.03, minPerformance: 0.8 }
        },
        {
          phase: 4,
          targetPercentage: 8,
          duration: 7200000,
          waitTime: 900000,
          successCriteria: { maxErrorRate: 0.04, minPerformance: 0.75 }
        },
        {
          phase: 5,
          targetPercentage: 16,
          duration: 7200000,
          waitTime: 900000,
          successCriteria: { maxErrorRate: 0.04, minPerformance: 0.75 }
        },
        {
          phase: 6,
          targetPercentage: 32,
          duration: 14400000,
          waitTime: 1800000,
          successCriteria: { maxErrorRate: 0.05, minPerformance: 0.7 }
        },
        {
          phase: 7,
          targetPercentage: 64,
          duration: 28800000,
          waitTime: 3600000,
          successCriteria: { maxErrorRate: 0.05, minPerformance: 0.7 }
        },
        {
          phase: 8,
          targetPercentage: 100,
          duration: 86400000,
          waitTime: 0,
          successCriteria: { maxErrorRate: 0.05, minPerformance: 0.7 }
        }
      ],
      globalCriteria: {
        maxErrorRate: 0.05,
        minPerformance: 0.7
      }
    };
  }

  /**
   * Create blue-green deployment configuration
   */
  private createBlueGreenConfig(): RolloutConfig {
    return {
      strategy: 'blue-green',
      autoAdvance: false, // Manual switch for blue-green
      rollbackOnFailure: true,
      schedule: [
        {
          phase: 1,
          targetPercentage: 0,
          duration: 3600000, // Test in parallel
          waitTime: 0,
          segments: [
            { name: 'test', percentage: 0, groups: ['test_users'] }
          ],
          successCriteria: {
            maxErrorRate: 0.01,
            minPerformance: 0.95
          }
        },
        {
          phase: 2,
          targetPercentage: 100, // Full switch
          duration: 0, // Instant switch
          waitTime: 0,
          successCriteria: {
            maxErrorRate: 0.05,
            minPerformance: 0.7
          }
        }
      ],
      globalCriteria: {
        maxErrorRate: 0.05,
        minPerformance: 0.7
      }
    };
  }

  /**
   * Start gradual rollout
   */
  public async startRollout(config: RolloutConfig | string): Promise<void> {
    if (this.rolloutInProgress) {
      throw new Error('Rollout already in progress');
    }

    // Get config if string provided
    const rolloutConfig = typeof config === 'string' 
      ? this.getDefaultConfigs()[config]
      : config;
    
    if (!rolloutConfig) {
      throw new Error('Invalid rollout configuration');
    }

    this.rolloutInProgress = true;
    this.rolloutPaused = false;
    this.currentPhase = 0;
    this.rolloutHistory = [];

    // Log rollout start
    this.monitoringService.track('rollout_started', {
      strategy: rolloutConfig.strategy,
      phases: rolloutConfig.schedule.length,
      timestamp: Date.now()
    });

    // Execute rollout
    await this.executeRollout(rolloutConfig);
  }

  /**
   * Execute rollout phases
   */
  private async executeRollout(config: RolloutConfig): Promise<void> {
    for (let i = 0; i < config.schedule.length; i++) {
      if (!this.rolloutInProgress || this.rolloutPaused) {
        break;
      }

      const phase = config.schedule[i];
      this.currentPhase = phase.phase;
      this.phaseStartTime = Date.now();

      try {
        // Execute phase
        await this.executePhase(phase, config);

        // Check success criteria
        const metricsPass = await this.checkSuccessCriteria(
          phase.successCriteria || config.globalCriteria
        );

        if (!metricsPass && config.rollbackOnFailure) {
          console.error('Phase failed success criteria, triggering rollback');
          await this.triggerRollback('criteria_failure', phase);
          break;
        }

        // Record phase completion
        this.recordPhaseCompletion(phase, true);

        // Wait before next phase
        if (phase.waitTime > 0 && i < config.schedule.length - 1) {
          await this.wait(phase.waitTime);
        }

        // Auto-advance check
        if (!config.autoAdvance && i < config.schedule.length - 1) {
          console.log('Waiting for manual approval to continue rollout');
          this.rolloutPaused = true;
          break;
        }

      } catch (error) {
        console.error('Error during rollout phase:', error);
        
        if (config.rollbackOnFailure) {
          await this.triggerRollback('phase_error', phase);
        }
        
        this.recordPhaseCompletion(phase, false);
        break;
      }
    }

    // Mark rollout complete
    if (this.currentPhase === config.schedule[config.schedule.length - 1].phase) {
      this.completeRollout();
    }
  }

  /**
   * Execute a single rollout phase
   */
  private async executePhase(phase: RolloutSchedule, config: RolloutConfig): Promise<void> {
    console.log(`Executing rollout phase ${phase.phase}: ${phase.targetPercentage}%`);

    // Update feature flag percentage
    this.featureFlagService.updateFlagPercentage('new_platform_enabled', phase.targetPercentage);

    // Apply segment-specific rollout if defined
    if (phase.segments) {
      for (const segment of phase.segments) {
        await this.applySegmentRollout(segment);
      }
    }

    // Monitor phase for duration
    if (phase.duration > 0) {
      await this.monitorPhase(phase.duration, phase.successCriteria);
    }

    // Track phase execution
    this.monitoringService.track('rollout_phase_completed', {
      phase: phase.phase,
      percentage: phase.targetPercentage,
      duration: Date.now() - this.phaseStartTime
    });
  }

  /**
   * Apply rollout to specific segment
   */
  private async applySegmentRollout(segment: RolloutSegment): Promise<void> {
    console.log(`Applying rollout to segment: ${segment.name} (${segment.percentage}%)`);
    
    // In a real implementation, this would update segment-specific rules
    // For now, we'll track the segment rollout
    this.monitoringService.track('segment_rollout', {
      segment: segment.name,
      percentage: segment.percentage,
      groups: segment.groups,
      timestamp: Date.now()
    });
  }

  /**
   * Monitor phase for success criteria
   */
  private async monitorPhase(duration: number, criteria?: RolloutCriteria): Promise<void> {
    const checkInterval = Math.min(30000, duration / 10); // Check every 30s or 10% of duration
    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      if (!this.rolloutInProgress || this.rolloutPaused) {
        break;
      }

      // Check metrics
      if (criteria) {
        const metricsPass = await this.checkSuccessCriteria(criteria);
        if (!metricsPass) {
          throw new Error('Success criteria not met during monitoring');
        }
      }

      // Wait for next check
      await this.wait(checkInterval);
    }
  }

  /**
   * Check if success criteria are met
   */
  private async checkSuccessCriteria(criteria: RolloutCriteria): Promise<boolean> {
    const metrics = this.monitoringService.getCutoverMetrics();
    const dashboard = metrics.dashboard;

    // Check error rate
    if (dashboard.errorRates?.new > criteria.maxErrorRate) {
      console.warn(`Error rate ${dashboard.errorRates.new} exceeds threshold ${criteria.maxErrorRate}`);
      return false;
    }

    // Check performance (inverse - lower is better)
    const performanceRatio = dashboard.performanceMetrics?.old / dashboard.performanceMetrics?.new;
    if (performanceRatio < criteria.minPerformance) {
      console.warn(`Performance ratio ${performanceRatio} below threshold ${criteria.minPerformance}`);
      return false;
    }

    // Check custom metrics if provided
    if (criteria.customMetrics) {
      for (const [metric, threshold] of Object.entries(criteria.customMetrics)) {
        // Custom metric checking would go here
        console.log(`Checking custom metric: ${metric} >= ${threshold}`);
      }
    }

    return true;
  }

  /**
   * Trigger rollback during rollout
   */
  private async triggerRollback(reason: string, phase: RolloutSchedule): Promise<void> {
    console.error(`Triggering rollback: ${reason} at phase ${phase.phase}`);

    // Stop rollout
    this.stopRollout();

    // Execute rollback
    await this.rollbackService.executeRollback({
      reason: `rollout_${reason}`,
      type: 'gradual',
      metadata: {
        phase: phase.phase,
        percentage: phase.targetPercentage,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Record phase completion
   */
  private recordPhaseCompletion(phase: RolloutSchedule, success: boolean): void {
    const metrics = this.monitoringService.getCutoverMetrics();
    
    this.rolloutHistory.push({
      phase: phase.phase,
      percentage: phase.targetPercentage,
      timestamp: Date.now(),
      metrics: metrics.dashboard,
      success
    });
  }

  /**
   * Complete rollout
   */
  private completeRollout(): void {
    this.rolloutInProgress = false;
    
    // Track completion
    this.monitoringService.track('rollout_completed', {
      totalPhases: this.currentPhase,
      duration: Date.now() - this.rolloutHistory[0]?.timestamp,
      finalPercentage: this.featureFlagService.getRolloutStatus('new_platform_enabled').percentage,
      history: this.rolloutHistory
    });

    console.log('Rollout completed successfully');
  }

  /**
   * Pause rollout
   */
  public pauseRollout(): void {
    if (!this.rolloutInProgress) {
      throw new Error('No rollout in progress');
    }
    
    this.rolloutPaused = true;
    console.log('Rollout paused');
    
    this.monitoringService.track('rollout_paused', {
      phase: this.currentPhase,
      timestamp: Date.now()
    });
  }

  /**
   * Resume rollout
   */
  public async resumeRollout(): Promise<void> {
    if (!this.rolloutInProgress || !this.rolloutPaused) {
      throw new Error('No paused rollout to resume');
    }
    
    this.rolloutPaused = false;
    console.log('Rollout resumed');
    
    this.monitoringService.track('rollout_resumed', {
      phase: this.currentPhase,
      timestamp: Date.now()
    });
  }

  /**
   * Stop rollout
   */
  public stopRollout(): void {
    this.rolloutInProgress = false;
    this.rolloutPaused = false;
    
    if (this.rolloutTimer) {
      clearTimeout(this.rolloutTimer);
      this.rolloutTimer = null;
    }
    
    console.log('Rollout stopped');
    
    this.monitoringService.track('rollout_stopped', {
      phase: this.currentPhase,
      timestamp: Date.now()
    });
  }

  /**
   * Get rollout status
   */
  public getRolloutStatus() {
    return {
      inProgress: this.rolloutInProgress,
      paused: this.rolloutPaused,
      currentPhase: this.currentPhase,
      phaseStartTime: this.phaseStartTime,
      history: this.rolloutHistory,
      currentPercentage: this.featureFlagService.getRolloutStatus('new_platform_enabled').percentage
    };
  }

  /**
   * Wait for specified duration
   */
  private wait(duration: number): Promise<void> {
    return new Promise(resolve => {
      this.rolloutTimer = window.setTimeout(resolve, duration);
    });
  }
}