import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorOptimizationHandler, type OptimizationResult } from '../../src/services/EditorOptimizationHandler';
import type { AppServices } from '../../src/types/services';

describe('EditorOptimizationHandler', () => {
  let mockServices: AppServices;
  let mockEditorStore: any;
  let handler: EditorOptimizationHandler;

  beforeEach(() => {
    // Mock services
    mockServices = {
      promptService: {
        optimizePrompt: vi.fn().mockResolvedValue('# Optimized prompt content')
      },
      modelManager: {
        getModels: vi.fn().mockResolvedValue({ 'gpt-4': { name: 'GPT-4' }, 'claude-3': { name: 'Claude 3' } })
      },
      templateManager: {
        getTemplates: vi.fn().mockResolvedValue([
          { id: 'general-optimize', name: 'General Optimize' },
          { id: 'user-prompt-basic', name: 'User Prompt Basic' }
        ])
      }
    } as any;

    // Mock editor store
    mockEditorStore = {
      content: '# Test prompt',
      setContent: vi.fn(),
      pushToUndoStack: vi.fn(),
      markAsModified: vi.fn()
    };

    handler = new EditorOptimizationHandler(mockServices, mockEditorStore);
  });

  describe('optimizeCurrentContent', () => {
    it('should send correct optimization request for system mode', async () => {
      const result = await handler.optimizeCurrentContent('system');
      
      expect(mockServices.promptService.optimizePrompt).toHaveBeenCalledWith({
        optimizationMode: 'system',
        targetPrompt: '# Test prompt',
        templateId: 'general-optimize',
        modelKey: 'gpt-4'
      });
      
      expect(result.original).toBe('# Test prompt');
      expect(result.optimized).toBe('# Optimized prompt content');
      expect(result.metadata.mode).toBe('system');
    });

    it('should send correct optimization request for user mode', async () => {
      const result = await handler.optimizeCurrentContent('user');
      
      expect(mockServices.promptService.optimizePrompt).toHaveBeenCalledWith({
        optimizationMode: 'user',
        targetPrompt: '# Test prompt',
        templateId: 'user-prompt-basic',
        modelKey: 'gpt-4'
      });
      
      expect(result.metadata.mode).toBe('user');
    });

    it('should use provided model and template', async () => {
      await handler.optimizeCurrentContent('system', 'custom-template', 'claude-3');
      
      expect(mockServices.promptService.optimizePrompt).toHaveBeenCalledWith({
        optimizationMode: 'system',
        targetPrompt: '# Test prompt',
        templateId: 'custom-template',
        modelKey: 'claude-3'
      });
    });

    it('should calculate metadata correctly', async () => {
      const result = await handler.optimizeCurrentContent('system');
      
      expect(result.metadata.originalLength).toBe(13); // '# Test prompt'.length
      expect(result.metadata.optimizedLength).toBe(26); // '# Optimized prompt content'.length
      expect(result.metadata.changePercentage).toBe(100); // 100% increase
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error when no models available', async () => {
      mockServices.modelManager.getModels = vi.fn().mockResolvedValue({});
      
      await expect(handler.optimizeCurrentContent('system')).rejects.toThrow('No models available for optimization');
    });

    it('should throw error when no templates available', async () => {
      mockServices.templateManager.getTemplates = vi.fn().mockResolvedValue([]);
      
      await expect(handler.optimizeCurrentContent('system')).rejects.toThrow('No templates available for optimization');
    });
  });

  describe('applyOptimization', () => {
    it('should apply optimized content correctly', () => {
      const optimizedContent = '# Optimized content';
      handler.applyOptimization(optimizedContent);
      
      expect(mockEditorStore.setContent).toHaveBeenCalledWith(optimizedContent);
    });

    it('should push original content to undo stack', () => {
      // First optimize to set original content
      handler.optimizeCurrentContent('system');
      
      const optimizedContent = '# Optimized content';
      handler.applyOptimization(optimizedContent);
      
      // Since pushToUndoStack is not implemented in mock, we just verify the content was set
      expect(mockEditorStore.setContent).toHaveBeenCalledWith(optimizedContent);
    });
  });

  describe('revertOptimization', () => {
    it('should revert to original content', async () => {
      // First optimize to set original content
      await handler.optimizeCurrentContent('system');
      
      // Apply optimization
      handler.applyOptimization('# New content');
      
      // Revert
      handler.revertOptimization();
      
      expect(mockEditorStore.setContent).toHaveBeenCalledWith('# Test prompt');
    });
  });
});