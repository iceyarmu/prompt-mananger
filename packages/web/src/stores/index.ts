import { createPinia } from 'pinia'
import type { App } from 'vue'
import { setupStoreCommunication } from './communication'
import { createPersistedState } from './persistence'

// Create pinia instance
const pinia = createPinia()

// Add persistence plugin
pinia.use(createPersistedState())

// Install function for Vue app
export function installPinia(app: App) {
  app.use(pinia)
  
  // Setup cross-store communication after Pinia is installed
  // Use nextTick to ensure stores are available
  import('vue').then(({ nextTick }) => {
    nextTick(() => {
      setupStoreCommunication()
    })
  })
}

// Export pinia instance for direct use if needed
export { pinia }

// Re-export all stores (will be added as we create them)
export * from './app'
export * from './fileTree'
export * from './editor'
export * from './webdav'
export * from './preferences'
export * from './optimization'
export * from './communication'
export * from './persistence'