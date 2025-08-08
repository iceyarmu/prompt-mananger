import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorOptimizationBridge } from '../../../src/services/EditorOptimizationBridge'
import type { EditorService } from '../../../src/services/EditorService'
import type { PromptService } from '@prompt-optimizer/core'

describe('EditorOptimizationBridge', () => {
  let bridge: EditorOptimizationBridge
  let mockEditorService: EditorService
  let mockOptimizationService: PromptService
  
  beforeEach(() => {
    // Mock EditorService
    mockEditorService = {
      getContentForOptimization: vi.fn().mockReturnValue('test content'),
      applyOptimizationResult: vi.fn(),
      registerOptimizationHandler: vi.fn(),
      registerCommand: vi.fn(),
      getSelectedText: vi.fn(),
      getContent: vi.fn().mockReturnValue('full content'),
      updateContent: vi.fn(),
      getState: vi.fn().mockReturnValue({
        content: 'full content',
        isDirty: false,
        selection: null
      })
    } as any
    
    // Mock PromptService
    mockOptimizationService = {
      optimizePrompt: vi.fn().mockResolvedValue({
        optimizedPrompt: 'optimized content',
        tokensSaved: 100
      }),
      getTemplates: vi.fn().mockResolvedValue([])
    } as any
    
    bridge = new EditorOptimizationBridge(mockEditorService, mockOptimizationService)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('init', () => {
    it('should initialize and register handlers', async () => {
      await bridge.init()
      
      // Verify optimization handlers were registered
      expect(mockEditorService.registerOptimizationHandler).toHaveBeenCalledWith(
        'optimize',
        expect.any(Function)
      )
      expect(mockEditorService.registerOptimizationHandler).toHaveBeenCalledWith(
        'expand',
        expect.any(Function)
      )
      expect(mockEditorService.registerOptimizationHandler).toHaveBeenCalledWith(
        'simplify',
        expect.any(Function)
      )
      expect(mockEditorService.registerOptimizationHandler).toHaveBeenCalledWith(
        'format',
        expect.any(Function)
      )
      
      // Verify commands were registered
      expect(mockEditorService.registerCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'editor.optimize',
          label: 'Optimize Content',
          keybinding: 'Ctrl+Shift+O'
        })
      )
      expect(mockEditorService.registerCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'editor.expand',
          label: 'Expand Content',
          keybinding: 'Ctrl+Shift+E'
        })
      )
    })
  })
  
  describe('content access', () => {
    it('should get editor content', () => {
      const content = bridge.getEditorContent()
      
      expect(content).toBe('test content')
      expect(mockEditorService.getContentForOptimization).toHaveBeenCalled()
    })
    
    it('should apply optimization to editor', () => {
      bridge.applyOptimizationToEditor('new content')
      
      expect(mockEditorService.applyOptimizationResult).toHaveBeenCalledWith('new content')
    })
  })
  
  describe('optimizeCurrentContent', () => {
    beforeEach(async () => {
      await bridge.init()
    })
    
    it('should optimize content with general optimization', async () => {
      const result = await bridge.optimizeCurrentContent('optimize')
      
      expect(result.originalContent).toBe('test content')
      expect(result.optimizedContent).toBe('optimized content')
      expect(result.type).toBe('optimize')
      expect(result.timestamp).toBeInstanceOf(Date)
      
      expect(mockOptimizationService.optimizePrompt).toHaveBeenCalledWith(
        'test content',
        expect.objectContaining({
          maxTokens: 4000,
          preserveStructure: true,
          optimizationLevel: 'balanced'
        })
      )
    })
    
    it('should expand content', async () => {
      const result = await bridge.optimizeCurrentContent('expand')
      
      expect(result.type).toBe('expand')
      expect(mockOptimizationService.optimizePrompt).toHaveBeenCalledWith(
        'test content',
        expect.objectContaining({
          maxTokens: 8000,
          optimizationLevel: 'verbose'
        })
      )
    })
    
    it('should simplify content', async () => {
      const result = await bridge.optimizeCurrentContent('simplify')
      
      expect(result.type).toBe('simplify')
      expect(mockOptimizationService.optimizePrompt).toHaveBeenCalledWith(
        'test content',
        expect.objectContaining({
          maxTokens: 2000,
          optimizationLevel: 'aggressive'
        })
      )
    })
    
    it('should format content', async () => {
      const result = await bridge.optimizeCurrentContent('format')
      
      expect(result.type).toBe('format')
      expect(mockOptimizationService.optimizePrompt).toHaveBeenCalledWith(
        'test content',
        expect.objectContaining({
          maxTokens: 4000,
          optimizationLevel: 'formatting'
        })
      )
    })
    
    it('should handle optimization failure', async () => {
      mockOptimizationService.optimizePrompt = vi.fn().mockRejectedValue(new Error('Optimization failed'))
      
      await expect(bridge.optimizeCurrentContent('optimize')).rejects.toThrow('Optimization failed')
    })
    
    it('should include metadata in result', async () => {
      const result = await bridge.optimizeCurrentContent('optimize')
      
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.processingTime).toBeGreaterThanOrEqual(0)
      expect(result.metadata?.tokensReduced).toBeDefined()
    })
  })
  
  describe('optimizeSelection', () => {
    beforeEach(async () => {
      await bridge.init()
    })
    
    it('should optimize selected text', async () => {
      mockEditorService.getSelectedText = vi.fn().mockReturnValue('selected text')
      mockEditorService.getState = vi.fn().mockReturnValue({
        content: 'Line 1\nselected text\nLine 3',
        selection: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 13 }
        }
      })
      
      const result = await bridge.optimizeSelection('optimize')
      
      expect(result.originalContent).toBe('selected text')
      expect(result.optimizedContent).toBe('optimized content')
      expect(mockOptimizationService.optimizePrompt).toHaveBeenCalledWith(
        'selected text',
        expect.any(Object)
      )
    })
    
    it('should throw error when no text selected', async () => {
      mockEditorService.getSelectedText = vi.fn().mockReturnValue('')
      
      await expect(bridge.optimizeSelection('optimize')).rejects.toThrow('No text selected for optimization')
    })
    
    it('should replace selected text with optimized content', async () => {
      mockEditorService.getSelectedText = vi.fn().mockReturnValue('old text')
      mockEditorService.getContent = vi.fn().mockReturnValue('Line 1\nold text\nLine 3')
      mockEditorService.getState = vi.fn().mockReturnValue({
        content: 'Line 1\nold text\nLine 3',
        selection: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 8 }
        }
      })
      
      mockOptimizationService.optimizePrompt = vi.fn().mockResolvedValue({
        optimizedPrompt: 'new text'
      })
      
      await bridge.optimizeSelection('optimize')
      
      // Verify content was updated with the optimized selection
      expect(mockEditorService.updateContent).toHaveBeenCalled()
    })
  })
  
  describe('active optimizations', () => {
    it('should track active optimizations', async () => {
      // Start an optimization without awaiting
      const promise = bridge.optimizeCurrentContent('optimize')
      
      // Check active optimizations
      const active = bridge.getActiveOptimizations()
      expect(active.length).toBeGreaterThan(0)
      expect(active[0].type).toBe('optimize')
      
      // Wait for completion
      await promise
      
      // Should be empty after completion
      const activeAfter = bridge.getActiveOptimizations()
      expect(activeAfter.length).toBe(0)
    })
  })
  
  describe('health check', () => {
    it('should pass health check when services are healthy', async () => {
      const result = await bridge.checkHealth()
      
      expect(result).toBe(true)
      expect(mockEditorService.getContentForOptimization).toHaveBeenCalled()
      expect(mockOptimizationService.getTemplates).toHaveBeenCalled()
    })
    
    it('should fail health check when editor service fails', async () => {
      mockEditorService.getContentForOptimization = vi.fn().mockImplementation(() => {
        throw new Error('Editor error')
      })
      
      const result = await bridge.checkHealth()
      
      expect(result).toBe(false)
    })
    
    it('should fail health check when optimization service fails', async () => {
      mockOptimizationService.getTemplates = vi.fn().mockRejectedValue(new Error('Optimization error'))
      
      const result = await bridge.checkHealth()
      
      expect(result).toBe(false)
    })
  })
  
  describe('registered handlers', () => {
    beforeEach(async () => {
      await bridge.init()
    })
    
    it('should register optimization handler that works', async () => {
      // Get the registered handler
      const calls = mockEditorService.registerOptimizationHandler.mock.calls
      const optimizeCall = calls.find(call => call[0] === 'optimize')
      expect(optimizeCall).toBeDefined()
      
      const handler = optimizeCall![1]
      
      // Test the handler
      const result = await handler('input content')
      expect(result).toBe('optimized content')
    })
    
    it('should register command that performs optimization', async () => {
      // Get the registered command
      const calls = mockEditorService.registerCommand.mock.calls
      const optimizeCommand = calls.find(call => call[0].id === 'editor.optimize')
      expect(optimizeCommand).toBeDefined()
      
      const command = optimizeCommand![0]
      
      // Execute the command handler
      await command.handler()
      
      // Verify optimization was performed and applied
      expect(mockOptimizationService.optimizePrompt).toHaveBeenCalled()
      expect(mockEditorService.applyOptimizationResult).toHaveBeenCalledWith('optimized content')
    })
  })
})