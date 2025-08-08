import type { ApplicationConfig } from '../types/application'

/**
 * Validate and sanitize configuration values
 */
function validateConfig(config: ApplicationConfig): ApplicationConfig {
  // Ensure numeric values are valid
  if (isNaN(config.api.timeout) || config.api.timeout <= 0) {
    config.api.timeout = 30000
  }
  
  if (isNaN(config.performance.maxCacheSize) || config.performance.maxCacheSize < 0) {
    config.performance.maxCacheSize = 52428800 // 50MB default
  }
  
  if (isNaN(config.performance.requestTimeout) || config.performance.requestTimeout <= 0) {
    config.performance.requestTimeout = 30000
  }
  
  // Validate storage type
  const validStorageTypes = ['dexie', 'indexeddb', 'localstorage']
  if (!validStorageTypes.includes(config.storage.type)) {
    config.storage.type = 'dexie'
  }
  
  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error']
  if (!validLogLevels.includes(config.logging.level)) {
    config.logging.level = 'info'
  }
  
  return config
}

/**
 * Load application configuration from environment variables
 */
export function loadConfiguration(): ApplicationConfig {
  const env = import.meta.env
  const isDevelopment = env.MODE === 'development'
  const isProduction = env.MODE === 'production'
  
  const config: ApplicationConfig = {
    environment: env.MODE || 'development',
    isDevelopment,
    isProduction,
    
    // API Configuration
    api: {
      baseUrl: env.VITE_API_BASE_URL || '',
      timeout: parseInt(env.VITE_API_TIMEOUT || '30000', 10),
    },
    
    // Storage Configuration
    storage: {
      type: env.VITE_STORAGE_TYPE || 'dexie',
      namespace: env.VITE_STORAGE_NAMESPACE || 'prompt-optimizer',
    },
    
    // WebDAV Configuration
    webdav: {
      enabled: env.VITE_WEBDAV_ENABLED === 'true',
      url: env.VITE_WEBDAV_URL || '',
      username: env.VITE_WEBDAV_USERNAME || '',
      password: env.VITE_WEBDAV_PASSWORD || '',
    },
    
    // Logging Configuration
    logging: {
      level: isDevelopment ? 'debug' : (env.VITE_LOG_LEVEL || 'info'),
      enableConsole: isDevelopment || env.VITE_LOG_CONSOLE === 'true',
      enableRemote: env.VITE_LOG_REMOTE === 'true',
    },
    
    // Feature Flags
    features: {
      enableWebDAV: env.VITE_FEATURE_WEBDAV === 'true',
      enableExperimentalFeatures: env.VITE_FEATURE_EXPERIMENTAL === 'true',
      enableAnalytics: env.VITE_VERCEL_DEPLOYMENT === 'true',
    },
    
    // Performance Configuration
    performance: {
      enableCaching: isProduction,
      maxCacheSize: parseInt(env.VITE_MAX_CACHE_SIZE || '52428800', 10), // 50MB default
      requestTimeout: parseInt(env.VITE_REQUEST_TIMEOUT || '30000', 10),
    },
  }
  
  // Validate and return configuration
  return validateConfig(config)
}