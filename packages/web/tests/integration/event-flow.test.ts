import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileTreeStore } from '../../src/stores/fileTree'
import { useEditorStore } from '../../src/stores/editor'
import { useOptimizationStore } from '../../src/stores/optimization'
import { useExecutionStore } from '../../src/stores/execution'
import { useAppStore } from '../../src/stores/app'
import { storeBus } from '../../src/stores/communication'
import { keyboardShortcutRegistry } from '../../src/utils/KeyboardShortcuts'

describe('Integration: Event Flow Verification', () => {
  let pinia: any
  let unsubscribes: Array<() => void> = []

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    unsubscribes = []
  })

  afterEach(() => {
    // Clean up all subscriptions
    unsubscribes.forEach(unsub => unsub())
    unsubscribes = []
  })

  describe('Task 1: File Selection to Editor Communication', () => {
    it('should complete full flow from file selection to editor loading', async () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      const appStore = useAppStore()
      
      const events: any[] = []
      
      // Track all events
      const unsub = storeBus.subscribe('*', '*', (payload) => {
        events.push({ source: '*', event: '*', payload })
      })
      unsubscribes.push(unsub)
      
      // Mock file node
      const fileNode = {
        path: '/test/document.md',
        name: 'document.md',
        type: 'file' as const,
        size: 1024,
        lastModified: new Date()
      }
      
      // Select file in tree
      fileTreeStore.selectNode(fileNode)
      
      // Verify selection
      expect(fileTreeStore.selectedNode).toEqual(fileNode)
      
      // Simulate editor loading
      await editorStore.loadFile(fileNode, null)
      
      // Verify editor state
      expect(editorStore.currentFile).toEqual(fileNode)
      
      // Emit file-loaded event
      storeBus.emit('filetree', 'file-loaded', { file: fileNode })
      
      // Verify event was captured
      expect(events).toContainEqual(
        expect.objectContaining({
          payload: expect.objectContaining({
            source: 'filetree',
            event: 'file-loaded'
          })
        })
      )
    })

    it('should handle unsaved changes warning flow', () => {
      const editorStore = useEditorStore()
      const events: any[] = []
      
      const unsub = storeBus.subscribe('editor', 'unsaved-changes-warning', (payload) => {
        events.push(payload)
      })
      unsubscribes.push(unsub)
      
      // Set up file with unsaved changes
      const currentFile = {
        path: '/test/current.md',
        name: 'current.md',
        type: 'file' as const,
        size: 100,
        lastModified: new Date()
      }
      
      editorStore.setCurrentFile(currentFile)
      editorStore.setContent('Modified')
      editorStore.setOriginalContent('Original')
      
      expect(editorStore.hasUnsavedChanges).toBe(true)
      
      // Emit warning event
      storeBus.emit('editor', 'unsaved-changes-warning', {
        currentFile,
        newFile: { path: '/test/new.md' }
      })
      
      // Verify warning was received
      expect(events).toHaveLength(1)
      expect(events[0]).toHaveProperty('currentFile')
      expect(events[0]).toHaveProperty('newFile')
    })
  })

  describe('Task 2: Save Communication Flow', () => {
    it('should complete save flow from editor to file tree', async () => {
      const editorStore = useEditorStore()
      const fileTreeStore = useFileTreeStore()
      
      const events: any[] = []
      const unsub = storeBus.subscribe('editor', 'file-saved', (payload) => {
        events.push(payload)
      })
      unsubscribes.push(unsub)
      
      const filePath = '/test/file.md'
      
      // Mark file as modified in tree
      fileTreeStore.setNodeModified(filePath, true)
      
      // Emit save event
      storeBus.emit('editor', 'file-saved', {
        path: filePath,
        timestamp: new Date()
      })
      
      // Verify event was received
      expect(events).toHaveLength(1)
      expect(events[0].path).toBe(filePath)
      
      // Clear modified state
      fileTreeStore.setNodeModified(filePath, false)
    })
  })

  describe('Task 3: Optimization Service Communication', () => {
    it('should complete optimization flow with progress updates', async () => {
      const optimizationStore = useOptimizationStore()
      const events: any[] = []
      
      const unsub = storeBus.subscribe('optimization', '*', (payload, event) => {
        events.push({ event, payload })
      })
      unsubscribes.push(unsub)
      
      // Start optimization
      storeBus.emit('optimization', 'started', { content: 'Test content' })
      
      // Update progress
      optimizationStore.setProgress(25)
      storeBus.emit('optimization', 'progress', { progress: 25 })
      
      optimizationStore.setProgress(50)
      storeBus.emit('optimization', 'progress', { progress: 50 })
      
      optimizationStore.setProgress(100)
      storeBus.emit('optimization', 'progress', { progress: 100 })
      
      // Complete optimization
      optimizationStore.status = 'completed'
      storeBus.emit('optimization', 'status-changed', { status: 'completed' })
      
      // Verify event sequence
      expect(events).toContainEqual(
        expect.objectContaining({ event: 'started' })
      )
      expect(events).toContainEqual(
        expect.objectContaining({ event: 'progress', payload: { progress: 25 } })
      )
      expect(events).toContainEqual(
        expect.objectContaining({ event: 'status-changed', payload: { status: 'completed' } })
      )
    })

    it('should handle optimization errors', () => {
      const optimizationStore = useOptimizationStore()
      const events: any[] = []
      
      const unsub = storeBus.subscribe('optimization', 'error', (payload) => {
        events.push(payload)
      })
      unsubscribes.push(unsub)
      
      const errorMessage = 'Optimization service unavailable'
      
      // Set error state
      optimizationStore.setError(errorMessage)
      storeBus.emit('optimization', 'error', { error: errorMessage })
      
      // Verify error event
      expect(events).toHaveLength(1)
      expect(events[0].error).toBe(errorMessage)
    })
  })

  describe('Task 4: Execution Results Communication', () => {
    it('should handle streaming execution results', () => {
      const executionStore = useExecutionStore()
      const events: any[] = []
      
      const unsub = storeBus.subscribe('execution', 'stream-update', (payload) => {
        events.push(payload)
      })
      unsubscribes.push(unsub)
      
      executionStore.currentExecutionId = 'exec-123'
      executionStore.isStreaming = true
      
      // Simulate streaming chunks
      const chunks = ['Starting...', 'Processing...', 'Complete!']
      
      chunks.forEach((chunk, index) => {
        storeBus.emit('execution', 'stream-update', {
          id: 'exec-123',
          chunk,
          type: 'stdout',
          timestamp: Date.now() + index * 100
        })
      })
      
      // Verify all chunks were received
      expect(events).toHaveLength(3)
      expect(events.map(e => e.chunk)).toEqual(chunks)
    })

    it('should handle execution completion', () => {
      const executionStore = useExecutionStore()
      
      executionStore.currentCommand = 'test command'
      executionStore.currentOutput = 'Test output'
      executionStore.status = 'completed'
      
      expect(executionStore.hasOutput).toBe(true)
      expect(executionStore.isExecuting).toBe(false)
      
      // Test copy functionality
      const copyResult = executionStore.copyOutput()
      expect(copyResult).toBe(true)
      
      // Test export functionality
      const exported = executionStore.exportOutput('json')
      expect(exported).toContain('test command')
      expect(exported).toContain('Test output')
    })
  })

  describe('Task 5: Global Error Handling', () => {
    it('should handle global errors through toast system', () => {
      const events: any[] = []
      
      const unsub = storeBus.subscribe('*', 'error', (payload) => {
        events.push(payload)
      })
      unsubscribes.push(unsub)
      
      // Emit various error types
      storeBus.emit('fileTree', 'error', { 
        operation: 'load', 
        message: 'Failed to load tree' 
      })
      
      storeBus.emit('editor', 'error', { 
        message: 'Failed to save file' 
      })
      
      storeBus.emit('optimization', 'error', { 
        error: 'Service unavailable' 
      })
      
      // Verify all errors were captured
      expect(events).toHaveLength(3)
    })
  })

  describe('Task 6: Loading State Coordination', () => {
    it('should coordinate multiple loading operations', () => {
      const appStore = useAppStore()
      
      // Start multiple operations
      appStore.startLoading('op1', 'Loading file...')
      appStore.startLoading('op2', 'Optimizing...')
      appStore.startLoading('op3', 'Executing...', true) // Critical
      
      expect(appStore.isLoading).toBe(true)
      expect(appStore.hasCriticalOperation).toBe(true)
      expect(appStore.loadingMessage).toContain('Executing')
      
      // Complete non-critical operations
      appStore.stopLoading('op1')
      appStore.stopLoading('op2')
      
      // Should still be loading due to critical operation
      expect(appStore.isLoading).toBe(true)
      expect(appStore.hasCriticalOperation).toBe(true)
      
      // Complete critical operation
      appStore.stopLoading('op3')
      
      expect(appStore.isLoading).toBe(false)
      expect(appStore.hasCriticalOperation).toBe(false)
    })
  })

  describe('Task 7: Keyboard Shortcuts', () => {
    it('should handle keyboard shortcut registration and execution', () => {
      const handled: string[] = []
      
      // Register test shortcut
      keyboardShortcutRegistry.register({
        id: 'test-shortcut',
        keys: { key: 's', ctrl: true },
        description: 'Test shortcut',
        handler: () => { handled.push('test-shortcut') },
        context: 'global',
        priority: 100,
        enabled: true
      })
      
      // Simulate keyboard event
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      })
      
      keyboardShortcutRegistry.handleKeydown(event)
      
      expect(handled).toContain('test-shortcut')
    })

    it('should respect context and priority', () => {
      const handled: string[] = []
      
      // Register conflicting shortcuts with different priorities
      keyboardShortcutRegistry.register({
        id: 'high-priority',
        keys: { key: 'a', ctrl: true },
        description: 'High priority',
        handler: () => { handled.push('high') },
        context: 'global',
        priority: 100,
        enabled: true
      })
      
      keyboardShortcutRegistry.register({
        id: 'low-priority',
        keys: { key: 'a', ctrl: true },
        description: 'Low priority',
        handler: () => { handled.push('low') },
        context: 'global',
        priority: 50,
        enabled: true
      })
      
      // Simulate keyboard event
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      })
      
      keyboardShortcutRegistry.handleKeydown(event)
      
      // Only high priority should be handled
      expect(handled).toEqual(['high'])
    })
  })

  describe('Task 8: Context Menu Operations', () => {
    it('should handle complete context menu operation flow', async () => {
      const fileTreeStore = useFileTreeStore()
      const appStore = useAppStore()
      const events: any[] = []
      
      const unsub = storeBus.subscribe('fileTree', '*', (payload, event) => {
        events.push({ event, payload })
      })
      unsubscribes.push(unsub)
      
      // Mock create file operation
      vi.spyOn(fileTreeStore, 'createFile').mockResolvedValue(true)
      
      // Start operation with loading
      appStore.startLoading('create-file', 'Creating file...')
      
      // Perform operation
      const success = await fileTreeStore.createFile('/test', 'newfile.md')
      
      expect(success).toBe(true)
      
      // Emit success event
      storeBus.emit('fileTree', 'file-created', {
        path: '/test/newfile.md',
        parentPath: '/test',
        fileName: 'newfile.md'
      })
      
      // Stop loading
      appStore.stopLoading('create-file')
      
      // Verify event flow
      expect(events).toContainEqual(
        expect.objectContaining({
          event: 'file-created',
          payload: expect.objectContaining({
            fileName: 'newfile.md'
          })
        })
      )
    })
  })

  describe('Cross-Component Communication', () => {
    it('should coordinate between multiple stores', async () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      const appStore = useAppStore()
      
      const events: any[] = []
      
      // Subscribe to all events
      const unsub = storeBus.subscribe('*', '*', (payload, event, source) => {
        events.push({ source, event, payload })
      })
      unsubscribes.push(unsub)
      
      // Simulate complete workflow
      const file = {
        path: '/test/doc.md',
        name: 'doc.md',
        type: 'file' as const,
        size: 100,
        lastModified: new Date()
      }
      
      // 1. Select file
      fileTreeStore.selectNode(file)
      storeBus.emit('fileTree', 'file-selected', { file })
      
      // 2. Load in editor
      appStore.startLoading('load-file', 'Loading...')
      await editorStore.loadFile(file, null)
      storeBus.emit('editor', 'file-loaded', { file })
      appStore.stopLoading('load-file')
      
      // 3. Modify content
      editorStore.setContent('Modified content')
      storeBus.emit('editor', 'content-changed', { 
        content: 'Modified content',
        isDirty: true
      })
      
      // 4. Save file
      appStore.startLoading('save-file', 'Saving...')
      editorStore.markFileSaved(file.path)
      storeBus.emit('editor', 'file-saved', { 
        path: file.path,
        timestamp: new Date()
      })
      appStore.stopLoading('save-file')
      
      // Verify complete event flow
      const eventTypes = events.map(e => e.event)
      expect(eventTypes).toContain('file-selected')
      expect(eventTypes).toContain('file-loaded')
      expect(eventTypes).toContain('content-changed')
      expect(eventTypes).toContain('file-saved')
    })
  })
})