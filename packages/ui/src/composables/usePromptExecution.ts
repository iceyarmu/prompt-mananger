import { ref, inject, computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from './useToast'
import { usePreferences } from './usePreferenceManager'
import type { AppServices } from '../types/services'
import { PromptExecutionHandler, type ExecutionOptions, type ExecutionResult } from '../services/PromptExecutionHandler'

export function usePromptExecution(content: Ref<string>) {
  const { t } = useI18n()
  const toast = useToast()
  
  // Get services
  const services = inject<Ref<AppServices | null>>('services')
  const { getPreference, setPreference } = usePreferences(services)
  
  // State
  const executing = ref(false)
  const selectedExecutionModel = ref('')
  const executionOptions = ref<ExecutionOptions>({
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
    streaming: true,
    timeout: 60000
  })
  const executionResult = ref<ExecutionResult | null>(null)
  const showExecutionResults = ref(false)
  const showModelManager = ref(false)
  const executionHistory = ref<ExecutionResult[]>([])
  
  // Initialize model selection and options
  const initializeModel = async () => {
    try {
      // Load saved model preference
      const savedModel = await getPreference('execution_model', '')
      if (savedModel && services?.value?.modelManager) {
        const models = await services.value.modelManager.getEnabledModels()
        if (models.some(m => m.key === savedModel)) {
          selectedExecutionModel.value = savedModel
          executionOptions.value.model = savedModel
        } else if (models.length > 0) {
          // Use first enabled model if saved model not available
          selectedExecutionModel.value = models[0].key
          executionOptions.value.model = models[0].key
        }
      }
      
      // Load saved execution options
      const savedTemp = await getPreference('execution_temperature', 0.7)
      const savedMaxTokens = await getPreference('execution_maxTokens', 2000)
      const savedSystemPrompt = await getPreference('execution_systemPrompt', '')
      const savedStreaming = await getPreference('execution_streaming', true)
      
      executionOptions.value.temperature = savedTemp
      executionOptions.value.maxTokens = savedMaxTokens
      executionOptions.value.systemPrompt = savedSystemPrompt
      executionOptions.value.streaming = savedStreaming
      
      // Load execution history
      loadExecutionHistory()
    } catch (error) {
      console.error('Failed to initialize execution model:', error)
    }
  }
  
  // Save model selection
  const saveModelSelection = async (model: string) => {
    try {
      await setPreference('execution_model', model)
      executionOptions.value.model = model
    } catch (error) {
      console.error('Failed to save model selection:', error)
    }
  }
  
  // Save execution options
  const saveExecutionOptions = async () => {
    try {
      await setPreference('execution_temperature', executionOptions.value.temperature)
      await setPreference('execution_maxTokens', executionOptions.value.maxTokens)
      await setPreference('execution_systemPrompt', executionOptions.value.systemPrompt)
      await setPreference('execution_streaming', executionOptions.value.streaming)
    } catch (error) {
      console.error('Failed to save execution options:', error)
    }
  }
  
  // Watch for model changes
  const watchModelChange = () => {
    // This will be called when selectedExecutionModel changes
    if (selectedExecutionModel.value) {
      saveModelSelection(selectedExecutionModel.value)
    }
  }
  
  // Watch for options changes
  const watchOptionsChange = () => {
    saveExecutionOptions()
  }
  
  // History Management
  const HISTORY_KEY = 'execution_history'
  const MAX_HISTORY_ENTRIES = 100
  
  const loadExecutionHistory = () => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        executionHistory.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load execution history:', error)
      executionHistory.value = []
    }
  }
  
  const saveToHistory = (result: ExecutionResult) => {
    // Add to history with timestamp and model info
    const historyEntry = {
      ...result,
      id: Date.now().toString(),
      prompt: content.value, // Save the original prompt
      timestamp: new Date()
    }
    
    // Add to beginning of array (most recent first)
    executionHistory.value.unshift(historyEntry)
    
    // Limit to MAX_HISTORY_ENTRIES
    if (executionHistory.value.length > MAX_HISTORY_ENTRIES) {
      executionHistory.value = executionHistory.value.slice(0, MAX_HISTORY_ENTRIES)
    }
    
    // Save to localStorage
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(executionHistory.value))
    } catch (error) {
      console.error('Failed to save execution history:', error)
      // If localStorage is full, remove oldest entries
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        executionHistory.value = executionHistory.value.slice(0, 50)
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(executionHistory.value))
        } catch {
          // If still failing, clear some history
          executionHistory.value = executionHistory.value.slice(0, 20)
          localStorage.setItem(HISTORY_KEY, JSON.stringify(executionHistory.value))
        }
      }
    }
  }
  
  const clearExecutionHistory = () => {
    executionHistory.value = []
    localStorage.removeItem(HISTORY_KEY)
    toast.success(t('toast.success.historyCleared', 'Execution history cleared'))
  }
  
  // Execute prompt
  const executePrompt = async () => {
    if (!content.value || !selectedExecutionModel.value || !services?.value) {
      toast.error(t('toast.error.executionRequirementsNotMet', 'Please select a model and enter content'))
      return
    }
    
    executing.value = true
    showExecutionResults.value = true
    
    try {
      const handler = new PromptExecutionHandler(
        services.value,
        (partialContent: string) => {
          // Update result with streaming content
          if (executionResult.value) {
            executionResult.value.content = partialContent
          }
        }
      )
      
      const result = await handler.executePrompt(
        content.value,
        {
          ...executionOptions.value,
          model: selectedExecutionModel.value
        }
      )
      
      executionResult.value = result
      
      // Save to execution history
      saveToHistory(result)
      
      toast.success(t('toast.success.executionComplete', 'Execution completed'))
      
    } catch (error) {
      console.error('Execution failed:', error)
      toast.error(t('toast.error.executionFailed', 'Execution failed: {{error}}'), {
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      executing.value = false
    }
  }
  
  // Initialize on mount
  initializeModel()
  
  // Watch for model changes
  watch(selectedExecutionModel, (newModel) => {
    if (newModel) {
      saveModelSelection(newModel)
    }
  })
  
  // Watch for options changes
  watch(executionOptions, () => {
    saveExecutionOptions()
  }, { deep: true })
  
  return {
    executing,
    selectedExecutionModel,
    executionOptions,
    executionResult,
    showExecutionResults,
    showModelManager,
    executePrompt,
    watchModelChange,
    watchOptionsChange,
    executionHistory,
    clearExecutionHistory
  }
}