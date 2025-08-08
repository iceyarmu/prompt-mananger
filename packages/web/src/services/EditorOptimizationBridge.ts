import { createLogger } from '../utils/logger'
import type { EditorService } from './EditorService'
import type { PromptService } from '@prompt-optimizer/core'

const logger = createLogger('EditorOptimizationBridge')

export interface OptimizationRequest {
  content: string
  type: 'optimize' | 'expand' | 'simplify' | 'format' | 'custom'
  options?: {
    template?: string
    model?: string
    parameters?: Record<string, any>
  }
}

export interface OptimizationResult {
  originalContent: string
  optimizedContent: string
  type: string
  timestamp: Date
  metadata?: {
    tokensReduced?: number
    processingTime?: number
    model?: string
    template?: string
  }
}

export class EditorOptimizationBridge {
  private editorService: EditorService
  private optimizationService: PromptService
  private activeOptimizations: Map<string, OptimizationRequest>
  
  constructor(
    editorService: EditorService,
    optimizationService: PromptService
  ) {
    this.editorService = editorService
    this.optimizationService = optimizationService
    this.activeOptimizations = new Map()
    
    logger.info('EditorOptimizationBridge constructed')
  }
  
  /**
   * Initialize the bridge and register optimization handlers
   */
  async init(): Promise<void> {
    logger.debug('Initializing EditorOptimizationBridge')
    
    try {
      // Register optimization handlers with the editor
      this.registerOptimizationHandlers()
      
      // Register editor commands for optimization
      this.registerEditorCommands()
      
      logger.info('EditorOptimizationBridge initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize EditorOptimizationBridge', error)
      throw error
    }
  }
  
  /**
   * Get current editor content for optimization
   */
  getEditorContent(): string {
    return this.editorService.getContentForOptimization()
  }
  
  /**
   * Apply optimization result to editor
   */
  applyOptimizationToEditor(optimizedContent: string): void {
    this.editorService.applyOptimizationResult(optimizedContent)
    logger.info('Optimization result applied to editor')
  }
  
  /**
   * Perform optimization on current editor content
   */
  async optimizeCurrentContent(type: OptimizationRequest['type'] = 'optimize'): Promise<OptimizationResult> {
    const startTime = Date.now()
    const originalContent = this.getEditorContent()
    
    // Input validation
    if (!originalContent || originalContent.trim().length === 0) {
      throw new Error('No content available for optimization')
    }
    
    // Content size validation (prevent excessive memory usage)
    const MAX_CONTENT_SIZE = 1024 * 1024 // 1MB
    if (originalContent.length > MAX_CONTENT_SIZE) {
      throw new Error(`Content size exceeds maximum allowed size of ${MAX_CONTENT_SIZE} bytes`)
    }
    
    logger.debug('Starting optimization', { type, contentLength: originalContent.length })
    
    try {
      // Create optimization request
      const request: OptimizationRequest = {
        content: originalContent,
        type,
        options: {}
      }
      
      // Store active optimization with unique ID using crypto for better uniqueness
      const requestId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      this.activeOptimizations.set(requestId, request)
      
      // Perform optimization based on type
      let optimizedContent: string
      
      switch (type) {
        case 'optimize':
          optimizedContent = await this.performGeneralOptimization(originalContent)
          break
        case 'expand':
          optimizedContent = await this.performExpansion(originalContent)
          break
        case 'simplify':
          optimizedContent = await this.performSimplification(originalContent)
          break
        case 'format':
          optimizedContent = await this.performFormatting(originalContent)
          break
        default:
          optimizedContent = await this.performCustomOptimization(originalContent, request.options)
      }
      
      // Remove from active optimizations
      this.activeOptimizations.delete(requestId)
      
      // Create result
      const result: OptimizationResult = {
        originalContent,
        optimizedContent,
        type,
        timestamp: new Date(),
        metadata: {
          processingTime: Date.now() - startTime,
          tokensReduced: originalContent.length - optimizedContent.length
        }
      }
      
      logger.info('Optimization completed', {
        type,
        originalLength: originalContent.length,
        optimizedLength: optimizedContent.length,
        processingTime: result.metadata?.processingTime
      })
      
      return result
    } catch (error) {
      logger.error('Optimization failed', { type, error })
      throw error
    }
  }
  
  /**
   * Optimize selected text in editor
   */
  async optimizeSelection(type: OptimizationRequest['type'] = 'optimize'): Promise<OptimizationResult> {
    const selectedText = this.editorService.getSelectedText()
    
    if (!selectedText) {
      throw new Error('No text selected for optimization')
    }
    
    logger.debug('Optimizing selected text', { type, length: selectedText.length })
    
    // Create a temporary content for optimization
    const originalContent = this.editorService.getContent()
    const state = this.editorService.getState()
    
    // Perform optimization on selection
    const request: OptimizationRequest = {
      content: selectedText,
      type,
      options: {}
    }
    
    let optimizedContent: string
    
    switch (type) {
      case 'optimize':
        optimizedContent = await this.performGeneralOptimization(selectedText)
        break
      case 'expand':
        optimizedContent = await this.performExpansion(selectedText)
        break
      case 'simplify':
        optimizedContent = await this.performSimplification(selectedText)
        break
      case 'format':
        optimizedContent = await this.performFormatting(selectedText)
        break
      default:
        optimizedContent = await this.performCustomOptimization(selectedText, request.options)
    }
    
    // Replace selected text with optimized content
    if (state.selection) {
      const lines = originalContent.split('\n')
      const { start, end } = state.selection
      
      // Build new content with optimized selection
      const newLines = [...lines]
      const optimizedLines = optimizedContent.split('\n')
      
      // Replace the selected portion
      newLines.splice(start.line - 1, end.line - start.line + 1, ...optimizedLines)
      
      const newContent = newLines.join('\n')
      this.editorService.updateContent(newContent)
    }
    
    return {
      originalContent: selectedText,
      optimizedContent,
      type,
      timestamp: new Date()
    }
  }
  
  /**
   * Get list of active optimizations
   */
  getActiveOptimizations(): OptimizationRequest[] {
    return Array.from(this.activeOptimizations.values())
  }
  
  /**
   * Cancel an active optimization
   */
  cancelOptimization(requestId: string): boolean {
    return this.activeOptimizations.delete(requestId)
  }
  
  /**
   * Check bridge health
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Check if services are accessible
      const editorContent = this.editorService.getContentForOptimization()
      const templates = await this.optimizationService.getTemplates()
      
      logger.debug('Bridge health check passed', {
        hasEditor: editorContent !== undefined,
        templateCount: templates.length
      })
      
      return true
    } catch (error) {
      logger.error('Bridge health check failed', error)
      return false
    }
  }
  
  /**
   * Perform general optimization
   */
  private async performGeneralOptimization(content: string): Promise<string> {
    logger.debug('Performing general optimization')
    
    // Use the PromptService to optimize the content
    const result = await this.optimizationService.optimizePrompt(content, {
      maxTokens: 4000,
      preserveStructure: true,
      optimizationLevel: 'balanced'
    })
    
    return result.optimizedPrompt || content
  }
  
  /**
   * Perform content expansion
   */
  private async performExpansion(content: string): Promise<string> {
    logger.debug('Performing content expansion')
    
    // Use PromptService with expansion template
    const result = await this.optimizationService.optimizePrompt(content, {
      maxTokens: 8000,
      preserveStructure: true,
      optimizationLevel: 'verbose'
    })
    
    return result.optimizedPrompt || content
  }
  
  /**
   * Perform content simplification
   */
  private async performSimplification(content: string): Promise<string> {
    logger.debug('Performing content simplification')
    
    // Use PromptService with simplification settings
    const result = await this.optimizationService.optimizePrompt(content, {
      maxTokens: 2000,
      preserveStructure: false,
      optimizationLevel: 'aggressive'
    })
    
    return result.optimizedPrompt || content
  }
  
  /**
   * Perform content formatting
   */
  private async performFormatting(content: string): Promise<string> {
    logger.debug('Performing content formatting')
    
    // Use PromptService to format the content
    const result = await this.optimizationService.optimizePrompt(content, {
      maxTokens: 4000,
      preserveStructure: true,
      optimizationLevel: 'formatting'
    })
    
    return result.optimizedPrompt || content
  }
  
  /**
   * Perform custom optimization with user options
   */
  private async performCustomOptimization(
    content: string,
    options?: OptimizationRequest['options']
  ): Promise<string> {
    logger.debug('Performing custom optimization', options)
    
    // Use PromptService with custom options
    const result = await this.optimizationService.optimizePrompt(content, {
      maxTokens: options?.parameters?.maxTokens || 4000,
      template: options?.template,
      model: options?.model,
      ...options?.parameters
    })
    
    return result.optimizedPrompt || content
  }
  
  /**
   * Register optimization handlers with the editor
   */
  private registerOptimizationHandlers(): void {
    // Register general optimization
    this.editorService.registerOptimizationHandler('optimize', async (content) => {
      const result = await this.performGeneralOptimization(content)
      return result
    })
    
    // Register expansion
    this.editorService.registerOptimizationHandler('expand', async (content) => {
      const result = await this.performExpansion(content)
      return result
    })
    
    // Register simplification
    this.editorService.registerOptimizationHandler('simplify', async (content) => {
      const result = await this.performSimplification(content)
      return result
    })
    
    // Register formatting
    this.editorService.registerOptimizationHandler('format', async (content) => {
      const result = await this.performFormatting(content)
      return result
    })
    
    logger.debug('Optimization handlers registered with editor')
  }
  
  /**
   * Register editor commands for optimization
   */
  private registerEditorCommands(): void {
    // Optimize command
    this.editorService.registerCommand({
      id: 'editor.optimize',
      label: 'Optimize Content',
      keybinding: 'Ctrl+Shift+O',
      handler: async () => {
        const result = await this.optimizeCurrentContent('optimize')
        this.applyOptimizationToEditor(result.optimizedContent)
      }
    })
    
    // Expand command
    this.editorService.registerCommand({
      id: 'editor.expand',
      label: 'Expand Content',
      keybinding: 'Ctrl+Shift+E',
      handler: async () => {
        const result = await this.optimizeCurrentContent('expand')
        this.applyOptimizationToEditor(result.optimizedContent)
      }
    })
    
    // Simplify command - changed keybinding to avoid conflict with Save As (Ctrl+Shift+S)
    this.editorService.registerCommand({
      id: 'editor.simplify',
      label: 'Simplify Content',
      keybinding: 'Ctrl+Shift+M', // Changed from Ctrl+Shift+S to avoid conflict
      handler: async () => {
        const result = await this.optimizeCurrentContent('simplify')
        this.applyOptimizationToEditor(result.optimizedContent)
      }
    })
    
    // Format command
    this.editorService.registerCommand({
      id: 'editor.format',
      label: 'Format Content',
      keybinding: 'Ctrl+Shift+F',
      handler: async () => {
        const result = await this.optimizeCurrentContent('format')
        this.applyOptimizationToEditor(result.optimizedContent)
      }
    })
    
    // Optimize selection command
    this.editorService.registerCommand({
      id: 'editor.optimizeSelection',
      label: 'Optimize Selection',
      keybinding: 'Alt+Shift+O',
      handler: async () => {
        const result = await this.optimizeSelection('optimize')
        logger.info('Selection optimized', {
          originalLength: result.originalContent.length,
          optimizedLength: result.optimizedContent.length
        })
      }
    })
    
    logger.debug('Optimization commands registered with editor')
  }
}