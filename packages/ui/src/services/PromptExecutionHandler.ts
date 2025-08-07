import { ILLMService, StreamHandlers, LLMResponse } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'
import { useToast } from '../composables/useToast'
import { ExecutionErrorHandler } from './ExecutionErrorHandler'

export interface ExecutionOptions {
  model: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  streaming?: boolean
  timeout?: number
}

export interface ExecutionResult {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
  executionTime: number
  timestamp: Date
  streaming?: boolean
}

export class PromptExecutionHandler {
  private toast = useToast()
  private errorHandler = new ExecutionErrorHandler()
  
  constructor(
    private services: AppServices,
    private onProgress?: (content: string) => void
  ) {}
  
  async executePrompt(
    prompt: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    
    try {
      // Get the LLM service
      const llmService = this.services.llmService
      
      if (options.streaming && this.onProgress) {
        return await this.executeStreaming(llmService, prompt, options, startTime)
      }
      
      // Standard execution using existing service patterns
      const messages = [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt }
      ]
      
      const response = await llmService.sendMessageStructured(messages, options.model)
      
      return {
        content: response.content,
        model: options.model,
        usage: {
          promptTokens: this.calculateTokens(prompt),
          completionTokens: this.calculateTokens(response.content),
          totalTokens: this.calculateTokens(prompt) + this.calculateTokens(response.content),
          cost: this.calculateCost(options.model, this.calculateTokens(prompt), this.calculateTokens(response.content))
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      }
      
    } catch (error) {
      // Use the error handler with retry capability
      const errorResult = await this.errorHandler.handleExecutionError(
        error instanceof Error ? error : new Error(String(error)),
        options,
        0,
        async () => this.executePrompt(prompt, options)
      )
      
      return errorResult || this.handleExecutionError(error, options, startTime)
    }
  }
  
  private async executeStreaming(
    llmService: ILLMService,
    prompt: string,
    options: ExecutionOptions,
    startTime: number
  ): Promise<ExecutionResult> {
    let content = ''
    
    const messages = [
      ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      { role: 'user' as const, content: prompt }
    ]
    
    const handlers: StreamHandlers = {
      onToken: (token: string) => {
        content += token
        this.onProgress?.(content)
      },
      onComplete: (response?: LLMResponse) => {
        if (response) {
          content = response.content
        }
      },
      onError: (error: Error) => {
        throw error
      }
    }
    
    await llmService.sendMessageStream(messages, options.model, handlers)
    
    return {
      content,
      model: options.model,
      usage: {
        promptTokens: this.calculateTokens(prompt),
        completionTokens: this.calculateTokens(content),
        totalTokens: this.calculateTokens(prompt) + this.calculateTokens(content),
        cost: this.calculateCost(options.model, this.calculateTokens(prompt), this.calculateTokens(content))
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date(),
      streaming: true
    }
  }
  
  private calculateTokens(text: string): number {
    // Rough token calculation - in production use proper tokenizer
    return Math.ceil(text.length / 4)
  }
  
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.getModelPricing(model)
    return (promptTokens * pricing.prompt + completionTokens * pricing.completion) / 1000
  }
  
  private getModelPricing(model: string): { prompt: number; completion: number } {
    // Model pricing map - can be extended
    const pricingMap: Record<string, { prompt: number; completion: number }> = {
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
      'claude-3-opus': { prompt: 0.015, completion: 0.075 },
      'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
      'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
      'gemini-pro': { prompt: 0.00025, completion: 0.0005 },
      'gemini-2.0-flash': { prompt: 0.00025, completion: 0.0005 }
    }
    
    // Default pricing if model not found
    return pricingMap[model] || { prompt: 0, completion: 0 }
  }
  
  private handleExecutionError(error: any, options: ExecutionOptions, startTime: number): ExecutionResult {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Check for specific error types
    if (errorMessage.includes('rate limit')) {
      this.toast.error('Rate limit exceeded. Please try again later.')
    } else if (errorMessage.includes('timeout')) {
      this.toast.error('Request timed out. Please try again.')
    } else if (errorMessage.includes('authentication')) {
      this.toast.error('Authentication failed. Please check your API key.')
    }
    
    // Return error result
    return {
      content: `Error: ${errorMessage}`,
      model: options.model,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date()
    }
  }
}