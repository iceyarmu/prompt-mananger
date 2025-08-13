import type { StateTree } from 'pinia'

export interface MigrationResult {
  success: boolean
  migratedKeys: string[]
  failedKeys: string[]
  errors: Array<{ key: string; error: string }>
}

export interface MigrationMapping {
  oldKey: string
  newKey: string
  transform?: (value: any) => any
  validate?: (value: any) => boolean
}

export interface MigrationConfig {
  version: number
  mappings: MigrationMapping[]
  cleanup?: boolean
}

// Legacy storage key patterns from the old system
const LEGACY_STORAGE_PATTERNS = {
  preferences: /^pref:/,
  models: /^models$/,
  templates: /^user-templates$/,
  history: /^prompt_history$/,
  webdav: /^webdav:/,
  editor: /^editor:/,
  filetree: /^filetree:/
} as const

// Migration configurations for each store
export const STORE_MIGRATIONS: Record<string, MigrationConfig> = {
  preferences: {
    version: 1,
    mappings: [
      { oldKey: 'pref:theme', newKey: 'theme' },
      { oldKey: 'pref:language', newKey: 'language' },
      { oldKey: 'pref:autoSave', newKey: 'autoSave', transform: (v) => v === 'true' },
      { oldKey: 'pref:autoSaveInterval', newKey: 'autoSaveInterval', transform: (v) => parseInt(v, 10) },
      { oldKey: 'pref:editorFontSize', newKey: 'editorFontSize', transform: (v) => parseInt(v, 10) },
      { oldKey: 'pref:editorWordWrap', newKey: 'editorWordWrap', transform: (v) => v === 'true' },
      { oldKey: 'pref:showLineNumbers', newKey: 'showLineNumbers', transform: (v) => v === 'true' },
      { oldKey: 'pref:tabSize', newKey: 'tabSize', transform: (v) => parseInt(v, 10) },
      { oldKey: 'pref:insertSpaces', newKey: 'insertSpaces', transform: (v) => v === 'true' },
      { oldKey: 'pref:highlightActiveLine', newKey: 'highlightActiveLine', transform: (v) => v === 'true' },
      { oldKey: 'pref:showInvisibles', newKey: 'showInvisibles', transform: (v) => v === 'true' },
      { oldKey: 'pref:enableVim', newKey: 'enableVim', transform: (v) => v === 'true' },
      { oldKey: 'pref:enableEmmet', newKey: 'enableEmmet', transform: (v) => v === 'true' }
    ],
    cleanup: true
  },
  webdav: {
    version: 1,
    mappings: [
      { 
        oldKey: 'webdav:profiles',
        newKey: 'profiles',
        transform: (v) => {
          try {
            const profiles = typeof v === 'string' ? JSON.parse(v) : v
            return profiles.map((p: any) => ({
              ...p,
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
              lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined
            }))
          } catch {
            return []
          }
        }
      },
      { oldKey: 'webdav:active-profile', newKey: 'activeProfile' },
      { oldKey: 'webdav:credentials:*', newKey: 'credentials:*' }
    ],
    cleanup: false // Don't cleanup credentials
  },
  fileTree: {
    version: 1,
    mappings: [
      {
        oldKey: 'fileTree:expandedPaths',
        newKey: 'expandedPaths',
        transform: (v) => {
          try {
            const paths = typeof v === 'string' ? JSON.parse(v) : v
            return new Set(Array.isArray(paths) ? paths : [])
          } catch {
            return new Set()
          }
        }
      },
      { oldKey: 'fileTree:searchQuery', newKey: 'searchQuery' }
    ],
    cleanup: true
  },
  editor: {
    version: 1,
    mappings: [
      { oldKey: 'editor:viewMode', newKey: 'viewMode' },
      { 
        oldKey: 'editor:draft',
        newKey: 'content',
        validate: (v) => typeof v === 'string'
      },
      {
        oldKey: 'editor:currentFile',
        newKey: 'currentFile',
        transform: (v) => {
          try {
            return typeof v === 'string' ? JSON.parse(v) : v
          } catch {
            return null
          }
        }
      }
    ],
    cleanup: true
  },
  optimization: {
    version: 1,
    mappings: [
      {
        oldKey: 'prompt_history',
        newKey: 'history',
        transform: (v) => {
          try {
            const history = typeof v === 'string' ? JSON.parse(v) : v
            return Array.isArray(history) ? history.map((item: any) => ({
              id: item.id || crypto.randomUUID(),
              prompt: item.prompt || item.originalPrompt || '',
              result: item.result || item.optimizedPrompt || '',
              timestamp: item.timestamp || Date.now(),
              model: item.model,
              template: item.template
            })) : []
          } catch {
            return []
          }
        }
      },
      {
        oldKey: 'user-templates',
        newKey: 'templates',
        transform: (v) => {
          try {
            const templates = typeof v === 'string' ? JSON.parse(v) : v
            return Array.isArray(templates) ? templates.map((t: any) => ({
              id: t.id || crypto.randomUUID(),
              name: t.name || 'Unnamed Template',
              content: t.content || t.template || '',
              type: 'user' as const,
              category: t.category,
              description: t.description,
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
              updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
            })) : []
          } catch {
            return []
          }
        }
      },
      {
        oldKey: 'models',
        newKey: 'configurations',
        transform: (v) => {
          try {
            const models = typeof v === 'string' ? JSON.parse(v) : v
            const configs = new Map()
            
            if (Array.isArray(models)) {
              models.forEach((model: any) => {
                configs.set(model.name || model.id, {
                  model: model.model || model.name,
                  template: model.defaultTemplate || '',
                  temperature: model.temperature || 0.7,
                  maxTokens: model.maxTokens || 2048,
                  topP: model.topP || 1
                })
              })
            }
            
            return configs
          } catch {
            return new Map()
          }
        }
      }
    ],
    cleanup: true
  }
}

class StateMigrator {
  private storage: Storage

  constructor(storage: Storage = localStorage) {
    this.storage = storage
  }

  async migrateStore(storeName: string, currentState?: StateTree): Promise<MigrationResult> {
    const config = STORE_MIGRATIONS[storeName]
    if (!config) {
      return {
        success: false,
        migratedKeys: [],
        failedKeys: [],
        errors: [{ key: storeName, error: 'No migration config found' }]
      }
    }

    const result: MigrationResult = {
      success: true,
      migratedKeys: [],
      failedKeys: [],
      errors: []
    }

    const migratedState: StateTree = currentState || {}

    for (const mapping of config.mappings) {
      try {
        const value = this.getOldValue(mapping.oldKey)
        if (value !== null) {
          const transformedValue = mapping.transform ? mapping.transform(value) : value
          
          if (mapping.validate && !mapping.validate(transformedValue)) {
            result.failedKeys.push(mapping.oldKey)
            result.errors.push({
              key: mapping.oldKey,
              error: 'Validation failed'
            })
            continue
          }

          this.setNewValue(migratedState, mapping.newKey, transformedValue)
          result.migratedKeys.push(mapping.oldKey)

          if (config.cleanup) {
            this.removeOldValue(mapping.oldKey)
          }
        }
      } catch (error) {
        result.success = false
        result.failedKeys.push(mapping.oldKey)
        result.errors.push({
          key: mapping.oldKey,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  }

  async migrateAllStores(): Promise<Record<string, MigrationResult>> {
    const results: Record<string, MigrationResult> = {}

    for (const storeName of Object.keys(STORE_MIGRATIONS)) {
      results[storeName] = await this.migrateStore(storeName)
    }

    return results
  }

  detectLegacyData(): string[] {
    const legacyKeys: string[] = []
    
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (!key) continue

      for (const [type, pattern] of Object.entries(LEGACY_STORAGE_PATTERNS)) {
        if (pattern.test(key)) {
          legacyKeys.push(key)
          break
        }
      }
    }

    return legacyKeys
  }

  createBackup(): Record<string, any> {
    const backup: Record<string, any> = {}
    
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (!key) continue

      const value = this.storage.getItem(key)
      if (value) {
        try {
          backup[key] = JSON.parse(value)
        } catch {
          backup[key] = value
        }
      }
    }

    return backup
  }

  restoreBackup(backup: Record<string, any>): void {
    Object.entries(backup).forEach(([key, value]) => {
      try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
        this.storage.setItem(key, stringValue)
      } catch (error) {
        console.error(`Failed to restore backup for key ${key}:`, error)
      }
    })
  }

  private getOldValue(key: string): any {
    if (key.includes('*')) {
      // Handle wildcard patterns
      const pattern = new RegExp(key.replace('*', '.*'))
      const values: Record<string, any> = {}
      
      for (let i = 0; i < this.storage.length; i++) {
        const storageKey = this.storage.key(i)
        if (storageKey && pattern.test(storageKey)) {
          const value = this.storage.getItem(storageKey)
          if (value) {
            try {
              values[storageKey] = JSON.parse(value)
            } catch {
              values[storageKey] = value
            }
          }
        }
      }
      
      return Object.keys(values).length > 0 ? values : null
    } else {
      const value = this.storage.getItem(key)
      if (!value) return null
      
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
  }

  private setNewValue(state: StateTree, key: string, value: any): void {
    if (key.includes('.')) {
      // Handle nested keys
      const keys = key.split('.')
      let target: any = state
      
      keys.forEach((k, index) => {
        if (index === keys.length - 1) {
          target[k] = value
        } else {
          if (!(k in target)) {
            target[k] = {}
          }
          target = target[k]
        }
      })
    } else {
      state[key] = value
    }
  }

  private removeOldValue(key: string): void {
    if (key.includes('*')) {
      // Handle wildcard patterns
      const pattern = new RegExp(key.replace('*', '.*'))
      const keysToRemove: string[] = []
      
      for (let i = 0; i < this.storage.length; i++) {
        const storageKey = this.storage.key(i)
        if (storageKey && pattern.test(storageKey)) {
          keysToRemove.push(storageKey)
        }
      }
      
      keysToRemove.forEach(k => this.storage.removeItem(k))
    } else {
      this.storage.removeItem(key)
    }
  }
}

// Export singleton instance
export const stateMigrator = new StateMigrator()

// Auto-migration function to be called on app initialization
export async function runAutoMigration(): Promise<void> {
  const migrationKey = 'state:migration:completed'
  const migrationCompleted = localStorage.getItem(migrationKey)
  
  if (migrationCompleted) {
    console.log('[StateMigration] Migration already completed')
    return
  }

  console.log('[StateMigration] Starting automatic migration...')
  
  // Detect legacy data
  const legacyKeys = stateMigrator.detectLegacyData()
  
  if (legacyKeys.length === 0) {
    console.log('[StateMigration] No legacy data found')
    localStorage.setItem(migrationKey, new Date().toISOString())
    return
  }

  console.log(`[StateMigration] Found ${legacyKeys.length} legacy keys`)
  
  // Create backup
  const backup = stateMigrator.createBackup()
  localStorage.setItem('state:migration:backup', JSON.stringify(backup))
  
  // Run migration
  const results = await stateMigrator.migrateAllStores()
  
  // Log results
  Object.entries(results).forEach(([store, result]) => {
    if (result.migratedKeys.length > 0) {
      console.log(`[StateMigration] ${store}: Migrated ${result.migratedKeys.length} keys`)
    }
    if (result.errors.length > 0) {
      console.error(`[StateMigration] ${store}: Errors:`, result.errors)
    }
  })
  
  // Mark migration as completed
  localStorage.setItem(migrationKey, new Date().toISOString())
  console.log('[StateMigration] Migration completed')
}