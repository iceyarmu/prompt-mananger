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
import { WebDAVService } from './WebDAVService'
import { FileOperationsService } from './FileOperationsService'
import { EditorService } from './EditorService'
import { EditorOptimizationBridge } from './EditorOptimizationBridge'

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
  webDAVService?: WebDAVService // WebDAV service when implemented
  fileOperationsService: FileOperationsService // File operations service
  editorService: EditorService // Editor service
  modelService: ModelManager
  templateService: TemplateManager
  optimizationService: PromptService
  executionService: LLMService
  historyService: HistoryManager
  dataService: DataManager
  compareService: CompareService
  editorOptimizationBridge: EditorOptimizationBridge // Bridge between editor and optimization
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
    const storageService = StorageFactory.create('dexie')
    const storageProvider = storageService as DexieStorageProvider
    await storageProvider.initialize()
    logger.info('StorageService initialized')
    
    // 2. Initialize PreferenceService (loads configuration)
    logger.debug('Initializing PreferenceService...')
    const preferenceService = isElectron 
      ? new ElectronPreferenceServiceProxy()
      : new PreferenceService(storageService)
    
    // PreferenceService doesn't have an init method - it's initialized via constructor
    logger.info('PreferenceService initialized')
    
    // 3. Initialize WebDAVService (if configured)
    let webDAVService: WebDAVService | undefined
    if (config.webdav.enabled && config.webdav.url) {
      logger.debug('Initializing WebDAVService...')
      try {
        webDAVService = new WebDAVService(config.webdav)
        await webDAVService.init()
        logger.info('WebDAVService initialized')
      } catch (error) {
        logger.error('Failed to initialize WebDAVService', error)
        // WebDAV is optional, so we continue without it
        logger.warn('Continuing without WebDAV service')
      }
    }
    
    // 4. Initialize FileOperationsService (file handling)
    logger.debug('Initializing FileOperationsService...')
    const fileOperationsService = new FileOperationsService(storageService, webDAVService)
    logger.info('FileOperationsService initialized')
    
    // 5. Initialize EditorService (editor functionality)
    logger.debug('Initializing EditorService...')
    const editorService = new EditorService(preferenceService, fileOperationsService)
    await editorService.init()
    logger.info('EditorService initialized')
    
    // 6. Initialize ModelService (loads AI models)
    logger.debug('Initializing ModelService...')
    const modelService = isElectron
      ? new ElectronModelManagerProxy()
      : new ModelManager(storageService)
    
    if (!isElectron) {
      await modelService.init()
    }
    logger.info('ModelService initialized')
    
    // 7. Initialize TemplateService (loads templates)
    logger.debug('Initializing TemplateService...')
    const templateService = isElectron
      ? new ElectronTemplateManagerProxy()
      : new TemplateManager(storageService)
    
    // TemplateManager doesn't have an init method - it's initialized via constructor
    logger.info('TemplateService initialized')
    
    // Note: We need to initialize ExecutionService (LLMService) before OptimizationService
    // because PromptService depends on LLMService
    
    // 8. Initialize ExecutionService (LLMService) - moved before OptimizationService
    logger.debug('Initializing ExecutionService...')
    const executionService = isElectron
      ? new ElectronLLMProxy()
      : new LLMService(modelService, preferenceService)
    logger.info('ExecutionService initialized')
    
    // 9. Initialize HistoryService - moved before OptimizationService
    logger.debug('Initializing HistoryService...')
    const historyService = isElectron
      ? new ElectronHistoryManagerProxy()
      : new HistoryManager(storageService, modelService)
    // HistoryManager doesn't have an init method - it's initialized via constructor
    logger.info('HistoryService initialized')
    
    // 10. Initialize OptimizationService (PromptService) - now with correct dependencies
    logger.debug('Initializing OptimizationService...')
    const optimizationService = isElectron
      ? new ElectronPromptServiceProxy()
      : new PromptService(
          modelService,      // IModelManager
          executionService,  // ILLMService
          templateService,   // ITemplateManager
          historyService     // IHistoryManager
        )
    logger.info('OptimizationService initialized')
    
    // 9. Initialize EditorOptimizationBridge (connects editor and optimization)
    logger.debug('Initializing EditorOptimizationBridge...')
    const editorOptimizationBridge = new EditorOptimizationBridge(editorService, optimizationService)
    await editorOptimizationBridge.init()
    logger.info('EditorOptimizationBridge initialized')
    
    // 11. Initialize DataService
    logger.debug('Initializing DataService...')
    const dataService = isElectron
      ? new ElectronDataManagerProxy()
      : new DataManager(storageService)
    
    // DataManager doesn't have an init method - it's initialized via constructor
    logger.info('DataService initialized')
    
    // 12. Initialize CompareService
    logger.debug('Initializing CompareService...')
    const compareService = new CompareService()
    logger.info('CompareService initialized')
    
    logger.info('All services initialized successfully')
    
    // Create service registry
    const registry: ServiceRegistry = {
      storageService,
      preferenceService,
      webDAVService,
      fileOperationsService,
      editorService,
      modelService,
      templateService,
      optimizationService,
      executionService,
      historyService,
      dataService,
      compareService,
      editorOptimizationBridge,
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
    // Basic check - try to access storage using getItem method
    await registry.storageService.getItem('health_check_test')
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
    // Check if preferences can be accessed - use getAll() instead of non-existent getPreferences()
    const prefs = await registry.preferenceService.getAll()
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
    const models = await registry.modelService.getAllModels()
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
    const templates = await registry.templateService.listTemplates()
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
    const history = await registry.historyService.getRecords()
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
  
  // FileOperationsService
  try {
    const healthy = await registry.fileOperationsService.checkHealth()
    checks.push({
      service: 'FileOperationsService',
      healthy,
      message: healthy ? 'File operations available' : 'File operations unavailable'
    })
  } catch (error) {
    checks.push({
      service: 'FileOperationsService',
      healthy: false,
      message: 'Failed to check file operations',
      error: error as Error
    })
  }
  
  // EditorService
  try {
    const healthy = await registry.editorService.checkHealth()
    checks.push({
      service: 'EditorService',
      healthy,
      message: healthy ? 'Editor service available' : 'Editor service unavailable'
    })
  } catch (error) {
    checks.push({
      service: 'EditorService',
      healthy: false,
      message: 'Failed to check editor service',
      error: error as Error
    })
  }
  
  // EditorOptimizationBridge
  try {
    const healthy = await registry.editorOptimizationBridge.checkHealth()
    checks.push({
      service: 'EditorOptimizationBridge',
      healthy,
      message: healthy ? 'Editor-optimization bridge available' : 'Editor-optimization bridge unavailable'
    })
  } catch (error) {
    checks.push({
      service: 'EditorOptimizationBridge',
      healthy: false,
      message: 'Failed to check editor-optimization bridge',
      error: error as Error
    })
  }
  
  // WebDAV service (if enabled)
  if (registry.webDAVService) {
    try {
      const healthy = await registry.webDAVService.checkHealth()
      const status = registry.webDAVService.getConnectionStatus()
      checks.push({
        service: 'WebDAVService',
        healthy,
        message: healthy ? `Connected to ${status.url}` : status.error
      })
    } catch (error) {
      checks.push({
        service: 'WebDAVService',
        healthy: false,
        message: 'Health check failed',
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
    // Cleanup in reverse order of initialization to respect dependencies
    
    // Cleanup EditorOptimizationBridge (no explicit cleanup method, but good practice)
    // The bridge doesn't have a cleanup method currently
    
    // Cleanup EditorService
    if (registry.editorService?.cleanup) {
      registry.editorService.cleanup()
      logger.debug('EditorService cleaned up')
    }
    
    // Cleanup FileOperationsService (no explicit cleanup needed)
    
    // Cleanup WebDAVService
    if (registry.webDAVService?.cleanup) {
      registry.webDAVService.cleanup()
      logger.debug('WebDAVService cleaned up')
    }
    
    // Most core services don't need explicit cleanup in web environment
    // but this provides a hook for future needs
    
    logger.info('Services cleaned up successfully')
  } catch (error) {
    logger.error('Error during service cleanup', error)
  }
}