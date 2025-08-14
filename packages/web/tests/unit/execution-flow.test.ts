import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExecutionStore } from '../../src/stores/execution'
import { storeBus } from '../../src/stores/communication'

describe('Execution Results Display', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Task 4: Execution Flow', () => {
    it('should trigger execution when button is clicked', async () => {
      const executionStore = useExecutionStore()
      const executeSpy = vi.spyOn(executionStore, 'execute')
      
      const mockCommand = 'console.log("Hello World")'
      const mockService = {
        execute: vi.fn().mockResolvedValue('Hello World')
      }
      
      // Execute command
      await executionStore.execute(mockCommand, mockService)
      
      expect(executeSpy).toHaveBeenCalledWith(mockCommand, mockService)
      expect(mockService.execute).toHaveBeenCalled()
    })

    it('should update status during execution', () => {
      const executionStore = useExecutionStore()
      
      // Initial state
      expect(executionStore.status).toBe('idle')
      expect(executionStore.isExecuting).toBe(false)
      
      // Start execution
      executionStore.status = 'executing'
      expect(executionStore.status).toBe('executing')
      expect(executionStore.isExecuting).toBe(true)
      
      // Complete execution
      executionStore.status = 'completed'
      expect(executionStore.status).toBe('completed')
      expect(executionStore.isExecuting).toBe(false)
    })

    it('should handle streaming output', () => {
      const executionStore = useExecutionStore()
      
      // Start streaming
      executionStore.isStreaming = true
      executionStore.appendStreamChunk('Hello ')
      executionStore.appendStreamChunk('World')
      
      expect(executionStore.currentOutput).toBe('Hello World')
      expect(executionStore.streamBuffer).toEqual(['Hello ', 'World'])
    })

    it('should display execution results when completed', () => {
      const executionStore = useExecutionStore()
      
      const mockOutput = 'Execution completed successfully'
      
      // Set execution result
      executionStore.currentOutput = mockOutput
      executionStore.status = 'completed'
      
      expect(executionStore.hasOutput).toBe(true)
      expect(executionStore.currentOutput).toBe(mockOutput)
    })

    it('should handle execution errors', () => {
      const executionStore = useExecutionStore()
      
      const errorMessage = 'Command failed to execute'
      
      // Set error
      executionStore.setError(errorMessage)
      executionStore.status = 'error'
      
      expect(executionStore.error).toBe(errorMessage)
      expect(executionStore.status).toBe('error')
    })

    it('should enable copy functionality', () => {
      const executionStore = useExecutionStore()
      
      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      })
      
      executionStore.currentOutput = 'Test output'
      const result = executionStore.copyOutput()
      
      expect(result).toBe(true)
      expect(writeTextMock).toHaveBeenCalledWith('Test output')
    })

    it('should export output in different formats', () => {
      const executionStore = useExecutionStore()
      
      executionStore.currentCommand = 'test command'
      executionStore.currentOutput = 'test output'
      
      // Export as text
      const textExport = executionStore.exportOutput('text')
      expect(textExport).toBe('test output')
      
      // Export as JSON
      const jsonExport = executionStore.exportOutput('json')
      const parsed = JSON.parse(jsonExport!)
      expect(parsed.command).toBe('test command')
      expect(parsed.output).toBe('test output')
    })

    it('should stop execution in progress', () => {
      const executionStore = useExecutionStore()
      
      // Start execution
      executionStore.status = 'executing'
      executionStore.isStreaming = true
      executionStore.currentCommand = 'long running command'
      executionStore.currentOutput = 'partial output'
      
      // Stop execution
      executionStore.stopExecution()
      
      expect(executionStore.status).toBe('completed')
      expect(executionStore.isStreaming).toBe(false)
    })

    it('should add results to history', () => {
      const executionStore = useExecutionStore()
      
      const result = {
        id: '123',
        command: 'test command',
        output: 'test output',
        timestamp: Date.now(),
        status: 'completed' as const
      }
      
      executionStore.addToHistory(result)
      
      expect(executionStore.history).toContainEqual(result)
      expect(executionStore.hasHistory).toBe(true)
    })

    it('should emit stream update events', () => {
      const executionStore = useExecutionStore()
      
      // Mock window.storeBus
      const emitMock = vi.fn()
      ;(window as any).storeBus = {
        emit: emitMock
      }
      
      executionStore.currentExecutionId = 'test-id'
      executionStore.appendStreamChunk('chunk data')
      
      expect(emitMock).toHaveBeenCalledWith(
        'execution',
        'stream-update',
        expect.objectContaining({
          id: 'test-id',
          chunk: 'chunk data',
          type: 'stdout'
        })
      )
    })
  })
})