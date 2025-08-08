<template>
  <div id="app-root">
    <ErrorBoundary>
      <template v-if="isInitialized">
        <AppContent />
      </template>
      <template v-else>
        <AppLoading :status="initializationStatus" :error="initializationError" />
      </template>
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, onErrorCaptured, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import ErrorBoundary from './components/ErrorBoundary.vue'
import AppLoading from './components/AppLoading.vue'
import AppContent from './AppContent.vue'
import type { ServiceRegistry } from './services/ServiceRegistry'
import type { Logger } from './utils/logger'

// Inject services and logger
const services = inject<ServiceRegistry>('services')!
const logger = inject<Logger>('logger')!

// Application state
const isInitialized = ref(false)
const initializationStatus = ref('Starting application...')
const initializationError = ref<Error | null>(null)

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
    ElMessage.error({
      message: 'Failed to initialize application. Please refresh the page.',
      duration: 0,
      showClose: true
    })
  }
})

// Global error handler
onErrorCaptured((error, instance, info) => {
  logger.error('Global error captured', { error, info })
  
  // Show user-friendly error message
  ElMessage.error({
    message: 'An unexpected error occurred. The error has been logged.',
    duration: 5000
  })
  
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