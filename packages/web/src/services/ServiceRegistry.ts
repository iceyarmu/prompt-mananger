import {
  StorageFactory,
  ModelManager,
  TemplateManager,
  HistoryManager,
  DataManager,
  LLMService,
  PromptService,
  PreferenceService,
  CompareService,
  ElectronModelManagerProxy,
  ElectronTemplateManagerProxy,
  ElectronHistoryManagerProxy,
  ElectronDataManagerProxy,
  ElectronLLMProxy,
  ElectronPromptServiceProxy,
  ElectronPreferenceServiceProxy,
  DexieStorageProvider
} from '@prompt-optimizer/core'
import type { ApplicationConfig } from '../types/application'
import { createLogger } from '../utils/logger'

const logger = createLogger('ServiceRegistry')

export interface ServiceHealthCheck {
  service: string
  healthy: boolean
  message?: string
  error?: Error
}

export interface ServiceRegistry {
  storageService: any // StorageService type from core
  preferenceService: PreferenceService
  webDAVService?: any // WebDAV service when implemented
  modelService: ModelManager
  templateService: TemplateManager
  optimizationService: PromptService
  executionService: LLMService
  historyService: HistoryManager
  dataService: DataManager
  compareService: CompareService
  performHealthChecks: () => Promise<ServiceHealthCheck[]>
  cleanup: () => void // Made required for consistency
  isInitialized: boolean // Added to track initialization state
}

/**
 * Initialize all services in the correct order based on dependencies
 */
export async function initializeServices(config: ApplicationConfig): Promise<ServiceRegistry> {
  logger.info('Starting service initialization sequence')
  
  const isElectron = !!(window as any).electron
  
  try {
    // 1. Initialize StorageService (foundational)
    logger.debug('Initializing StorageService...')
    const storageProvider = new DexieStorageProvider()
    await storageProvider.initialize()
    const storageService = StorageFactory.create(storageProvider)
    logger.info('StorageService initialized')
    
    // 2. Initialize PreferenceService (loads configuration)
    logger.debug('Initializing PreferenceService...')
    const preferenceService = isElectron 
      ? new ElectronPreferenceServiceProxy()
      : new PreferenceService(storageService)
    
    if (!isElectron) {
      await preferenceService.init()
    }
    logger.info('PreferenceService initialized')
    
    // 3. Initialize WebDAVService (if configured)
    let webDAVService
    if (config.webdav.enabled && config.webdav.url) {
      logger.debug('Initializing WebDAVService...')
      // TODO: Implement WebDAV service initialization
      logger.warn('WebDAV service not yet implemented')
    }
    
    // 4. Initialize ModelService (loads AI models)
    logger.debug('Initializing ModelService...')
    const modelService = isElectron
      ? new ElectronModelManagerProxy()
      : new ModelManager(storageService)
    
    if (!isElectron) {
      await modelService.init()
    }
    logger.info('ModelService initialized')
    
    // 5. Initialize TemplateService (loads templates)
    logger.debug('Initializing TemplateService...')
    const templateService = isElectron
      ? new ElectronTemplateManagerProxy()
      : new TemplateManager(storageService)
    
    if (!isElectron) {
      await templateService.init()
    }
    logger.info('TemplateService initialized')
    
    // 6. Initialize OptimizationService (PromptService)
    logger.debug('Initializing OptimizationService...')
    const optimizationService = isElectron
      ? new ElectronPromptServiceProxy()
      : new PromptService(
          modelService,
          templateService,
          preferenceService,
          storageService
        )
    logger.info('OptimizationService initialized')
    
    // 7. Initialize ExecutionService (LLMService)
    logger.debug('Initializing ExecutionService...')
    const executionService = isElectron
      ? new ElectronLLMProxy()
      : new LLMService(modelService, preferenceService)
    logger.info('ExecutionService initialized')
    
    // 8. Initialize HistoryService
    logger.debug('Initializing HistoryService...')
    const historyService = isElectron
      ? new ElectronHistoryManagerProxy()
      : new HistoryManager(storageService)
    
    if (!isElectron) {
      await historyService.init()
    }
    logger.info('HistoryService initialized')
    
    // 9. Initialize DataService
    logger.debug('Initializing DataService...')
    const dataService = isElectron
      ? new ElectronDataManagerProxy()
      : new DataManager(storageService)
    
    if (!isElectron) {
      await dataService.init()
    }
    logger.info('DataService initialized')
    
    // 10. Initialize CompareService
    logger.debug('Initializing CompareService...')
    const compareService = new CompareService()
    logger.info('CompareService initialized')
    
    logger.info('All services initialized successfully')
    
    // Create service registry
    const registry: ServiceRegistry = {
      storageService,
      preferenceService,
      webDAVService,
      modelService,
      templateService,
      optimizationService,
      executionService,
      historyService,
      dataService,
      compareService,
      performHealthChecks: async () => performHealthChecks(registry),
      cleanup: () => cleanupServices(registry),
      isInitialized: true
    }
    
    return registry
    
  } catch (error) {
    logger.error('Failed to initialize services', error)
    // Provide more context in the error
    const enhancedError = new Error(
      `Service initialization failed: ${(error as Error).message}`
    )
    ;(enhancedError as any).originalError = error
    ;(enhancedError as any).timestamp = Date.now()
    throw enhancedError
  }
}

/**
 * Perform health checks on all services
 */
async function performHealthChecks(registry: ServiceRegistry): Promise<ServiceHealthCheck[]> {
  logger.debug('Performing service health checks')
  
  const checks: ServiceHealthCheck[] = []
  
  // Check StorageService
  try {
    // Basic check - try to access storage
    await registry.storageService.get('health_check_test')
    checks.push({
      service: 'StorageService',
      healthy: true
    })
  } catch (error) {
    checks.push({
      service: 'StorageService',
      healthy: false,
      message: 'Failed to access storage',
      error: error as Error
    })
  }
  
  // Check PreferenceService
  try {
    // Check if preferences can be accessed
    const prefs = await registry.preferenceService.getPreferences()
    checks.push({
      service: 'PreferenceService',
      healthy: true
    })
  } catch (error) {
    checks.push({
      service: 'PreferenceService',
      healthy: false,
      message: 'Failed to access preferences',
      error: error as Error
    })
  }
  
  // Check ModelService
  try {
    const models = await registry.modelService.getInstalledModels()
    checks.push({
      service: 'ModelService',
      healthy: true,
      message: `${models.length} models available`
    })
  } catch (error) {
    checks.push({
      service: 'ModelService',
      healthy: false,
      message: 'Failed to access models',
      error: error as Error
    })
  }
  
  // Check TemplateService
  try {
    const templates = await registry.templateService.getTemplates()
    checks.push({
      service: 'TemplateService',
      healthy: true,
      message: `${templates.length} templates available`
    })
  } catch (error) {
    checks.push({
      service: 'TemplateService',
      healthy: false,
      message: 'Failed to access templates',
      error: error as Error
    })
  }
  
  // Check HistoryService
  try {
    const history = await registry.historyService.getHistory()
    checks.push({
      service: 'HistoryService',
      healthy: true,
      message: `${history.length} history items`
    })
  } catch (error) {
    checks.push({
      service: 'HistoryService',
      healthy: false,
      message: 'Failed to access history',
      error: error as Error
    })
  }
  
  // WebDAV service (if enabled)
  if (registry.webDAVService) {
    try {
      // TODO: Implement WebDAV health check
      checks.push({
        service: 'WebDAVService',
        healthy: false,
        message: 'Not implemented'
      })
    } catch (error) {
      checks.push({
        service: 'WebDAVService',
        healthy: false,
        error: error as Error
      })
    }
  }
  
  logger.info('Health checks completed', {
    total: checks.length,
    healthy: checks.filter(c => c.healthy).length,
    unhealthy: checks.filter(c => !c.healthy).length
  })
  
  return checks
}

/**
 * Cleanup services on application shutdown
 */
function cleanupServices(registry: ServiceRegistry): void {
  logger.info('Cleaning up services')
  
  try {
    // Cleanup in reverse order of initialization
    // Most services don't need explicit cleanup in web environment
    // but this provides a hook for future needs
    
    logger.info('Services cleaned up successfully')
  } catch (error) {
    logger.error('Error during service cleanup', error)
  }
}