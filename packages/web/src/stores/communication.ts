import { watch, type WatchStopHandle } from 'vue'
import type { Store } from 'pinia'
import { useAppStore } from './app'
import { useEditorStore } from './editor'
import { useFileTreeStore } from './fileTree'
import { useWebDAVStore } from './webdav'
import { usePreferenceStore } from './preferences'
import { useOptimizationStore } from './optimization'

// Error handler wrapper for safer watcher execution
function safeWatch<T>(
  source: () => T,
  callback: (value: T) => void,
  options?: any
): WatchStopHandle {
  return watch(source, (value) => {
    try {
      callback(value)
    } catch (error) {
      console.error('[StoreCommunication] Watch callback error:', error)
      storeBus.emit('*', 'error', { 
        message: error instanceof Error ? error.message : 'Unknown error in store watcher' 
      })
    }
  }, options)
}

export interface StoreEvent {
  store: string
  event: string
  payload?: any
  timestamp: number
}

export interface StoreSubscription {
  id: string
  store: string
  event: string
  handler: (payload?: any) => void
  unsubscribe: () => void
}

class StoreCommunicationBus {
  private subscriptions: Map<string, StoreSubscription[]> = new Map()
  private watchers: Map<string, WatchStopHandle[]> = new Map()
  private eventHistory: StoreEvent[] = []
  private maxHistorySize = 100

  emit(store: string, event: string, payload?: any) {
    const storeEvent: StoreEvent = {
      store,
      event,
      payload,
      timestamp: Date.now()
    }

    this.addToHistory(storeEvent)

    const key = `${store}:${event}`
    const globalKey = '*:*'
    const storeWildcard = `${store}:*`
    const eventWildcard = `*:${event}`

    const handlers = [
      ...(this.subscriptions.get(key) || []),
      ...(this.subscriptions.get(globalKey) || []),
      ...(this.subscriptions.get(storeWildcard) || []),
      ...(this.subscriptions.get(eventWildcard) || [])
    ]

    handlers.forEach(sub => {
      try {
        sub.handler(payload)
      } catch (error) {
        console.error(`Error in store event handler for ${key}:`, error)
      }
    })
  }

  on(store: string, event: string, handler: (payload?: any) => void): StoreSubscription {
    const key = `${store}:${event}`
    const id = crypto.randomUUID()

    const subscription: StoreSubscription = {
      id,
      store,
      event,
      handler,
      unsubscribe: () => this.off(id)
    }

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, [])
    }

    this.subscriptions.get(key)!.push(subscription)
    return subscription
  }

  off(subscriptionId: string) {
    for (const [key, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId)
      if (index !== -1) {
        subs.splice(index, 1)
        if (subs.length === 0) {
          this.subscriptions.delete(key)
        }
        break
      }
    }
  }

  clearStore(store: string) {
    const keysToDelete: string[] = []
    for (const key of this.subscriptions.keys()) {
      if (key.startsWith(`${store}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.subscriptions.delete(key))
  }

  clearAll() {
    this.subscriptions.clear()
    this.watchers.forEach(stopHandles => {
      stopHandles.forEach(stop => stop())
    })
    this.watchers.clear()
  }

  private addToHistory(event: StoreEvent) {
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }

  getHistory(): StoreEvent[] {
    return [...this.eventHistory]
  }

  clearHistory() {
    this.eventHistory = []
  }
}

export const storeBus = new StoreCommunicationBus()

export function setupStoreCommunication() {
  const appStore = useAppStore()
  const editorStore = useEditorStore()
  const fileTreeStore = useFileTreeStore()
  const webdavStore = useWebDAVStore()
  const preferenceStore = usePreferenceStore()
  const optimizationStore = useOptimizationStore()

  // WebDAV connection affects file tree
  webdavStore.$subscribe((mutation, state) => {
    if (state.connectionStatus === 'connected' && state.activeProfile) {
      storeBus.emit('webdav', 'connected', { profile: state.activeProfile })
      fileTreeStore.loadTree().catch(error => {
        console.error('Failed to load file tree after WebDAV connection:', error)
        storeBus.emit('filetree', 'load-error', { error })
      })
    } else if (state.connectionStatus === 'disconnected') {
      storeBus.emit('webdav', 'disconnected')
      fileTreeStore.clearTree()
      editorStore.clearEditor()
    }
  })

  // File selection affects editor
  safeWatch(() => fileTreeStore.selectedNode, (newNode) => {
    if (newNode && newNode.type === 'file') {
      storeBus.emit('filetree', 'file-selected', { file: newNode })
      
      // Check if file has unsaved changes before loading
      if (editorStore.hasUnsavedChanges && editorStore.currentFile) {
        storeBus.emit('editor', 'unsaved-changes-warning', {
          currentFile: editorStore.currentFile,
          newFile: newNode
        })
      }
    }
  })

  // Editor changes affect file tree display
  safeWatch(() => editorStore.modifiedFiles, (modifiedFiles) => {
    modifiedFiles.forEach(path => {
      fileTreeStore.setNodeModified(path, true)
    })
    
    // Clear modified state for saved files
    const allPaths = fileTreeStore.tree.map(node => node.path)
    allPaths.forEach(path => {
      if (!modifiedFiles.has(path)) {
        fileTreeStore.setNodeModified(path, false)
      }
    })
  }, { deep: true })

  // Auto-save based on preferences
  safeWatch(() => preferenceStore.preferences.autoSave, (autoSave) => {
    if (autoSave) {
      storeBus.emit('preferences', 'autosave-enabled', {
        interval: preferenceStore.preferences.autoSaveInterval
      })
    } else {
      storeBus.emit('preferences', 'autosave-disabled')
    }
  })

  // Theme changes
  safeWatch(() => preferenceStore.preferences.theme, (theme) => {
    storeBus.emit('preferences', 'theme-changed', { theme })
  })

  // Editor preferences affect editor behavior
  safeWatch(() => preferenceStore.editorPreferences, (prefs) => {
    storeBus.emit('preferences', 'editor-preferences-changed', prefs)
  }, { deep: true })

  // Optimization completion
  safeWatch(() => optimizationStore.status, (status) => {
    if (status === 'completed' && optimizationStore.currentResult) {
      storeBus.emit('optimization', 'completed', {
        prompt: optimizationStore.currentPrompt,
        result: optimizationStore.currentResult
      })
      
      // Could automatically update editor if in optimization mode
      if (editorStore.currentFile?.name.includes('.prompt')) {
        storeBus.emit('optimization', 'suggest-editor-update', {
          result: optimizationStore.currentResult
        })
      }
    } else if (status === 'error') {
      storeBus.emit('optimization', 'error', {
        error: optimizationStore.error
      })
    }
  })

  // Global error handling
  storeBus.on('*', 'error', (payload) => {
    appStore.setError(payload?.message || 'An error occurred')
  })

  // Loading state coordination
  const loadingStores = new Set<string>()
  
  storeBus.on('*', 'loading-start', (payload) => {
    loadingStores.add(payload?.store || 'unknown')
    appStore.setLoading(true)
  })
  
  storeBus.on('*', 'loading-end', (payload) => {
    loadingStores.delete(payload?.store || 'unknown')
    if (loadingStores.size === 0) {
      appStore.setLoading(false)
    }
  })

  // File tree refresh on various events
  storeBus.on('editor', 'file-saved', () => {
    fileTreeStore.refresh().catch(error => {
      console.error('Failed to refresh file tree after save:', error)
    })
  })

  storeBus.on('editor', 'file-created', (payload) => {
    if (payload?.path) {
      const parentPath = payload.path.substring(0, payload.path.lastIndexOf('/'))
      fileTreeStore.refreshNode(parentPath).catch(error => {
        console.error('Failed to refresh parent folder:', error)
      })
    }
  })

  storeBus.on('editor', 'file-deleted', (payload) => {
    if (payload?.path) {
      fileTreeStore.refresh().catch(error => {
        console.error('Failed to refresh file tree after deletion:', error)
      })
    }
  })

  // Preference synchronization
  storeBus.on('preferences', 'imported', () => {
    // Reload all stores with new preferences
    storeBus.emit('global', 'preferences-reloaded')
  })

  // WebDAV profile changes
  storeBus.on('webdav', 'profile-changed', (payload) => {
    if (payload?.profile) {
      fileTreeStore.clearTree()
      editorStore.clearEditor()
    }
  })

  console.log('[StoreCommunication] Cross-store communication established')
}

// Helper composable for components to use store communication
export function useStoreCommunication() {
  const subscriptions: StoreSubscription[] = []

  const subscribe = (store: string, event: string, handler: (payload?: any) => void) => {
    const sub = storeBus.on(store, event, handler)
    subscriptions.push(sub)
    return sub
  }

  const emit = (store: string, event: string, payload?: any) => {
    storeBus.emit(store, event, payload)
  }

  const cleanup = () => {
    subscriptions.forEach(sub => sub.unsubscribe())
    subscriptions.length = 0
  }

  return {
    subscribe,
    emit,
    cleanup,
    bus: storeBus
  }
}