<template>
  <div id="app-root">
    <ErrorBoundary>
      <template v-if="isInitialized">
        <SystemRouter 
          component-name="AppContent"
          :show-indicator="showSystemIndicator"
          @system-switched="handleSystemSwitch"
          @component-error="handleComponentError"
          @fallback-triggered="handleFallback"
        />
      </template>
      <template v-else>
        <AppLoading :status="initializationStatus" :error="initializationError" />
      </template>
    </ErrorBoundary>
    <!-- Task 5: Global Toast System -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, onErrorCaptured, onUnmounted } from 'vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import AppLoading from './components/AppLoading.vue'
import SystemRouter from './components/SystemRouter.vue'
import { ToastUI as Toast, useToast } from '@prompt-optimizer/ui'
import { useStoreCommunication } from './stores/communication'
import type { ServiceRegistry } from './services/ServiceRegistry'
import type { Logger } from './utils/logger'

// Inject services and logger
const services = inject<ServiceRegistry>('services')!
const logger = inject<Logger>('logger')!

// Task 5: Setup toast and store communication
const toast = useToast()
const { subscribe, cleanup: cleanupSubscriptions } = useStoreCommunication()

// Application state
const isInitialized = ref(false)
const initializationStatus = ref('Starting application...')
const initializationError = ref<Error | null>(null)
const showSystemIndicator = ref(import.meta.env.DEV)

// Task 5.1: Subscribe to global error events
subscribe('*', 'error', (payload) => {
  const message = payload?.message || 'An error occurred'
  const severity = payload?.severity || 'error'
  
  // Task 5.4: Add error severity levels
  switch (severity) {
    case 'info':
      toast.info(message, payload?.duration || 3000)
      break
    case 'warning':
      toast.warning(message, payload?.duration || 5000)
      break
    case 'error':
      toast.error(message, payload?.duration || 7000)
      break
    default:
      toast.error(message, 5000)
  }
  
  logger.error('Global error event', { message, severity, payload })
})

// Task 5.2: Implement toast notification display logic
subscribe('notification', '*', (payload) => {
  const message = payload?.message || ''
  const type = payload?.type || 'info'
  const duration = payload?.duration || 3000
  
  if (message) {
    toast.add(message, type, duration)
  }
})

// Subscribe to success events
subscribe('*', 'success', (payload) => {
  const message = payload?.message
  if (message) {
    toast.success(message, payload?.duration || 3000)
  }
})

// System Router handlers
function handleSystemSwitch(system: 'old' | 'new') {
  logger.info(`System switched to ${system}`, { system });
  
  // Track system switch
  if ((window as any).analytics) {
    (window as any).analytics.track('system_cutover', {
      system,
      timestamp: Date.now(),
      userId: localStorage.getItem('userId')
    });
  }
  
  // Notify user of system change
  if (system === 'new') {
    toast.info('You are now using the new platform!', 5000);
  } else {
    toast.info('Switched back to the classic system', 5000);
  }
}

function handleComponentError(error: Error) {
  logger.error('Component loading error', { error });
  toast.error('Failed to load component. Please refresh the page.', 0);
}

function handleFallback(reason: string) {
  logger.warn('Fallback triggered', { reason });
  toast.warning('Falling back to classic system due to an issue', 5000);
}

// Lifecycle management
onMounted(async () => {
  try {
    logger.info('AppRoot mounted, starting initialization')
    
    // Verify services are available
    initializationStatus.value = 'Verifying services...'
    if (!services) {
      throw new Error('Services not available')
    }
    
    // Perform health checks
    initializationStatus.value = 'Running health checks...'
    const healthResults = await services.performHealthChecks()
    
    const failedChecks = healthResults.filter(r => !r.healthy)
    if (failedChecks.length > 0) {
      logger.warn('Some services failed health checks', failedChecks)
      // Non-critical services can fail without blocking startup
      const criticalFailures = failedChecks.filter(r => 
        ['StorageService', 'PreferenceService'].includes(r.service)
      )
      if (criticalFailures.length > 0) {
        throw new Error(`Critical services unhealthy: ${criticalFailures.map(r => r.service).join(', ')}`)
      }
    }
    
    // Load user preferences
    initializationStatus.value = 'Loading preferences...'
    await services.preferenceService.loadPreferences()
    
    // Application ready
    initializationStatus.value = 'Ready'
    isInitialized.value = true
    logger.info('Application initialization completed')
    
  } catch (error) {
    logger.error('Failed to initialize application', error)
    initializationError.value = error as Error
    initializationStatus.value = 'Initialization failed'
    // Task 5.3: Create error message formatting
    toast.error('Failed to initialize application. Please refresh the page.', 0) // Duration 0 = persistent
  }
})

// Global error handler
onErrorCaptured((error, instance, info) => {
  logger.error('Global error captured', { error, info })
  
  // Task 5.3: Format error messages based on type
  let message = 'An unexpected error occurred'
  if (error instanceof Error) {
    message = error.message || message
  }
  
  // Show user-friendly error message with auto-dismiss
  toast.error(message, 5000)
  
  // Prevent error from propagating in production
  if (import.meta.env.PROD) {
    return false
  }
})

// Cleanup on unmount
onUnmounted(() => {
  logger.info('AppRoot unmounting, performing cleanup')
  // Ensure cleanup is called even if services not fully initialized
  try {
    services?.cleanup?.()
    cleanupSubscriptions()
  } catch (error) {
    logger.error('Error during cleanup', error)
  }
})
</script>

<style scoped>
#app-root {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>