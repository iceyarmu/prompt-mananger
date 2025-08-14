import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../../src/stores/app'

describe('Loading States Coordination', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Task 6: Loading State Management', () => {
    it('should track loading operations', () => {
      const appStore = useAppStore()
      
      // Start a loading operation
      appStore.startLoading('test-op-1', 'Loading test data...')
      
      expect(appStore.isLoading).toBe(true)
      expect(appStore.loadingMessage).toBe('Loading test data...')
      expect(appStore.activeOperationsCount).toBe(1)
      expect(appStore.hasActiveOperations).toBe(true)
    })

    it('should coordinate multiple concurrent operations', () => {
      const appStore = useAppStore()
      
      // Start multiple operations
      appStore.startLoading('op-1', 'Loading files...')
      appStore.startLoading('op-2', 'Processing data...')
      appStore.startLoading('op-3', 'Saving changes...')
      
      expect(appStore.activeOperationsCount).toBe(3)
      expect(appStore.hasActiveOperations).toBe(true)
      
      // Stop one operation
      appStore.stopLoading('op-1')
      expect(appStore.activeOperationsCount).toBe(2)
      expect(appStore.isLoading).toBe(true)
      
      // Stop remaining operations
      appStore.stopLoading('op-2')
      appStore.stopLoading('op-3')
      
      expect(appStore.activeOperationsCount).toBe(0)
      expect(appStore.isLoading).toBe(false)
      expect(appStore.loadingMessage).toBe('')
    })

    it('should block interaction for critical operations', () => {
      const appStore = useAppStore()
      
      // Start a critical operation
      appStore.startLoading('critical-op', 'Critical operation...', true)
      
      expect(appStore.blockedInteraction).toBe(true)
      expect(appStore.hasCriticalOperation).toBe(true)
      
      // Add non-critical operation
      appStore.startLoading('normal-op', 'Normal operation...')
      
      expect(appStore.blockedInteraction).toBe(true) // Still blocked
      
      // Stop critical operation
      appStore.stopLoading('critical-op')
      
      expect(appStore.blockedInteraction).toBe(false) // Unblocked
      expect(appStore.hasCriticalOperation).toBe(false)
    })

    it('should update loading messages', () => {
      const appStore = useAppStore()
      
      appStore.startLoading('op-1', 'Starting...')
      expect(appStore.loadingMessage).toBe('Starting...')
      
      appStore.updateLoadingMessage('op-1', 'Processing... 50%')
      expect(appStore.loadingMessage).toBe('Processing... 50%')
      
      appStore.updateLoadingMessage('op-1', 'Almost done...')
      expect(appStore.loadingMessage).toBe('Almost done...')
    })

    it('should show operation-specific messages', () => {
      const appStore = useAppStore()
      
      appStore.startLoading('file-load', 'Loading document.md...')
      expect(appStore.loadingMessage).toBe('Loading document.md...')
      
      appStore.startLoading('optimization', 'Optimizing content...')
      // Latest operation message should be shown
      expect(appStore.loadingMessage).toBe('Optimizing content...')
    })

    it('should clear all loading operations', () => {
      const appStore = useAppStore()
      
      // Add multiple operations
      appStore.startLoading('op-1', 'Op 1')
      appStore.startLoading('op-2', 'Op 2', true)
      appStore.startLoading('op-3', 'Op 3')
      
      expect(appStore.activeOperationsCount).toBe(3)
      expect(appStore.blockedInteraction).toBe(true)
      
      // Clear all
      appStore.clearAllLoading()
      
      expect(appStore.activeOperationsCount).toBe(0)
      expect(appStore.isLoading).toBe(false)
      expect(appStore.loadingMessage).toBe('')
      expect(appStore.blockedInteraction).toBe(false)
    })

    it('should emit loading events', () => {
      const appStore = useAppStore()
      
      // Mock window.storeBus
      const emitMock = vi.fn()
      ;(window as any).storeBus = {
        emit: emitMock
      }
      
      // Start loading
      appStore.startLoading('test-op', 'Testing...', true)
      
      expect(emitMock).toHaveBeenCalledWith(
        'app',
        'loading-started',
        expect.objectContaining({
          id: 'test-op',
          message: 'Testing...',
          isCritical: true
        })
      )
      
      // Stop loading
      appStore.stopLoading('test-op')
      
      expect(emitMock).toHaveBeenCalledWith(
        'app',
        'loading-stopped',
        expect.objectContaining({
          id: 'test-op',
          duration: expect.any(Number)
        })
      )
    })

    it('should handle operation not found gracefully', () => {
      const appStore = useAppStore()
      
      // Try to stop non-existent operation
      expect(() => {
        appStore.stopLoading('non-existent')
      }).not.toThrow()
      
      // Try to update non-existent operation
      expect(() => {
        appStore.updateLoadingMessage('non-existent', 'Message')
      }).not.toThrow()
    })

    it('should reset loading state with app reset', () => {
      const appStore = useAppStore()
      
      // Set up various states
      appStore.startLoading('op-1', 'Loading...')
      appStore.setError('Test error')
      appStore.setInitialized(true)
      
      // Reset
      appStore.reset()
      
      expect(appStore.isInitialized).toBe(false)
      expect(appStore.isLoading).toBe(false)
      expect(appStore.error).toBeNull()
      expect(appStore.activeOperationsCount).toBe(0)
      expect(appStore.loadingMessage).toBe('')
      expect(appStore.blockedInteraction).toBe(false)
    })
  })
})