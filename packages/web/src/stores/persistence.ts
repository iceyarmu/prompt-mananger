import { type PiniaPluginContext, type StateTree } from 'pinia'
import { watch, nextTick } from 'vue'

export interface PersistOptions {
  enabled?: boolean
  strategies?: PersistStrategy[]
  key?: string | ((id: string) => string)
  paths?: string[]
  beforeRestore?: (context: PiniaPluginContext) => void
  afterRestore?: (context: PiniaPluginContext) => void
  serializer?: {
    serialize: (value: StateTree) => string
    deserialize: (value: string) => StateTree
  }
}

export interface PersistStrategy {
  key?: string
  storage?: Storage
  paths?: string[]
}

export interface PersistedState {
  version: number
  timestamp: number
  state: StateTree
}

const DEFAULT_KEY = (id: string) => `store:${id}`
const STORAGE_VERSION = 1

class PersistenceManager {
  private storage: Storage
  private serializer: Required<PersistOptions['serializer']>

  constructor(storage: Storage = localStorage) {
    this.storage = storage
    this.serializer = {
      serialize: (value) => JSON.stringify(value),
      deserialize: (value) => JSON.parse(value)
    }
  }

  save(key: string, state: StateTree, paths?: string[]): void {
    try {
      const filteredState = paths ? this.filterState(state, paths) : state
      const persistedState: PersistedState = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        state: filteredState
      }
      
      const serialized = this.serializer.serialize(persistedState as StateTree)
      this.storage.setItem(key, serialized)
    } catch (error) {
      console.error(`Failed to persist state for key ${key}:`, error)
    }
  }

  load(key: string): StateTree | null {
    try {
      const item = this.storage.getItem(key)
      if (!item) return null

      const deserialized = this.serializer.deserialize(item) as PersistedState
      
      // Version check for future migrations
      if (!deserialized.version || !deserialized.state) {
        // Handle legacy format (direct state without wrapper)
        console.warn(`Legacy state format detected for key ${key}, attempting direct parse`)
        return item as unknown as StateTree
      }
      
      if (deserialized.version !== STORAGE_VERSION) {
        console.warn(`State version mismatch for key ${key}. Expected ${STORAGE_VERSION}, got ${deserialized.version}`)
        // In the future, we could run migrations here based on version differences
        // For now, we'll still attempt to use the state
      }

      return deserialized.state
    } catch (error) {
      console.error(`Failed to load persisted state for key ${key}:`, error)
      
      // Attempt recovery by clearing corrupted state
      try {
        this.storage.removeItem(key)
        console.warn(`Cleared corrupted state for key ${key}`)
      } catch (clearError) {
        console.error(`Failed to clear corrupted state for key ${key}:`, clearError)
      }
      
      return null
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key)
    } catch (error) {
      console.error(`Failed to remove persisted state for key ${key}:`, error)
    }
  }

  private filterState(state: StateTree, paths: string[]): StateTree {
    const filtered: StateTree = {}
    
    paths.forEach(path => {
      const keys = path.split('.')
      let source: any = state
      let target: any = filtered

      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          // Last key - copy the value
          if (source && key in source) {
            target[key] = source[key]
          }
        } else {
          // Intermediate key - ensure object exists
          if (source && key in source) {
            if (!(key in target)) {
              target[key] = {}
            }
            source = source[key]
            target = target[key]
          }
        }
      })
    })

    return filtered
  }
}

// Global persistence manager instance
const persistenceManager = new PersistenceManager()

// Track which stores have persistence enabled
const persistedStores = new Map<string, PersistOptions>()

export function createPersistedState(options: PersistOptions = {}): (context: PiniaPluginContext) => void {
  return ({ store, options: storeOptions }: PiniaPluginContext) => {
    // Check if persistence is explicitly disabled for this store
    const persist = (storeOptions as any)?.persist ?? options
    if (!persist || persist.enabled === false) {
      return
    }

    const { 
      key = DEFAULT_KEY,
      paths,
      beforeRestore,
      afterRestore,
      strategies = [{ storage: localStorage }]
    } = typeof persist === 'object' ? persist : options

    const storeKey = typeof key === 'function' ? key(store.$id) : key

    // Track this store as persisted
    persistedStores.set(store.$id, persist as PersistOptions)

    // Restore state from storage
    if (beforeRestore) {
      beforeRestore({ store, options: storeOptions })
    }

    strategies.forEach(strategy => {
      const strategyKey = strategy.key || storeKey
      const storage = strategy.storage || localStorage
      const manager = new PersistenceManager(storage)
      
      const persistedState = manager.load(strategyKey)
      if (persistedState) {
        const statePaths = strategy.paths || paths
        if (statePaths) {
          // Restore only specified paths
          statePaths.forEach(path => {
            const keys = path.split('.')
            let source: any = persistedState
            let target: any = store.$state

            keys.forEach((key, index) => {
              if (index === keys.length - 1) {
                if (source && key in source) {
                  target[key] = source[key]
                }
              } else {
                if (source && key in source) {
                  source = source[key]
                  target = target[key]
                }
              }
            })
          })
        } else {
          // Restore entire state
          store.$patch(persistedState)
        }
      }
    })

    if (afterRestore) {
      afterRestore({ store, options: storeOptions })
    }

    // Watch for state changes and persist
    let saveTimeout: NodeJS.Timeout | null = null
    
    store.$subscribe((mutation, state) => {
      // Debounce saves to avoid excessive storage writes
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }

      saveTimeout = setTimeout(() => {
        strategies.forEach(strategy => {
          const strategyKey = strategy.key || storeKey
          const storage = strategy.storage || localStorage
          const manager = new PersistenceManager(storage)
          const statePaths = strategy.paths || paths
          
          manager.save(strategyKey, state, statePaths)
        })
      }, 100)
    })
  }
}

// Configure persistence for each store
export const storePersistConfig: Record<string, PersistOptions> = {
  app: {
    enabled: true,
    paths: ['version', 'environment']
  },
  preferences: {
    enabled: true,
    // Persist all preferences
  },
  webdav: {
    enabled: true,
    paths: ['profiles', 'activeProfile'],
    strategies: [
      {
        key: 'webdav:config',
        storage: localStorage,
        paths: ['profiles', 'activeProfile']
      }
    ]
  },
  fileTree: {
    enabled: true,
    paths: ['expandedPaths', 'searchQuery'],
    strategies: [
      {
        key: 'filetree:state',
        storage: sessionStorage,
        paths: ['expandedPaths', 'selectedNode']
      }
    ]
  },
  editor: {
    enabled: true,
    paths: ['viewMode', 'cursorPosition', 'scrollPosition'],
    strategies: [
      {
        key: 'editor:draft',
        storage: sessionStorage,
        paths: ['content', 'currentFile']
      },
      {
        key: 'editor:settings',
        storage: localStorage,
        paths: ['viewMode']
      }
    ]
  },
  optimization: {
    enabled: true,
    paths: ['history', 'templates', 'configurations'],
    strategies: [
      {
        key: 'optimization:data',
        storage: localStorage
      }
    ]
  }
}

// Helper function to clear all persisted state
export function clearAllPersistedState(): void {
  persistedStores.forEach((options, storeId) => {
    const key = options.key || DEFAULT_KEY
    const storeKey = typeof key === 'function' ? key(storeId) : key
    
    if (options.strategies) {
      options.strategies.forEach(strategy => {
        const strategyKey = strategy.key || storeKey
        const storage = strategy.storage || localStorage
        storage.removeItem(strategyKey)
      })
    } else {
      localStorage.removeItem(storeKey)
      sessionStorage.removeItem(storeKey)
    }
  })
}

// Helper function to export all persisted state
export function exportPersistedState(): Record<string, any> {
  const exported: Record<string, any> = {}
  
  persistedStores.forEach((options, storeId) => {
    const key = options.key || DEFAULT_KEY
    const storeKey = typeof key === 'function' ? key(storeId) : key
    
    if (options.strategies) {
      options.strategies.forEach(strategy => {
        const strategyKey = strategy.key || storeKey
        const storage = strategy.storage || localStorage
        const manager = new PersistenceManager(storage)
        const state = manager.load(strategyKey)
        
        if (state) {
          exported[strategyKey] = state
        }
      })
    } else {
      const manager = new PersistenceManager()
      const state = manager.load(storeKey)
      
      if (state) {
        exported[storeKey] = state
      }
    }
  })
  
  return exported
}

// Helper function to import persisted state
export function importPersistedState(data: Record<string, any>): void {
  Object.entries(data).forEach(([key, state]) => {
    // Try to determine which storage to use based on key patterns
    if (key.includes('draft') || key.includes('session')) {
      sessionStorage.setItem(key, JSON.stringify({
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        state
      }))
    } else {
      localStorage.setItem(key, JSON.stringify({
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        state
      }))
    }
  })
}