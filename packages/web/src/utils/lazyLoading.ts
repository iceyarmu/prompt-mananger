// Lazy loading configuration for heavy components
import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'

// Loading component shown while lazy components load
const LoadingComponent = {
  template: `
    <div class="flex items-center justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span class="ml-2 text-gray-600">Loading...</span>
    </div>
  `
}

// Error component shown if lazy loading fails
const ErrorComponent = {
  template: `
    <div class="text-red-500 p-4 border border-red-300 rounded">
      <p>Failed to load component. Please refresh the page.</p>
    </div>
  `
}

// Lazy load heavy components with loading and error states
export const LazyComponents = {
  // Editor components (heavy due to Monaco/CodeMirror)
  MarkdownEditor: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/MarkdownEditor.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 200, // Show loading after 200ms
    timeout: 10000 // Timeout after 10s
  }),
  
  VirtualMarkdownEditor: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/VirtualMarkdownEditor.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 200,
    timeout: 10000
  }),
  
  // Optimization components
  OptimizationResultsModal: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/OptimizationResultsModal.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 0, // Show immediately since it's triggered by user action
    timeout: 15000
  }),
  
  OptimizationOptionsPopover: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/OptimizationOptionsPopover.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
  }),
  
  // Execution components
  ExecutionResultsPanel: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/ExecutionResultsPanel.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 200
  }),
  
  ExecutionOptionsPopover: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/ExecutionOptionsPopover.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
  }),
  
  // Data management components
  DataManager: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/DataManager.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 300
  }),
  
  // Model management
  ModelManager: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/ModelManager.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 300
  }),
  
  // Template management
  TemplateManager: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/TemplateManager.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 300
  }),
  
  // History components
  HistoryDrawer: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/HistoryDrawer.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 200
  }),
  
  // WebDAV configuration
  WebDAVConfigModal: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/WebDAVConfigModal.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 0
  }),
  
  // Diff viewer (heavy due to diff algorithms)
  TextDiff: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/TextDiff.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 200
  }),
  
  // Markdown renderer
  MarkdownRenderer: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/MarkdownRenderer.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 100
  }),
  
  // Output display components
  OutputDisplayFullscreen: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/OutputDisplayFullscreen.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
  }),
  
  // Feature flag admin
  FeatureFlagAdmin: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/FeatureFlagAdmin.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 300
  }),
  
  // Cutover dashboard
  CutoverDashboard: defineAsyncComponent({
    loader: () => import('@prompt-optimizer/ui/src/components/CutoverDashboard.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    delay: 300
  })
}

// Route-level lazy loading
export const LazyRoutes = {
  // Heavy route components
  Editor: () => import(
    /* webpackChunkName: "editor" */
    /* webpackPrefetch: true */
    '@/views/EditorView.vue'
  ),
  
  Settings: () => import(
    /* webpackChunkName: "settings" */
    '@/views/SettingsView.vue'
  ),
  
  DataManagement: () => import(
    /* webpackChunkName: "data-management" */
    '@/views/DataManagementView.vue'
  ),
  
  ModelManagement: () => import(
    /* webpackChunkName: "model-management" */
    '@/views/ModelManagementView.vue'
  ),
  
  TemplateManagement: () => import(
    /* webpackChunkName: "template-management" */
    '@/views/TemplateManagementView.vue'
  ),
  
  History: () => import(
    /* webpackChunkName: "history" */
    '@/views/HistoryView.vue'
  ),
  
  Analytics: () => import(
    /* webpackChunkName: "analytics" */
    '@/views/AnalyticsView.vue'
  ),
  
  Admin: () => import(
    /* webpackChunkName: "admin" */
    '@/views/AdminView.vue'
  )
}

// Service lazy loading
export const LazyServices = {
  // Heavy services loaded on demand
  OptimizationService: () => import(
    /* webpackChunkName: "optimization-service" */
    '@prompt-optimizer/core/src/services/prompt/service'
  ),
  
  LLMService: () => import(
    /* webpackChunkName: "llm-service" */
    '@prompt-optimizer/core/src/services/llm/service'
  ),
  
  WebDAVService: () => import(
    /* webpackChunkName: "webdav-service" */
    '@prompt-optimizer/webdav/src/service'
  ),
  
  TemplateProcessor: () => import(
    /* webpackChunkName: "template-processor" */
    '@prompt-optimizer/core/src/services/template/processor'
  ),
  
  DataManager: () => import(
    /* webpackChunkName: "data-manager" */
    '@prompt-optimizer/core/src/services/data/manager'
  )
}

// Preload critical components
export function preloadCriticalComponents() {
  // Preload editor if likely to be used
  if (window.location.pathname.includes('editor')) {
    import('@prompt-optimizer/ui/src/components/MarkdownEditor.vue')
  }
  
  // Preload optimization if on main page
  if (window.location.pathname === '/') {
    import('@prompt-optimizer/ui/src/components/OptimizationOptionsPopover.vue')
  }
}

// Progressive enhancement - load non-critical features after main content
export function loadEnhancements() {
  // Load analytics after initial render
  setTimeout(() => {
    import('@/services/analytics').then(({ initAnalytics }) => {
      initAnalytics()
    })
  }, 2000)
  
  // Load service worker for offline support
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      import('@/services/serviceWorker').then(({ registerSW }) => {
        registerSW()
      })
    }, 3000)
  }
  
  // Prefetch likely next routes
  setTimeout(() => {
    const currentPath = window.location.pathname
    
    if (currentPath === '/') {
      // Prefetch editor route from homepage
      import('@/views/EditorView.vue')
    } else if (currentPath.includes('editor')) {
      // Prefetch optimization components from editor
      import('@prompt-optimizer/ui/src/components/OptimizationResultsModal.vue')
      import('@prompt-optimizer/ui/src/components/ExecutionResultsPanel.vue')
    }
  }, 5000)
}

// Component registration helper
export function registerLazyComponent(app: any, name: string, component: Component) {
  app.component(name, component)
}

// Register all lazy components
export function registerAllLazyComponents(app: any) {
  Object.entries(LazyComponents).forEach(([name, component]) => {
    registerLazyComponent(app, name, component)
  })
}

// Export utility for checking if component should be lazy loaded
export function shouldLazyLoad(componentSize: number): boolean {
  // Lazy load components larger than 50KB
  const LAZY_LOAD_THRESHOLD = 50 * 1024
  return componentSize > LAZY_LOAD_THRESHOLD
}

// Memory management for lazy components
export function unloadComponent(componentName: string) {
  // Clear module from cache to free memory
  const moduleId = `@prompt-optimizer/ui/src/components/${componentName}.vue`
  if (import.meta.hot) {
    import.meta.hot.invalidate(moduleId)
  }
}

export default {
  LazyComponents,
  LazyRoutes,
  LazyServices,
  preloadCriticalComponents,
  loadEnhancements,
  registerAllLazyComponents,
  shouldLazyLoad,
  unloadComponent
}