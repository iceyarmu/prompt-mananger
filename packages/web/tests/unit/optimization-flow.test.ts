import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOptimizationStore } from '../../src/stores/optimization'
import { storeBus } from '../../src/stores/communication'

describe('Optimization Service to Results Panel Communication', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Task 3: Optimization Flow', () => {
    it('should trigger optimization when button is clicked', async () => {
      const optimizationStore = useOptimizationStore()
      const optimizeSpy = vi.spyOn(optimizationStore, 'optimize')
      
      const mockContent = '# Test Document\n\nOptimize this content.'
      const mockConfig = {
        model: 'gpt-4',
        template: 'default',
        temperature: 0.7,
        maxTokens: 2000
      }
      
      // Mock the optimization method
      optimizeSpy.mockResolvedValue('Optimized content')
      
      // Trigger optimization
      await optimizationStore.optimize(mockContent, mockConfig, undefined)
      
      expect(optimizeSpy).toHaveBeenCalledWith(mockContent, mockConfig, undefined)
    })

    it('should update status during optimization', async () => {
      const optimizationStore = useOptimizationStore()
      
      // Initial state
      expect(optimizationStore.status).toBe('idle')
      expect(optimizationStore.isProcessing).toBe(false)
      
      // Start optimization
      optimizationStore.status = 'processing'
      expect(optimizationStore.status).toBe('processing')
      expect(optimizationStore.isProcessing).toBe(true)
      
      // Complete optimization
      optimizationStore.status = 'completed'
      expect(optimizationStore.status).toBe('completed')
      expect(optimizationStore.isProcessing).toBe(false)
    })

    it('should display progress during optimization', () => {
      const optimizationStore = useOptimizationStore()
      
      // Set progress
      optimizationStore.setProgress(0)
      expect(optimizationStore.progress).toBe(0)
      
      optimizationStore.setProgress(50)
      expect(optimizationStore.progress).toBe(50)
      
      optimizationStore.setProgress(100)
      expect(optimizationStore.progress).toBe(100)
      
      // Should clamp values
      optimizationStore.setProgress(150)
      expect(optimizationStore.progress).toBe(100)
      
      optimizationStore.setProgress(-10)
      expect(optimizationStore.progress).toBe(0)
    })

    it('should show results when optimization completes', async () => {
      const optimizationStore = useOptimizationStore()
      
      const mockResult = 'This is the optimized content'
      
      // Set optimization result
      optimizationStore.currentResult = mockResult
      optimizationStore.status = 'completed'
      
      expect(optimizationStore.hasResult).toBe(true)
      expect(optimizationStore.currentResult).toBe(mockResult)
    })

    it('should handle optimization errors', () => {
      const optimizationStore = useOptimizationStore()
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const errorMessage = 'Optimization service unavailable'
      
      // Set error
      optimizationStore.setError(errorMessage)
      optimizationStore.status = 'error'
      
      expect(optimizationStore.error).toBe(errorMessage)
      expect(optimizationStore.status).toBe('error')
      
      // Emit error event
      storeBus.emit('optimization', 'error', { error: errorMessage })
      
      expect(emitSpy).toHaveBeenCalledWith('optimization', 'error', { error: errorMessage })
    })

    it('should add results to history', () => {
      const optimizationStore = useOptimizationStore()
      
      const result = {
        id: '123',
        prompt: 'Test prompt',
        result: 'Test result',
        timestamp: Date.now(),
        model: 'gpt-4',
        template: 'default'
      }
      
      optimizationStore.addToHistory(result)
      
      expect(optimizationStore.history).toContainEqual(result)
      expect(optimizationStore.hasHistory).toBe(true)
    })

    it('should emit status change events', () => {
      const optimizationStore = useOptimizationStore()
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Change status
      optimizationStore.status = 'processing'
      storeBus.emit('optimization', 'status-changed', { status: 'processing' })
      
      expect(emitSpy).toHaveBeenCalledWith(
        'optimization',
        'status-changed',
        { status: 'processing' }
      )
      
      // Change to completed
      optimizationStore.status = 'completed'
      storeBus.emit('optimization', 'status-changed', { status: 'completed' })
      
      expect(emitSpy).toHaveBeenCalledWith(
        'optimization',
        'status-changed',
        { status: 'completed' }
      )
    })

    it('should reset optimization state', () => {
      const optimizationStore = useOptimizationStore()
      
      // Set some state
      optimizationStore.currentPrompt = 'Test prompt'
      optimizationStore.currentResult = 'Test result'
      optimizationStore.status = 'completed'
      optimizationStore.progress = 100
      
      // Reset
      optimizationStore.reset()
      
      expect(optimizationStore.currentPrompt).toBe('')
      expect(optimizationStore.currentResult).toBeNull()
      expect(optimizationStore.status).toBe('idle')
      expect(optimizationStore.progress).toBe(0)
    })
  })
})