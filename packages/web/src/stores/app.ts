import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AppState {
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  version: string
  environment: 'web' | 'electron' | 'extension'
}

export interface LoadingOperation {
  id: string
  message: string
  startTime: number
  isCritical?: boolean
}

export const useAppStore = defineStore('app', () => {
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const version = ref('1.4.1')
  const environment = ref<'web' | 'electron' | 'extension'>('web')
  
  // Task 6.1: Implement global loading state in app store
  const loadingOperations = ref<Map<string, LoadingOperation>>(new Map())
  const loadingMessage = ref<string>('')
  const blockedInteraction = ref(false)
  
  const hasError = computed(() => error.value !== null)
  
  // Task 6.3: Coordinate multiple concurrent loading operations
  const activeOperationsCount = computed(() => loadingOperations.value.size)
  const hasActiveOperations = computed(() => activeOperationsCount.value > 0)
  const hasCriticalOperation = computed(() => 
    Array.from(loadingOperations.value.values()).some(op => op.isCritical)
  )
  
  const setInitialized = (value: boolean) => {
    isInitialized.value = value
  }
  
  const setLoading = (value: boolean) => {
    isLoading.value = value
  }
  
  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }
  
  const setEnvironment = (env: 'web' | 'electron' | 'extension') => {
    environment.value = env
  }
  
  const clearError = () => {
    error.value = null
  }
  
  const reset = () => {
    isInitialized.value = false
    isLoading.value = false
    error.value = null
    loadingOperations.value.clear()
    loadingMessage.value = ''
    blockedInteraction.value = false
  }
  
  // Task 6.2: Add loading indicators to all async operations
  const startLoading = (id: string, message: string = 'Loading...', isCritical: boolean = false) => {
    const operation: LoadingOperation = {
      id,
      message,
      startTime: Date.now(),
      isCritical
    }
    
    loadingOperations.value.set(id, operation)
    
    // Task 6.5: Show operation-specific loading messages
    loadingMessage.value = message
    isLoading.value = true
    
    // Task 6.4: Prevent user interaction during critical operations
    if (isCritical) {
      blockedInteraction.value = true
    }
    
    // Emit loading event
    const { storeBus } = window as any
    if (storeBus) {
      storeBus.emit('app', 'loading-started', { id, message, isCritical })
    }
  }
  
  const stopLoading = (id: string) => {
    const operation = loadingOperations.value.get(id)
    if (operation) {
      loadingOperations.value.delete(id)
      
      // Update loading state
      if (loadingOperations.value.size === 0) {
        isLoading.value = false
        loadingMessage.value = ''
        blockedInteraction.value = false
      } else {
        // Show message from next operation
        const nextOp = Array.from(loadingOperations.value.values())[0]
        loadingMessage.value = nextOp.message
        
        // Check if any remaining operations are critical
        blockedInteraction.value = hasCriticalOperation.value
      }
      
      // Calculate duration
      const duration = Date.now() - operation.startTime
      
      // Emit loading complete event
      const { storeBus } = window as any
      if (storeBus) {
        storeBus.emit('app', 'loading-stopped', { id, duration })
      }
    }
  }
  
  const updateLoadingMessage = (id: string, message: string) => {
    const operation = loadingOperations.value.get(id)
    if (operation) {
      operation.message = message
      loadingOperations.value.set(id, operation)
      
      // Update displayed message if this is the current operation
      if (loadingMessage.value && loadingOperations.value.size === 1) {
        loadingMessage.value = message
      }
    }
  }
  
  const clearAllLoading = () => {
    loadingOperations.value.clear()
    isLoading.value = false
    loadingMessage.value = ''
    blockedInteraction.value = false
  }
  
  return {
    isInitialized,
    isLoading,
    error,
    version,
    environment,
    hasError,
    loadingOperations,
    loadingMessage,
    blockedInteraction,
    activeOperationsCount,
    hasActiveOperations,
    hasCriticalOperation,
    setInitialized,
    setLoading,
    setError,
    setEnvironment,
    clearError,
    reset,
    startLoading,
    stopLoading,
    updateLoadingMessage,
    clearAllLoading
  }
})