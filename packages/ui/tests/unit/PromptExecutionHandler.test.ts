import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptExecutionHandler, type ExecutionOptions } from '../../src/services/PromptExecutionHandler'
import type { AppServices } from '../../src/types/services'

// Mock services
const mockLLMService = {
  sendMessageStructured: vi.fn(),
  sendMessageStream: vi.fn(),
  sendMessage: vi.fn(),
  testConnection: vi.fn(),
  fetchModelList: vi.fn()
}

const mockServices: AppServices = {
  llmService: mockLLMService,
  modelManager: {} as any,
  templateManager: {} as any,
  historyManager: {} as any,
  dataManager: {} as any,
  promptService: {} as any,
  templateLanguageService: {} as any,
  preferenceService: {} as any,
  compareService: {} as any
}

describe('PromptExecutionHandler', () => {
  let handler: PromptExecutionHandler
  let onProgress: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    vi.clearAllMocks()
    onProgress = vi.fn()
    handler = new PromptExecutionHandler(mockServices, onProgress)
  })
  
  describe('executePrompt', () => {
    it('should execute prompt with correct parameters', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Test response',
        metadata: { model: 'gpt-3.5-turbo' }
      })
      
      const result = await handler.executePrompt('Test prompt', options)
      
      expect(result.content).toBe('Test response')
      expect(result.model).toBe('gpt-3.5-turbo')
      expect(result.usage.totalTokens).toBeGreaterThan(0)
      expect(result.usage.cost).toBeGreaterThanOrEqual(0)
      expect(result.executionTime).toBeGreaterThan(0)
      
      expect(mockLLMService.sendMessageStructured).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Test prompt' }],
        'gpt-3.5-turbo'
      )
    })
    
    it('should include system prompt when provided', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-3.5-turbo',
        systemPrompt: 'You are a helpful assistant',
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Test response',
        metadata: { model: 'gpt-3.5-turbo' }
      })
      
      await handler.executePrompt('Test prompt', options)
      
      expect(mockLLMService.sendMessageStructured).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Test prompt' }
        ],
        'gpt-3.5-turbo'
      )
    })
    
    it('should handle streaming execution', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-4',
        streaming: true
      }
      
      mockLLMService.sendMessageStream.mockImplementation(async (messages, model, handlers) => {
        handlers.onToken('Test ')
        handlers.onToken('streaming ')
        handlers.onToken('response')
        handlers.onComplete({ content: 'Test streaming response' })
      })
      
      const result = await handler.executePrompt('Test prompt', options)
      
      expect(result.content).toBe('Test streaming response')
      expect(result.streaming).toBe(true)
      expect(onProgress).toHaveBeenCalledTimes(3)
      expect(onProgress).toHaveBeenNthCalledWith(1, 'Test ')
      expect(onProgress).toHaveBeenNthCalledWith(2, 'Test streaming ')
      expect(onProgress).toHaveBeenNthCalledWith(3, 'Test streaming response')
    })
    
    it('should handle execution errors', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-3.5-turbo',
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockRejectedValue(
        new Error('API rate limit exceeded')
      )
      
      const result = await handler.executePrompt('Test prompt', options)
      
      expect(result.content).toContain('Error')
      expect(result.usage.totalTokens).toBe(0)
      expect(result.usage.cost).toBe(0)
    })
  })
  
  describe('token calculation', () => {
    it('should calculate tokens approximately', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-3.5-turbo',
        streaming: false
      }
      
      const longPrompt = 'This is a test prompt '.repeat(100) // ~2200 chars
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Short response',
        metadata: { model: 'gpt-3.5-turbo' }
      })
      
      const result = await handler.executePrompt(longPrompt, options)
      
      // Rough token calculation: ~4 chars per token
      expect(result.usage.promptTokens).toBeGreaterThan(500)
      expect(result.usage.promptTokens).toBeLessThan(600)
      expect(result.usage.completionTokens).toBeLessThan(10)
    })
  })
  
  describe('cost calculation', () => {
    it('should calculate cost for GPT-3.5-turbo', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-3.5-turbo',
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Test response',
        metadata: { model: 'gpt-3.5-turbo' }
      })
      
      const result = await handler.executePrompt('Test prompt', options)
      
      // GPT-3.5-turbo: $0.001/1K prompt, $0.002/1K completion
      const expectedCost = (result.usage.promptTokens * 0.001 + 
                           result.usage.completionTokens * 0.002) / 1000
      
      expect(result.usage.cost).toBeCloseTo(expectedCost, 6)
    })
    
    it('should calculate cost for Claude models', async () => {
      const options: ExecutionOptions = {
        model: 'claude-3-opus',
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Test response',
        metadata: { model: 'claude-3-opus' }
      })
      
      const result = await handler.executePrompt('Test prompt', options)
      
      // Claude-3-opus: $0.015/1K prompt, $0.075/1K completion
      const expectedCost = (result.usage.promptTokens * 0.015 + 
                           result.usage.completionTokens * 0.075) / 1000
      
      expect(result.usage.cost).toBeCloseTo(expectedCost, 6)
    })
    
    it('should return zero cost for unknown models', async () => {
      const options: ExecutionOptions = {
        model: 'unknown-model',
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Test response',
        metadata: { model: 'unknown-model' }
      })
      
      const result = await handler.executePrompt('Test prompt', options)
      
      expect(result.usage.cost).toBe(0)
    })
  })
  
  describe('performance', () => {
    it('should execute within timeout limits', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-3.5-turbo',
        timeout: 5000,
        streaming: false
      }
      
      mockLLMService.sendMessageStructured.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          content: 'Test response',
          metadata: { model: 'gpt-3.5-turbo' }
        }), 100))
      )
      
      const startTime = Date.now()
      const result = await handler.executePrompt('Test prompt', options)
      const executionTime = Date.now() - startTime
      
      expect(executionTime).toBeLessThan(options.timeout!)
      expect(result.executionTime).toBeGreaterThan(99)
      expect(result.executionTime).toBeLessThan(200)
    })
    
    it('should handle large prompts efficiently', async () => {
      const options: ExecutionOptions = {
        model: 'gpt-4',
        streaming: false
      }
      
      const largePrompt = 'Test '.repeat(10000) // ~50K chars
      
      mockLLMService.sendMessageStructured.mockResolvedValue({
        content: 'Response to large prompt',
        metadata: { model: 'gpt-4' }
      })
      
      const startTime = Date.now()
      const result = await handler.executePrompt(largePrompt, options)
      const processingTime = Date.now() - startTime
      
      // Should process large prompts quickly (< 1s for local calculations)
      expect(processingTime).toBeLessThan(1000)
      expect(result.usage.promptTokens).toBeGreaterThan(10000)
    })
  })
})