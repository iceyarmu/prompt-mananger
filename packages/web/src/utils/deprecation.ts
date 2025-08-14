/**
 * Deprecation utilities for old system components
 */

interface DeprecationConfig {
  component: string;
  version: string;
  removeBy: string;
  alternative?: string;
  documentation?: string;
}

class DeprecationManager {
  private static instance: DeprecationManager;
  private deprecatedComponents: Map<string, DeprecationConfig> = new Map();
  private warningsShown: Set<string> = new Set();
  private logLevel: 'none' | 'console' | 'error' = 'console';

  private constructor() {
    this.initializeDeprecations();
  }

  public static getInstance(): DeprecationManager {
    if (!DeprecationManager.instance) {
      DeprecationManager.instance = new DeprecationManager();
    }
    return DeprecationManager.instance;
  }

  private initializeDeprecations() {
    // Register all deprecated components
    this.registerDeprecation({
      component: 'AppContentLegacy',
      version: '2.0.0',
      removeBy: '3.0.0',
      alternative: 'AppContent',
      documentation: '/docs/migration/app-content.md'
    });

    this.registerDeprecation({
      component: 'FileTreeLegacy',
      version: '2.0.0',
      removeBy: '3.0.0',
      alternative: 'FileTree',
      documentation: '/docs/migration/file-tree.md'
    });

    this.registerDeprecation({
      component: 'MarkdownEditorLegacy',
      version: '2.0.0',
      removeBy: '3.0.0',
      alternative: 'MarkdownEditor',
      documentation: '/docs/migration/markdown-editor.md'
    });

    this.registerDeprecation({
      component: 'AppLayoutLegacy',
      version: '2.0.0',
      removeBy: '3.0.0',
      alternative: 'AppLayout',
      documentation: '/docs/migration/app-layout.md'
    });
  }

  public registerDeprecation(config: DeprecationConfig) {
    this.deprecatedComponents.set(config.component, config);
  }

  public checkDeprecation(componentName: string): void {
    const config = this.deprecatedComponents.get(componentName);
    if (!config) return;

    // Only show warning once per component per session
    if (this.warningsShown.has(componentName)) return;
    this.warningsShown.add(componentName);

    const message = this.formatDeprecationMessage(config);
    
    switch (this.logLevel) {
      case 'console':
        console.warn(message);
        this.logToMonitoring(componentName, config);
        break;
      case 'error':
        console.error(message);
        throw new Error(message);
      case 'none':
        // Silent mode, only log to monitoring
        this.logToMonitoring(componentName, config);
        break;
    }
  }

  private formatDeprecationMessage(config: DeprecationConfig): string {
    let message = `⚠️ DEPRECATION WARNING: "${config.component}" is deprecated as of version ${config.version} and will be removed in version ${config.removeBy}.`;
    
    if (config.alternative) {
      message += `\n   Please use "${config.alternative}" instead.`;
    }
    
    if (config.documentation) {
      message += `\n   Migration guide: ${config.documentation}`;
    }
    
    message += '\n   Stack trace:';
    
    return message;
  }

  private logToMonitoring(componentName: string, config: DeprecationConfig) {
    // Send deprecation usage to monitoring
    if ((window as any).monitoringService) {
      (window as any).monitoringService.track('deprecated_component_used', {
        component: componentName,
        deprecatedIn: config.version,
        removeBy: config.removeBy,
        alternative: config.alternative,
        timestamp: Date.now()
      });
    }
  }

  public setLogLevel(level: 'none' | 'console' | 'error') {
    this.logLevel = level;
  }

  public getDeprecatedComponents(): DeprecationConfig[] {
    return Array.from(this.deprecatedComponents.values());
  }

  public isDeprecated(componentName: string): boolean {
    return this.deprecatedComponents.has(componentName);
  }

  public getDeprecationTimeline(): Record<string, DeprecationConfig[]> {
    const timeline: Record<string, DeprecationConfig[]> = {};
    
    this.deprecatedComponents.forEach(config => {
      if (!timeline[config.removeBy]) {
        timeline[config.removeBy] = [];
      }
      timeline[config.removeBy].push(config);
    });
    
    return timeline;
  }
}

/**
 * Deprecation decorator for Vue components
 */
export function deprecated(config?: Partial<DeprecationConfig>) {
  return function(target: any) {
    const originalMounted = target.mounted || target.onMounted;
    
    const newMounted = function(this: any) {
      const manager = DeprecationManager.getInstance();
      const componentName = target.name || this.$options?.name || 'Unknown';
      
      // Check if component is registered as deprecated
      manager.checkDeprecation(componentName);
      
      // Call original mounted hook if exists
      if (originalMounted) {
        originalMounted.call(this);
      }
    };
    
    if (target.mounted) {
      target.mounted = newMounted;
    } else {
      target.onMounted = newMounted;
    }
    
    return target;
  };
}

/**
 * Composable for checking deprecation status
 */
export function useDeprecation() {
  const manager = DeprecationManager.getInstance();
  
  return {
    checkDeprecation: (componentName: string) => manager.checkDeprecation(componentName),
    isDeprecated: (componentName: string) => manager.isDeprecated(componentName),
    getTimeline: () => manager.getDeprecationTimeline(),
    setLogLevel: (level: 'none' | 'console' | 'error') => manager.setLogLevel(level)
  };
}

/**
 * Graceful degradation helper
 */
export class GracefulDegradation {
  private static fallbacks: Map<string, () => any> = new Map();

  public static registerFallback(feature: string, fallback: () => any) {
    this.fallbacks.set(feature, fallback);
  }

  public static async execute<T>(
    feature: string,
    primaryAction: () => Promise<T>,
    fallbackAction?: () => Promise<T>
  ): Promise<T | null> {
    try {
      return await primaryAction();
    } catch (error) {
      console.warn(`Feature "${feature}" failed, attempting graceful degradation`, error);
      
      // Try custom fallback if provided
      if (fallbackAction) {
        try {
          return await fallbackAction();
        } catch (fallbackError) {
          console.error(`Fallback for "${feature}" also failed`, fallbackError);
        }
      }
      
      // Try registered fallback
      const registeredFallback = this.fallbacks.get(feature);
      if (registeredFallback) {
        try {
          return await registeredFallback();
        } catch (registeredError) {
          console.error(`Registered fallback for "${feature}" failed`, registeredError);
        }
      }
      
      // Return null if all fallbacks fail
      return null;
    }
  }

  public static wrap<T extends (...args: any[]) => any>(
    feature: string,
    fn: T,
    fallback?: T
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(
        feature,
        () => fn(...args),
        fallback ? () => fallback(...args) : undefined
      );
    }) as T;
  }
}

// Export singleton instance
export const deprecationManager = DeprecationManager.getInstance();