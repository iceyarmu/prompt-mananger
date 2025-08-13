import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AppState {
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  version: string
  environment: 'web' | 'electron' | 'extension'
}

export const useAppStore = defineStore('app', () => {
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const version = ref('1.4.1')
  const environment = ref<'web' | 'electron' | 'extension'>('web')
  
  const hasError = computed(() => error.value !== null)
  
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
  }
  
  return {
    isInitialized,
    isLoading,
    error,
    version,
    environment,
    hasError,
    setInitialized,
    setLoading,
    setError,
    setEnvironment,
    clearError,
    reset
  }
})