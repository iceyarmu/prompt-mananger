import { useToast } from '../composables/useToast'
import type { ExecutionOptions, ExecutionResult } from './PromptExecutionHandler'

export class ExecutionErrorHandler {
  private retryDelays = [1000, 2000, 4000, 8000] // Exponential backoff
  private toast = useToast()
  
  async handleExecutionError(
    error: Error,
    options: ExecutionOptions,
    retryCount = 0,
    retryCallback?: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult | null> {
    let errorMessage = 'Execution failed'
    let shouldRetry = false
    let retryDelay = 0
    
    const errorString = error.message.toLowerCase()
    
    if (errorString.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded'
      shouldRetry = retryCount < 3
      retryDelay = this.retryDelays[retryCount] || 8000
      
      if (shouldRetry && retryCallback) {
        this.toast.warning(
          `Rate limited. Retrying in ${retryDelay / 1000}s...`
        )
        
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.retryExecution(options, retryCount + 1, retryCallback)
      }
      
    } else if (errorString.includes('timeout')) {
      errorMessage = 'Request timed out'
      shouldRetry = retryCount < 2
      
      if (shouldRetry && retryCallback) {
        this.toast.warning('Request timed out. Retrying...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.retryExecution(options, retryCount + 1, retryCallback)
      }
      
    } else if (errorString.includes('quota')) {
      errorMessage = 'API quota exceeded. Please check your billing or wait for quota reset.'
      
    } else if (errorString.includes('authentication') || errorString.includes('api key')) {
      errorMessage = 'Authentication failed. Please check your API key configuration.'
      
    } else if (errorString.includes('model not found') || errorString.includes('invalid model')) {
      errorMessage = 'Selected model not available. Please choose a different model.'
      
    } else if (errorString.includes('network') || errorString.includes('connection')) {
      errorMessage = 'Network error. Please check your connection and try again.'
      shouldRetry = retryCount < 2
      
      if (shouldRetry && retryCallback) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return this.retryExecution(options, retryCount + 1, retryCallback)
      }
      
    } else if (errorString.includes('context length') || errorString.includes('too long')) {
      errorMessage = 'Input too long. Please reduce the prompt length or adjust max tokens.'
      
    } else if (errorString.includes('invalid request')) {
      errorMessage = 'Invalid request parameters. Please check your settings.'
    }
    
    // Show error notification with action buttons if applicable
    const actions = []
    if (shouldRetry && retryCallback) {
      actions.push({
        label: 'Retry Now',
        action: () => this.retryExecution(options, retryCount + 1, retryCallback)
      })
    }
    
    if (errorString.includes('api key')) {
      actions.push({
        label: 'Configure API Key',
        action: () => {
          // This would open the model configuration
          window.dispatchEvent(new CustomEvent('open-model-config'))
        }
      })
    }
    
    this.toast.error(errorMessage, { actions })
    
    // Return error result for display
    return {
      content: `Error: ${errorMessage}\n\nDetails: ${error.message}`,
      model: options.model,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      },
      executionTime: 0,
      timestamp: new Date()
    }
  }
  
  private async retryExecution(
    options: ExecutionOptions, 
    retryCount: number,
    retryCallback: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult | null> {
    try {
      this.toast.info(`Retry attempt ${retryCount}...`)
      return await retryCallback()
    } catch (error) {
      return this.handleExecutionError(
        error instanceof Error ? error : new Error(String(error)), 
        options, 
        retryCount,
        retryCallback
      )
    }
  }
  
  /**
   * Check if an error is retryable
   */
  isRetryableError(error: Error): boolean {
    const errorString = error.message.toLowerCase()
    return errorString.includes('rate limit') ||
           errorString.includes('timeout') ||
           errorString.includes('network') ||
           errorString.includes('connection')
  }
  
  /**
   * Get suggested action for an error
   */
  getSuggestedAction(error: Error): string {
    const errorString = error.message.toLowerCase()
    
    if (errorString.includes('api key')) {
      return 'Please check your API key configuration in Model Manager'
    }
    if (errorString.includes('quota')) {
      return 'Check your API usage and billing status'
    }
    if (errorString.includes('context length')) {
      return 'Try reducing the prompt length or lowering max tokens'
    }
    if (errorString.includes('model not found')) {
      return 'Select a different model or check model availability'
    }
    if (errorString.includes('rate limit')) {
      return 'Wait a moment before trying again or use a different API key'
    }
    
    return 'Please try again or contact support if the issue persists'
  }
}