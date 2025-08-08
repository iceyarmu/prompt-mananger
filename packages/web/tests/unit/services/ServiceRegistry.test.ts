import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { initializeServices } from '../../../src/services/ServiceRegistry'
import type { ApplicationConfig } from '../../../src/types/application'

// Mock the core imports
vi.mock('@prompt-optimizer/core', () => ({
  StorageFactory: {
    create: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn()
    }))
  },
  DexieStorageProvider: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined)
  })),
  PreferenceService: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getPreferences: vi.fn().mockResolvedValue({})
  })),
  ModelManager: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getInstalledModels: vi.fn().mockResolvedValue([])
  })),
  TemplateManager: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getTemplates: vi.fn().mockResolvedValue([])
  })),
  HistoryManager: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getHistory: vi.fn().mockResolvedValue([])
  })),
  DataManager: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined)
  })),
  LLMService: vi.fn().mockImplementation(() => ({})),
  PromptService: vi.fn().mockImplementation(() => ({})),
  CompareService: vi.fn().mockImplementation(() => ({})),
  ElectronModelManagerProxy: vi.fn().mockImplementation(() => ({
    getInstalledModels: vi.fn().mockResolvedValue([])
  })),
  ElectronTemplateManagerProxy: vi.fn().mockImplementation(() => ({
    getTemplates: vi.fn().mockResolvedValue([])
  })),
  ElectronHistoryManagerProxy: vi.fn().mockImplementation(() => ({
    getHistory: vi.fn().mockResolvedValue([])
  })),
  ElectronDataManagerProxy: vi.fn().mockImplementation(() => ({})),
  ElectronLLMProxy: vi.fn().mockImplementation(() => ({})),
  ElectronPromptServiceProxy: vi.fn().mockImplementation(() => ({})),
  ElectronPreferenceServiceProxy: vi.fn().mockImplementation(() => ({
    getPreferences: vi.fn().mockResolvedValue({})
  }))
}))

describe('ServiceRegistry', () => {
  let config: ApplicationConfig
  
  beforeEach(() => {
    config = {
      environment: 'test',
      isDevelopment: false,
      isProduction: false,
      api: {
        baseUrl: '',
        timeout: 30000
      },
      storage: {
        type: 'dexie',
        namespace: 'test'
      },
      webdav: {
        enabled: false,
        url: '',
        username: '',
        password: ''
      },
      logging: {
        level: 'info',
        enableConsole: false,
        enableRemote: false
      },
      features: {
        enableWebDAV: false,
        enableExperimentalFeatures: false,
        enableAnalytics: false
      },
      performance: {
        enableCaching: false,
        maxCacheSize: 0,
        requestTimeout: 30000
      }
    }
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('initializeServices', () => {
    it('should initialize all services in correct order', async () => {
      const registry = await initializeServices(config)
      
      expect(registry).toBeDefined()
      expect(registry.storageService).toBeDefined()
      expect(registry.preferenceService).toBeDefined()
      expect(registry.modelService).toBeDefined()
      expect(registry.templateService).toBeDefined()
      expect(registry.optimizationService).toBeDefined()
      expect(registry.executionService).toBeDefined()
      expect(registry.historyService).toBeDefined()
      expect(registry.dataService).toBeDefined()
      expect(registry.compareService).toBeDefined()
      expect(registry.performHealthChecks).toBeDefined()
      expect(registry.cleanup).toBeDefined()
    })
    
    it('should not initialize WebDAV service when disabled', async () => {
      const registry = await initializeServices(config)
      expect(registry.webDAVService).toBeUndefined()
    })
    
    it('should handle initialization errors gracefully', async () => {
      const { DexieStorageProvider } = await import('@prompt-optimizer/core')
      ;(DexieStorageProvider as any).mockImplementationOnce(() => ({
        initialize: vi.fn().mockRejectedValue(new Error('Storage init failed'))
      }))
      
      await expect(initializeServices(config)).rejects.toThrow('Storage init failed')
    })
  })
  
  describe('performHealthChecks', () => {
    it('should perform health checks on all services', async () => {
      const registry = await initializeServices(config)
      const healthChecks = await registry.performHealthChecks()
      
      expect(healthChecks).toBeDefined()
      expect(Array.isArray(healthChecks)).toBe(true)
      expect(healthChecks.length).toBeGreaterThan(0)
      
      // Check that critical services are included
      const serviceNames = healthChecks.map(c => c.service)
      expect(serviceNames).toContain('StorageService')
      expect(serviceNames).toContain('PreferenceService')
      expect(serviceNames).toContain('ModelService')
      expect(serviceNames).toContain('TemplateService')
      expect(serviceNames).toContain('HistoryService')
    })
    
    it('should report unhealthy services correctly', async () => {
      const registry = await initializeServices(config)
      
      // Mock a service to fail health check
      registry.storageService.get = vi.fn().mockRejectedValue(new Error('Storage error'))
      
      const healthChecks = await registry.performHealthChecks()
      const storageCheck = healthChecks.find(c => c.service === 'StorageService')
      
      expect(storageCheck).toBeDefined()
      expect(storageCheck?.healthy).toBe(false)
      expect(storageCheck?.message).toContain('Failed to access storage')
      expect(storageCheck?.error).toBeDefined()
    })
  })
  
  describe('cleanup', () => {
    it('should provide cleanup function', async () => {
      const registry = await initializeServices(config)
      
      expect(registry.cleanup).toBeDefined()
      expect(typeof registry.cleanup).toBe('function')
      
      // Should not throw when called
      expect(() => registry.cleanup?.()).not.toThrow()
    })
  })
})