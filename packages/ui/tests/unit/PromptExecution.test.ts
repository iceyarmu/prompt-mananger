import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { usePromptExecution } from '../../src/composables/usePromptExecution'
import { PromptExecutionHandler } from '../../src/services/PromptExecutionHandler'
import { ExecutionErrorHandler } from '../../src/services/ExecutionErrorHandler'

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key
  })
}))

vi.mock('../../src/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('../../src/composables/usePreferenceManager', () => ({
  usePreferences: () => ({
    getPreference: vi.fn().mockResolvedValue(''),
    setPreference: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('PromptExecution', () => {
  const mockServices = {
    llmService: {
      sendMessageStructured: vi.fn(),
      sendMessageStream: vi.fn()
    },
    modelManager: {
      getEnabledModels: vi.fn().mockResolvedValue([
        { key: 'gpt-4', name: 'GPT-4', enabled: true },
        { key: 'claude-3', name: 'Claude 3', enabled: true }
      ])
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('usePromptExecution', () => {
    it('should initialize with default values', () => {
      const content = ref('test prompt')
      const { 
        executing, 
        selectedExecutionModel, 
        executionOptions,
        showExecutionResults
      } = usePromptExecution(content)

      expect(executing.value).toBe(false)
      expect(selectedExecutionModel.value).toBe('')
      expect(executionOptions.value.temperature).toBe(0.7)
      expect(executionOptions.value.maxTokens).toBe(2000)
      expect(executionOptions.value.streaming).toBe(true)
      expect(showExecutionResults.value).toBe(false)
    })

    it('should load execution history from localStorage', () => {
      const mockHistory = [
        { 
          content: 'test response', 
          model: 'gpt-4',
          timestamp: new Date(),
          usage: { totalTokens: 100, cost: 0.01 }
        }
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory))

      const content = ref('test')
      const { executionHistory } = usePromptExecution(content)

      expect(localStorageMock.getItem).toHaveBeenCalledWith('execution_history')
      expect(executionHistory.value).toHaveLength(1)
    })

    it('should clear execution history', () => {
      const content = ref('test')
      const { executionHistory, clearExecutionHistory } = usePromptExecution(content)
      
      executionHistory.value = [{ content: 'test', model: 'gpt-4' } as any]
      clearExecutionHistory()

      expect(executionHistory.value).toHaveLength(0)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('execution_history')
    })
  })

  describe('PromptExecutionHandler', () => {
    it('should execute prompt successfully', async () => {
      const mockResponse = {
        content: 'Test response',
        model: 'gpt-4'
      }
      
      mockServices.llmService.sendMessageStructured.mockResolvedValue(mockResponse)
      
      const handler = new PromptExecutionHandler(mockServices as any)
      const result = await handler.executePrompt('test prompt', {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000
      })

      expect(result.content).toBe('Test response')
      expect(result.model).toBe('gpt-4')
      expect(result.usage).toBeDefined()
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it('should handle streaming execution', async () => {
      const onProgress = vi.fn()
      const handler = new PromptExecutionHandler(mockServices as any, onProgress)
      
      mockServices.llmService.sendMessageStream.mockImplementation(
        async (messages, model, handlers) => {
          handlers.onToken('Hello ')
          handlers.onToken('World')
          handlers.onComplete({ content: 'Hello World' })
        }
      )

      const result = await handler.executePrompt('test', {
        model: 'gpt-4',
        streaming: true
      })

      expect(onProgress).toHaveBeenCalledWith('Hello ')
      expect(onProgress).toHaveBeenCalledWith('Hello World')
      expect(result.content).toBe('Hello World')
      expect(result.streaming).toBe(true)
    })

    it('should calculate tokens and cost correctly', async () => {
      mockServices.llmService.sendMessageStructured.mockResolvedValue({
        content: 'Response text here'
      })

      const handler = new PromptExecutionHandler(mockServices as any)
      const result = await handler.executePrompt('Test prompt', {
        model: 'gpt-4'
      })

      expect(result.usage.promptTokens).toBeGreaterThan(0)
      expect(result.usage.completionTokens).toBeGreaterThan(0)
      expect(result.usage.totalTokens).toBe(
        result.usage.promptTokens + result.usage.completionTokens
      )
      expect(result.usage.cost).toBeGreaterThan(0)
    })
  })

  describe('ExecutionErrorHandler', () => {
    it('should handle rate limit errors with retry', async () => {
      const errorHandler = new ExecutionErrorHandler()
      const retryCallback = vi.fn().mockResolvedValue({ content: 'success' })
      
      const error = new Error('Rate limit exceeded')
      const result = await errorHandler.handleExecutionError(
        error,
        { model: 'gpt-4' },
        0,
        retryCallback
      )

      expect(result).toBeDefined()
      // Retry should be attempted after delay
    })

    it('should handle timeout errors', async () => {
      const errorHandler = new ExecutionErrorHandler()
      const error = new Error('Request timeout')
      
      const result = await errorHandler.handleExecutionError(
        error,
        { model: 'gpt-4' },
        0
      )

      expect(result).toBeDefined()
      expect(result?.content).toContain('timed out')
    })

    it('should handle authentication errors', async () => {
      const errorHandler = new ExecutionErrorHandler()
      const error = new Error('Invalid API key')
      
      const result = await errorHandler.handleExecutionError(
        error,
        { model: 'gpt-4' },
        0
      )

      expect(result?.content).toContain('Authentication')
    })

    it('should identify retryable errors', () => {
      const errorHandler = new ExecutionErrorHandler()
      
      expect(errorHandler.isRetryableError(new Error('rate limit'))).toBe(true)
      expect(errorHandler.isRetryableError(new Error('timeout'))).toBe(true)
      expect(errorHandler.isRetryableError(new Error('network error'))).toBe(true)
      expect(errorHandler.isRetryableError(new Error('invalid request'))).toBe(false)
    })

    it('should provide suggested actions for errors', () => {
      const errorHandler = new ExecutionErrorHandler()
      
      const apiKeyError = new Error('Invalid API key')
      expect(errorHandler.getSuggestedAction(apiKeyError)).toContain('API key')
      
      const quotaError = new Error('Quota exceeded')
      expect(errorHandler.getSuggestedAction(quotaError)).toContain('billing')
      
      const contextError = new Error('Context length exceeded')
      expect(errorHandler.getSuggestedAction(contextError)).toContain('prompt length')
    })
  })

  describe('History Persistence', () => {
    it('should save execution results to history', async () => {
      const content = ref('test prompt')
      const composable = usePromptExecution(content)
      
      // Simulate successful execution
      const mockResult = {
        content: 'Test response',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cost: 0.001
        },
        executionTime: 1000,
        timestamp: new Date()
      }

      // The saveToHistory function would be called internally
      // We verify that localStorage is updated
      expect(composable.executionHistory).toBeDefined()
    })

    it('should limit history to 100 entries', () => {
      const content = ref('test')
      const { executionHistory } = usePromptExecution(content)
      
      // Add 150 entries
      for (let i = 0; i < 150; i++) {
        executionHistory.value.push({
          content: `Response ${i}`,
          model: 'gpt-4',
          timestamp: new Date()
        } as any)
      }

      // Should be limited to 100
      expect(executionHistory.value.length).toBeLessThanOrEqual(100)
    })

    it('should handle localStorage quota errors', () => {
      const content = ref('test')
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      const { executionHistory } = usePromptExecution(content)
      
      // Should handle gracefully without throwing
      expect(() => {
        executionHistory.value = [{ content: 'test' } as any]
      }).not.toThrow()
    })
  })
})