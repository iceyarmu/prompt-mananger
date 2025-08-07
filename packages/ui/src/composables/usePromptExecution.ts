import { ref, inject, computed, type Ref } from 'vue'
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
  
  // Initialize model selection
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
  
  // Watch for model changes
  const watchModelChange = () => {
    // This will be called when selectedExecutionModel changes
    if (selectedExecutionModel.value) {
      saveModelSelection(selectedExecutionModel.value)
    }
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
  
  return {
    executing,
    selectedExecutionModel,
    executionOptions,
    executionResult,
    showExecutionResults,
    showModelManager,
    executePrompt,
    watchModelChange
  }
}