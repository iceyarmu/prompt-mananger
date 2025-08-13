import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../../../src/stores/app'

describe('App Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default values', () => {
    const store = useAppStore()
    
    expect(store.isInitialized).toBe(false)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBe(null)
    expect(store.version).toBe('1.4.1')
    expect(store.environment).toBe('web')
    expect(store.hasError).toBe(false)
  })

  it('should set initialized state', () => {
    const store = useAppStore()
    
    store.setInitialized(true)
    expect(store.isInitialized).toBe(true)
    
    store.setInitialized(false)
    expect(store.isInitialized).toBe(false)
  })

  it('should set loading state', () => {
    const store = useAppStore()
    
    store.setLoading(true)
    expect(store.isLoading).toBe(true)
    
    store.setLoading(false)
    expect(store.isLoading).toBe(false)
  })

  it('should set and clear errors', () => {
    const store = useAppStore()
    
    store.setError('Test error message')
    expect(store.error).toBe('Test error message')
    expect(store.hasError).toBe(true)
    
    store.clearError()
    expect(store.error).toBe(null)
    expect(store.hasError).toBe(false)
  })

  it('should set environment', () => {
    const store = useAppStore()
    
    store.setEnvironment('electron')
    expect(store.environment).toBe('electron')
    
    store.setEnvironment('extension')
    expect(store.environment).toBe('extension')
    
    store.setEnvironment('web')
    expect(store.environment).toBe('web')
  })

  it('should reset all state', () => {
    const store = useAppStore()
    
    // Set various states
    store.setInitialized(true)
    store.setLoading(true)
    store.setError('Test error')
    store.setEnvironment('electron')
    
    // Reset
    store.reset()
    
    // Check all values are back to defaults
    expect(store.isInitialized).toBe(false)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBe(null)
    // Note: environment is not reset
    expect(store.environment).toBe('electron')
  })
})