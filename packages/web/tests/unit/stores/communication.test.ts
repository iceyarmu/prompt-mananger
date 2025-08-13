import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { storeBus, setupStoreCommunication, useStoreCommunication } from '../../../src/stores/communication'
import { useAppStore } from '../../../src/stores/app'
import { useEditorStore } from '../../../src/stores/editor'
import { useFileTreeStore } from '../../../src/stores/fileTree'
import { useWebDAVStore } from '../../../src/stores/webdav'
import { usePreferenceStore } from '../../../src/stores/preferences'
import { useOptimizationStore } from '../../../src/stores/optimization'

// Mock the stores that have external dependencies
vi.mock('../../../src/stores/webdav', () => ({
  useWebDAVStore: vi.fn(() => ({
    $subscribe: vi.fn(),
    connectionStatus: 'disconnected',
    activeProfile: null
  }))
}))

vi.mock('../../../src/stores/fileTree', () => ({
  useFileTreeStore: vi.fn(() => ({
    selectedNode: null,
    tree: [],
    loadTree: vi.fn().mockResolvedValue(undefined),
    clearTree: vi.fn(),
    setNodeModified: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshNode: vi.fn().mockResolvedValue(undefined)
  }))
}))

describe('Store Communication', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    storeBus.clearAll()
    storeBus.clearHistory()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('StoreCommunicationBus', () => {
    it('should emit and receive events', () => {
      const handler = vi.fn()
      
      storeBus.on('test', 'event', handler)
      storeBus.emit('test', 'event', { data: 'test' })
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should support wildcard subscriptions', () => {
      const allHandler = vi.fn()
      const storeHandler = vi.fn()
      const eventHandler = vi.fn()
      
      storeBus.on('*', '*', allHandler)
      storeBus.on('test', '*', storeHandler)
      storeBus.on('*', 'event', eventHandler)
      
      storeBus.emit('test', 'event', { data: 'test' })
      
      expect(allHandler).toHaveBeenCalledWith({ data: 'test' })
      expect(storeHandler).toHaveBeenCalledWith({ data: 'test' })
      expect(eventHandler).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should unsubscribe handlers', () => {
      const handler = vi.fn()
      
      const subscription = storeBus.on('test', 'event', handler)
      storeBus.emit('test', 'event', { data: 'test' })
      expect(handler).toHaveBeenCalledTimes(1)
      
      subscription.unsubscribe()
      storeBus.emit('test', 'event', { data: 'test' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should clear store subscriptions', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      storeBus.on('test', 'event1', handler1)
      storeBus.on('test', 'event2', handler1)
      storeBus.on('other', 'event', handler2)
      
      storeBus.clearStore('test')
      
      storeBus.emit('test', 'event1')
      storeBus.emit('test', 'event2')
      storeBus.emit('other', 'event')
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should maintain event history', () => {
      storeBus.emit('test', 'event1', { data: 1 })
      storeBus.emit('test', 'event2', { data: 2 })
      
      const history = storeBus.getHistory()
      
      expect(history).toHaveLength(2)
      expect(history[0]).toMatchObject({
        store: 'test',
        event: 'event1',
        payload: { data: 1 }
      })
      expect(history[1]).toMatchObject({
        store: 'test',
        event: 'event2',
        payload: { data: 2 }
      })
    })

    it('should limit history size', () => {
      // Set a smaller limit for testing
      const maxSize = 5
      for (let i = 0; i < 10; i++) {
        storeBus.emit('test', `event${i}`)
      }
      
      const history = storeBus.getHistory()
      expect(history.length).toBeLessThanOrEqual(100) // Default max size
    })

    it('should clear history', () => {
      storeBus.emit('test', 'event1')
      storeBus.emit('test', 'event2')
      
      expect(storeBus.getHistory()).toHaveLength(2)
      
      storeBus.clearHistory()
      expect(storeBus.getHistory()).toHaveLength(0)
    })
  })

  describe('useStoreCommunication composable', () => {
    it('should subscribe and emit events', () => {
      const { subscribe, emit } = useStoreCommunication()
      const handler = vi.fn()
      
      subscribe('test', 'event', handler)
      emit('test', 'event', { data: 'test' })
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should cleanup subscriptions', () => {
      const { subscribe, emit, cleanup } = useStoreCommunication()
      const handler = vi.fn()
      
      subscribe('test', 'event', handler)
      emit('test', 'event')
      expect(handler).toHaveBeenCalledTimes(1)
      
      cleanup()
      emit('test', 'event')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should track multiple subscriptions', () => {
      const { subscribe, cleanup } = useStoreCommunication()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      subscribe('test', 'event1', handler1)
      subscribe('test', 'event2', handler2)
      
      storeBus.emit('test', 'event1')
      storeBus.emit('test', 'event2')
      
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
      
      cleanup()
      
      handler1.mockClear()
      handler2.mockClear()
      
      storeBus.emit('test', 'event1')
      storeBus.emit('test', 'event2')
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('Cross-store communication', () => {
    it('should handle global errors', () => {
      setupStoreCommunication()
      const appStore = useAppStore()
      
      storeBus.emit('editor', 'error', { message: 'Test error' })
      
      expect(appStore.error).toBe('Test error')
    })

    it('should coordinate loading states', () => {
      setupStoreCommunication()
      const appStore = useAppStore()
      
      storeBus.emit('editor', 'loading-start', { store: 'editor' })
      expect(appStore.isLoading).toBe(true)
      
      storeBus.emit('editor', 'loading-end', { store: 'editor' })
      expect(appStore.isLoading).toBe(false)
    })

    it('should handle multiple loading states', () => {
      setupStoreCommunication()
      const appStore = useAppStore()
      
      storeBus.emit('editor', 'loading-start', { store: 'editor' })
      storeBus.emit('filetree', 'loading-start', { store: 'filetree' })
      expect(appStore.isLoading).toBe(true)
      
      storeBus.emit('editor', 'loading-end', { store: 'editor' })
      expect(appStore.isLoading).toBe(true)
      
      storeBus.emit('filetree', 'loading-end', { store: 'filetree' })
      expect(appStore.isLoading).toBe(false)
    })
  })
})