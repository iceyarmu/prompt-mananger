export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetGroups?: string[];
  conditions?: FeatureFlagCondition[];
}

export interface FeatureFlagCondition {
  type: 'user_attribute' | 'browser' | 'date_range' | 'custom';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private userId: string;
  private userGroups: string[] = [];
  private userAttributes: Record<string, any> = {};
  
  constructor() {
    this.userId = this.getUserId();
    this.loadFeatureFlags();
    this.setupEventListeners();
  }
  
  private async loadFeatureFlags() {
    try {
      // In production, load from your feature flag service
      const response = await fetch('/api/feature-flags', {
        headers: {
          'X-User-ID': this.userId
        }
      });
      
      const flags = await response.json();
      flags.forEach((flag: FeatureFlag) => {
        this.flags.set(flag.key, flag);
      });
      
      // Set up real-time updates
      this.setupRealtimeUpdates();
    } catch (error) {
      console.warn('Failed to load feature flags:', error);
      // Fall back to default flags
      this.loadDefaultFlags();
    }
  }
  
  private loadDefaultFlags() {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'webdav_integration',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'advanced_editor',
        enabled: true,
        rolloutPercentage: 80
      },
      {
        key: 'ai_execution',
        enabled: true,
        rolloutPercentage: 50,
        targetGroups: ['beta_users', 'power_users']
      },
      {
        key: 'dark_mode',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'batch_operations',
        enabled: true,
        rolloutPercentage: 70,
        conditions: [
          {
            type: 'browser',
            operator: 'contains',
            value: 'Chrome'
          }
        ]
      },
      {
        key: 'performance_monitoring',
        enabled: true,
        rolloutPercentage: 30
      },
      {
        key: 'new_optimization_engine',
        enabled: false,
        rolloutPercentage: 0
      }
    ];
    
    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }
  
  private setupRealtimeUpdates() {
    // WebSocket connection for real-time flag updates
    const ws = new WebSocket('wss://api.example.com/feature-flags');
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'flag_update') {
        this.flags.set(update.flag.key, update.flag);
        this.notifyListeners(update.flag.key);
      }
    };
    
    ws.onerror = (error) => {
      console.error('Feature flag WebSocket error:', error);
    };
  }
  
  private setupEventListeners() {
    // Listen for user changes
    window.addEventListener('user-login', (event: any) => {
      this.userId = event.detail.userId;
      this.userGroups = event.detail.groups || [];
      this.userAttributes = event.detail.attributes || {};
      this.loadFeatureFlags();
    });
    
    window.addEventListener('user-logout', () => {
      this.userId = this.getUserId();
      this.userGroups = [];
      this.userAttributes = {};
      this.loadFeatureFlags();
    });
  }
  
  isEnabled(flagKey: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      console.warn(`Feature flag not found: ${flagKey}`);
      this.trackFlagEvaluation(flagKey, false, 'not_found');
      return false;
    }
    
    // Check if globally disabled
    if (!flag.enabled) {
      this.trackFlagEvaluation(flagKey, false, 'globally_disabled');
      return false;
    }
    
    // Check rollout percentage
    const userHash = this.hashUserId(this.userId);
    const userPercentile = (userHash % 100) + 1;
    
    if (userPercentile > flag.rolloutPercentage) {
      this.trackFlagEvaluation(flagKey, false, 'rollout_percentage');
      return false;
    }
    
    // Check target groups
    if (flag.targetGroups && flag.targetGroups.length > 0) {
      const hasTargetGroup = flag.targetGroups.some(group => 
        this.userGroups.includes(group)
      );
      
      if (!hasTargetGroup) {
        this.trackFlagEvaluation(flagKey, false, 'target_group');
        return false;
      }
    }
    
    // Check conditions
    if (flag.conditions && flag.conditions.length > 0) {
      const conditionsMet = flag.conditions.every(condition => 
        this.evaluateCondition(condition)
      );
      
      if (!conditionsMet) {
        this.trackFlagEvaluation(flagKey, false, 'conditions');
        return false;
      }
    }
    
    this.trackFlagEvaluation(flagKey, true, 'enabled');
    return true;
  }
  
  private evaluateCondition(condition: FeatureFlagCondition): boolean {
    switch (condition.type) {
      case 'user_attribute':
        return this.evaluateUserAttribute(condition);
      
      case 'browser':
        return this.evaluateBrowser(condition);
      
      case 'date_range':
        return this.evaluateDateRange(condition);
      
      case 'custom':
        return this.evaluateCustom(condition);
      
      default:
        return false;
    }
  }
  
  private evaluateUserAttribute(condition: FeatureFlagCondition): boolean {
    const attributeValue = this.userAttributes[condition.value.attribute];
    
    switch (condition.operator) {
      case 'equals':
        return attributeValue === condition.value.value;
      
      case 'contains':
        return String(attributeValue).includes(condition.value.value);
      
      case 'greater_than':
        return Number(attributeValue) > Number(condition.value.value);
      
      case 'less_than':
        return Number(attributeValue) < Number(condition.value.value);
      
      default:
        return false;
    }
  }
  
  private evaluateBrowser(condition: FeatureFlagCondition): boolean {
    const userAgent = navigator.userAgent;
    
    switch (condition.operator) {
      case 'contains':
        return userAgent.includes(condition.value);
      
      case 'equals':
        return userAgent === condition.value;
      
      default:
        return false;
    }
  }
  
  private evaluateDateRange(condition: FeatureFlagCondition): boolean {
    const now = new Date();
    const startDate = new Date(condition.value.start);
    const endDate = new Date(condition.value.end);
    
    return now >= startDate && now <= endDate;
  }
  
  private evaluateCustom(condition: FeatureFlagCondition): boolean {
    // Custom evaluation logic
    if (typeof condition.value === 'function') {
      return condition.value(this.userId, this.userAttributes);
    }
    return false;
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private getUserId(): string {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('userId', userId);
    }
    return userId;
  }
  
  private getUserGroups(): string[] {
    // In production, this would come from your auth service
    return this.userGroups;
  }
  
  private trackFlagEvaluation(flagKey: string, enabled: boolean, reason: string) {
    // Send analytics about flag evaluation
    if ((window as any).analytics) {
      (window as any).analytics.track('feature_flag_evaluated', {
        flag: flagKey,
        enabled,
        reason,
        userId: this.userId,
        timestamp: Date.now()
      });
    }
  }
  
  // Listener management
  private listeners: Map<string, Set<Function>> = new Map();
  
  onFlagChange(flagKey: string, callback: Function) {
    if (!this.listeners.has(flagKey)) {
      this.listeners.set(flagKey, new Set());
    }
    this.listeners.get(flagKey)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(flagKey)?.delete(callback);
    };
  }
  
  private notifyListeners(flagKey: string) {
    const callbacks = this.listeners.get(flagKey);
    if (callbacks) {
      callbacks.forEach(callback => callback(this.isEnabled(flagKey)));
    }
  }
  
  // Public API
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }
  
  getFlag(flagKey: string): FeatureFlag | undefined {
    return this.flags.get(flagKey);
  }
  
  setUserGroups(groups: string[]) {
    this.userGroups = groups;
  }
  
  setUserAttributes(attributes: Record<string, any>) {
    this.userAttributes = attributes;
  }
  
  // A/B Testing support
  getVariant(experimentKey: string): string {
    const userHash = this.hashUserId(this.userId + experimentKey);
    const variants = ['control', 'variant_a', 'variant_b'];
    const variantIndex = userHash % variants.length;
    
    this.trackFlagEvaluation(experimentKey, true, `variant_${variants[variantIndex]}`);
    return variants[variantIndex];
  }
  
  // Vue directive
  static createDirective() {
    return {
      mounted(el: HTMLElement, binding: { value: string }) {
        const flagService = new FeatureFlagService();
        if (!flagService.isEnabled(binding.value)) {
          el.style.display = 'none';
        }
        
        // Listen for changes
        flagService.onFlagChange(binding.value, (enabled: boolean) => {
          el.style.display = enabled ? '' : 'none';
        });
      }
    };
  }
}

// Vue composable
export function useFeatureFlags() {
  const flagService = new FeatureFlagService();
  
  return {
    isEnabled: (flagKey: string) => flagService.isEnabled(flagKey),
    whenEnabled: (flagKey: string, callback: () => void) => {
      if (flagService.isEnabled(flagKey)) {
        callback();
      }
    },
    getVariant: (experimentKey: string) => flagService.getVariant(experimentKey),
    onFlagChange: (flagKey: string, callback: Function) => 
      flagService.onFlagChange(flagKey, callback)
  };
}