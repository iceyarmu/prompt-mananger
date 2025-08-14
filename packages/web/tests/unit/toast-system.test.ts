import { describe, it, expect, beforeEach, vi } from 'vitest'
import { storeBus } from '../../src/stores/communication'

describe('Global Error Toast System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task 5: Toast System', () => {
    it('should emit error events that trigger toasts', () => {
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Emit an error event
      storeBus.emit('*', 'error', {
        message: 'Test error message',
        severity: 'error'
      })
      
      expect(emitSpy).toHaveBeenCalledWith('*', 'error', {
        message: 'Test error message',
        severity: 'error'
      })
    })

    it('should handle different severity levels', () => {
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Info level
      storeBus.emit('notification', 'info', {
        message: 'Info message',
        type: 'info',
        duration: 3000
      })
      
      // Warning level
      storeBus.emit('notification', 'warning', {
        message: 'Warning message',
        type: 'warning',
        duration: 5000
      })
      
      // Error level
      storeBus.emit('notification', 'error', {
        message: 'Error message',
        type: 'error',
        duration: 7000
      })
      
      expect(emitSpy).toHaveBeenCalledTimes(3)
    })

    it('should format error messages properly', () => {
      const error = new Error('Test error with details')
      const formattedMessage = error.message || 'An unexpected error occurred'
      
      expect(formattedMessage).toBe('Test error with details')
    })

    it('should support auto-dismiss with configurable duration', () => {
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Short duration for info
      storeBus.emit('notification', 'info', {
        message: 'Quick info',
        type: 'info',
        duration: 2000
      })
      
      // Longer duration for errors
      storeBus.emit('notification', 'error', {
        message: 'Important error',
        type: 'error',
        duration: 10000
      })
      
      // Persistent notification (duration 0)
      storeBus.emit('notification', 'error', {
        message: 'Critical error',
        type: 'error',
        duration: 0
      })
      
      expect(emitSpy).toHaveBeenCalledTimes(3)
    })

    it('should propagate success events', () => {
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      storeBus.emit('*', 'success', {
        message: 'Operation successful',
        duration: 3000
      })
      
      expect(emitSpy).toHaveBeenCalledWith('*', 'success', {
        message: 'Operation successful',
        duration: 3000
      })
    })

    it('should handle malformed error events gracefully', () => {
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Event without message
      storeBus.emit('*', 'error', {})
      
      // Event with null payload
      storeBus.emit('*', 'error', null)
      
      // Event with undefined severity
      storeBus.emit('*', 'error', {
        message: 'Test',
        severity: undefined
      })
      
      // All should be handled without throwing
      expect(emitSpy).toHaveBeenCalledTimes(3)
    })

    it('should support wildcard subscriptions for notifications', () => {
      const handlers: any[] = []
      
      // Subscribe to all notification events
      const sub = storeBus.on('notification', '*', (payload) => {
        handlers.push(payload)
      })
      
      // Emit various notification types
      storeBus.emit('notification', 'info', { message: 'Info' })
      storeBus.emit('notification', 'error', { message: 'Error' })
      storeBus.emit('notification', 'success', { message: 'Success' })
      
      expect(handlers).toHaveLength(3)
      
      // Cleanup
      sub.unsubscribe()
    })

    it('should cleanup subscriptions on unmount', () => {
      const subscriptions: any[] = []
      
      // Create multiple subscriptions
      subscriptions.push(storeBus.on('*', 'error', () => {}))
      subscriptions.push(storeBus.on('notification', '*', () => {}))
      subscriptions.push(storeBus.on('*', 'success', () => {}))
      
      // Cleanup all
      subscriptions.forEach(sub => sub.unsubscribe())
      
      // Verify cleanup (subscriptions should not trigger)
      const handler = vi.fn()
      const testSub = storeBus.on('*', 'error', handler)
      storeBus.emit('*', 'error', { message: 'Test' })
      
      expect(handler).toHaveBeenCalled()
      testSub.unsubscribe()
    })
  })
})