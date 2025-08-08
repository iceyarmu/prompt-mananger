/**
 * Application-wide type definitions
 */

// Application Configuration
export interface ApplicationConfig {
  environment: string
  isDevelopment: boolean
  isProduction: boolean
  
  api: ApiConfig
  storage: StorageConfig
  webdav: WebDAVConfig
  logging: LoggingConfig
  features: FeatureFlags
  performance: PerformanceConfig
}

export interface ApiConfig {
  baseUrl: string
  timeout: number
}

export interface StorageConfig {
  type: 'dexie' | 'indexeddb' | 'localstorage'
  namespace: string
}

export interface WebDAVConfig {
  enabled: boolean
  url: string
  username: string
  password: string
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  enableConsole: boolean
  enableRemote: boolean
}

export interface FeatureFlags {
  enableWebDAV: boolean
  enableExperimentalFeatures: boolean
  enableAnalytics: boolean
}

export interface PerformanceConfig {
  enableCaching: boolean
  maxCacheSize: number
  requestTimeout: number
}

// Service Types
export interface Service {
  name: string
  version?: string
  init?: () => Promise<void>
  cleanup?: () => void
  healthCheck?: () => Promise<boolean>
}

export interface ServiceConstructor<T extends Service = Service> {
  new (...args: any[]): T
}

// Dependency Injection Types
export interface ServiceProvider {
  get<T extends Service>(serviceName: string): T | undefined
  register<T extends Service>(serviceName: string, service: T): void
  has(serviceName: string): boolean
  getAll(): Map<string, Service>
}

export interface ServiceDescriptor {
  name: string
  service: Service
  dependencies?: string[]
  priority?: number
}

// Application State Types
export interface ApplicationState {
  initialized: boolean
  loading: boolean
  error: Error | null
  services: ServiceRegistry
}

export interface ServiceRegistry {
  [key: string]: Service | any
}

// Event Types
export interface ApplicationEvent {
  type: ApplicationEventType
  timestamp: number
  data?: any
}

export enum ApplicationEventType {
  INITIALIZATION_START = 'initialization_start',
  INITIALIZATION_COMPLETE = 'initialization_complete',
  INITIALIZATION_ERROR = 'initialization_error',
  SERVICE_REGISTERED = 'service_registered',
  SERVICE_INITIALIZED = 'service_initialized',
  SERVICE_ERROR = 'service_error',
  CONFIGURATION_LOADED = 'configuration_loaded',
  CONFIGURATION_ERROR = 'configuration_error',
}

// Error Types
export interface ApplicationError extends Error {
  code: string
  context?: Record<string, any>
  timestamp: number
  recoverable: boolean
}

export class ServiceInitializationError extends Error implements ApplicationError {
  code = 'SERVICE_INITIALIZATION_ERROR'
  timestamp = Date.now()
  recoverable = false
  
  constructor(
    public serviceName: string,
    message: string,
    public context?: Record<string, any>
  ) {
    super(`Failed to initialize ${serviceName}: ${message}`)
    this.name = 'ServiceInitializationError'
  }
}

export class ConfigurationError extends Error implements ApplicationError {
  code = 'CONFIGURATION_ERROR'
  timestamp = Date.now()
  recoverable = false
  
  constructor(
    message: string,
    public context?: Record<string, any>
  ) {
    super(`Configuration error: ${message}`)
    this.name = 'ConfigurationError'
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>
export type Nullable<T> = T | null
export type Optional<T> = T | undefined

// Vue Injection Keys
export const InjectionKeys = {
  SERVICES: Symbol('services'),
  CONFIG: Symbol('config'),
  LOGGER: Symbol('logger'),
  EVENT_BUS: Symbol('eventBus'),
} as const

// Re-export commonly used types from core
export type {
  Model,
  Template,
  HistoryItem,
  Preferences
} from '@prompt-optimizer/core'