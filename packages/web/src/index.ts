import { createApp } from 'vue'
import { installI18nOnly } from '@prompt-optimizer/ui'
import AppRoot from './AppRoot.vue'
import { loadConfiguration } from './config/configuration'
import { initializeServices } from './services/ServiceRegistry'
import { setupErrorHandling } from './utils/errorHandling'
import { createLogger } from './utils/logger'

import '@prompt-optimizer/ui/dist/style.css'

// Create logger instance
const logger = createLogger('Application')

async function bootstrap() {
  try {
    logger.info('Starting application bootstrap...')
    
    // Load configuration from environment variables
    const config = loadConfiguration()
    logger.debug('Configuration loaded', config)
    
    // Setup global error handling
    setupErrorHandling()
    
    // Create Vue app
    const app = createApp(AppRoot)
    
    // Install i18n plugin
    installI18nOnly(app)
    
    // Initialize services
    const services = await initializeServices(config)
    
    // Provide services to app
    app.provide('services', services)
    app.provide('config', config)
    app.provide('logger', logger)
    
    // Mount app
    app.mount('#app')
    
    logger.info('Application bootstrap completed successfully')
    
    // Load Vercel Analytics in production
    if (import.meta.env.VITE_VERCEL_DEPLOYMENT === 'true') {
      loadVercelAnalytics()
    }
  } catch (error) {
    logger.error('Failed to bootstrap application', error)
    throw error
  }
}

function loadVercelAnalytics() {
  const loadAnalytics = () => {
    const script = document.createElement('script')
    script.src = '/_vercel/insights/script.js'
    script.defer = true
    script.onload = () => logger.info('Vercel Analytics loaded')
    script.onerror = () => logger.warn('Failed to load Vercel Analytics')
    document.head.appendChild(script)
  }
  
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', loadAnalytics)
  } else {
    loadAnalytics()
  }
}

// Start application
bootstrap().catch(error => {
  console.error('Critical error during application startup:', error)
})