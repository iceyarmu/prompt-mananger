import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PromptService } from '../services/ServiceRegistry'

export interface OptimizationTemplate {
  id: string
  name: string
  content: string
  type: 'system' | 'user'
  category?: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface OptimizationResult {
  id: string
  prompt: string
  result: string
  timestamp: number
  model?: string
  template?: string
  metadata?: Record<string, any>
}

export interface OptimizationConfig {
  model: string
  template: string
  temperature?: number
  maxTokens?: number
  topP?: number
}

export const useOptimizationStore = defineStore('optimization', () => {
  const currentOptimizationId = ref<string | null>(null)
  const currentPrompt = ref('')
  const currentResult = ref<string | null>(null)
  const status = ref<'idle' | 'processing' | 'completed' | 'error'>('idle')
  const error = ref<string | null>(null)
  const progress = ref(0)
  const history = ref<OptimizationResult[]>([])
  const templates = ref<OptimizationTemplate[]>([])
  const configurations = ref<Map<string, OptimizationConfig>>(new Map())
  
  const isProcessing = computed(() => status.value === 'processing')
  const hasResult = computed(() => currentResult.value !== null)
  const hasHistory = computed(() => history.value.length > 0)
  const hasTemplates = computed(() => templates.value.length > 0)
  
  const systemTemplates = computed(() => 
    templates.value.filter(t => t.type === 'system')
  )
  
  const userTemplates = computed(() => 
    templates.value.filter(t => t.type === 'user')
  )
  
  const sortedHistory = computed(() => 
    [...history.value].sort((a, b) => b.timestamp - a.timestamp)
  )
  
  const recentHistory = computed(() => 
    sortedHistory.value.slice(0, 10)
  )
  
  async function optimize(
    prompt: string,
    config: OptimizationConfig,
    promptService?: PromptService
  ): Promise<string | null> {
    if (!promptService) {
      setError('Prompt service not available')
      return null
    }
    
    currentOptimizationId.value = crypto.randomUUID()
    currentPrompt.value = prompt
    currentResult.value = null
    status.value = 'processing'
    error.value = null
    progress.value = 0
    
    try {
      const result = await promptService.optimize(prompt, {
        model: config.model,
        template: config.template,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP
      })
      
      currentResult.value = result
      status.value = 'completed'
      progress.value = 100
      
      addToHistory({
        id: currentOptimizationId.value,
        prompt,
        result,
        timestamp: Date.now(),
        model: config.model,
        template: config.template
      })
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Optimization failed'
      setError(errorMessage)
      status.value = 'error'
      console.error('Optimization failed:', err)
      return null
    }
  }
  
  function addToHistory(result: OptimizationResult) {
    history.value.push(result)
    
    if (history.value.length > 100) {
      history.value.shift()
    }
    
    saveHistoryToStorage()
  }
  
  function removeFromHistory(id: string) {
    const index = history.value.findIndex(item => item.id === id)
    if (index !== -1) {
      history.value.splice(index, 1)
      saveHistoryToStorage()
    }
  }
  
  function clearHistory() {
    history.value = []
    localStorage.removeItem('optimization:history')
  }
  
  function saveHistoryToStorage() {
    try {
      localStorage.setItem('optimization:history', JSON.stringify(history.value))
    } catch (err) {
      console.error('Failed to save optimization history:', err)
    }
  }
  
  function loadHistoryFromStorage() {
    try {
      const stored = localStorage.getItem('optimization:history')
      if (stored) {
        history.value = JSON.parse(stored)
      }
    } catch (err) {
      console.error('Failed to load optimization history:', err)
    }
  }
  
  function addTemplate(template: Omit<OptimizationTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    const newTemplate: OptimizationTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    templates.value.push(newTemplate)
    saveTemplatesToStorage()
    return newTemplate
  }
  
  function updateTemplate(id: string, updates: Partial<Omit<OptimizationTemplate, 'id' | 'createdAt'>>) {
    const index = templates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      templates.value[index] = {
        ...templates.value[index],
        ...updates,
        updatedAt: new Date()
      }
      saveTemplatesToStorage()
    }
  }
  
  function deleteTemplate(id: string) {
    const index = templates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      templates.value.splice(index, 1)
      saveTemplatesToStorage()
    }
  }
  
  function saveTemplatesToStorage() {
    try {
      localStorage.setItem('optimization:templates', JSON.stringify(templates.value))
    } catch (err) {
      console.error('Failed to save optimization templates:', err)
    }
  }
  
  function loadTemplatesFromStorage() {
    try {
      const stored = localStorage.getItem('optimization:templates')
      if (stored) {
        const parsed = JSON.parse(stored)
        templates.value = parsed.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt)
        }))
      }
    } catch (err) {
      console.error('Failed to load optimization templates:', err)
    }
  }
  
  function saveConfiguration(name: string, config: OptimizationConfig) {
    configurations.value.set(name, config)
    saveConfigurationsToStorage()
  }
  
  function getConfiguration(name: string): OptimizationConfig | undefined {
    return configurations.value.get(name)
  }
  
  function deleteConfiguration(name: string) {
    configurations.value.delete(name)
    saveConfigurationsToStorage()
  }
  
  function saveConfigurationsToStorage() {
    try {
      const configArray = Array.from(configurations.value.entries())
      localStorage.setItem('optimization:configurations', JSON.stringify(configArray))
    } catch (err) {
      console.error('Failed to save optimization configurations:', err)
    }
  }
  
  function loadConfigurationsFromStorage() {
    try {
      const stored = localStorage.getItem('optimization:configurations')
      if (stored) {
        const configArray = JSON.parse(stored)
        configurations.value = new Map(configArray)
      }
    } catch (err) {
      console.error('Failed to load optimization configurations:', err)
    }
  }
  
  function setProgress(value: number) {
    progress.value = Math.min(100, Math.max(0, value))
  }
  
  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }
  
  function clearError() {
    error.value = null
  }
  
  function reset() {
    currentOptimizationId.value = null
    currentPrompt.value = ''
    currentResult.value = null
    status.value = 'idle'
    error.value = null
    progress.value = 0
  }
  
  function initialize() {
    loadHistoryFromStorage()
    loadTemplatesFromStorage()
    loadConfigurationsFromStorage()
  }
  
  return {
    currentOptimizationId,
    currentPrompt,
    currentResult,
    status,
    error,
    progress,
    history,
    templates,
    configurations,
    isProcessing,
    hasResult,
    hasHistory,
    hasTemplates,
    systemTemplates,
    userTemplates,
    sortedHistory,
    recentHistory,
    optimize,
    addToHistory,
    removeFromHistory,
    clearHistory,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    saveConfiguration,
    getConfiguration,
    deleteConfiguration,
    setProgress,
    setError,
    clearError,
    reset,
    initialize
  }
})