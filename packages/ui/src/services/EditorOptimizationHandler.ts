import { IPromptService, OptimizationRequest, OptimizationMode } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

export interface OptimizationResult {
  original: string;
  optimized: string;
  metadata: {
    model: string;
    template?: string;
    mode: OptimizationMode;
    timestamp: Date;
    originalLength: number;
    optimizedLength: number;
    changePercentage: number;
  };
}

// Define proper type for EditorStore to improve type safety
export interface EditorStore {
  content: string;
  setContent: (content: string) => void;
  pushToUndoStack?: (content: string) => void;
  markAsModified?: () => void;
}

export class EditorOptimizationHandler {
  private originalContent: string = '';
  
  constructor(
    private services: AppServices,
    private editorStore: EditorStore  // Use proper type instead of 'any'
  ) {}
  
  async optimizeCurrentContent(mode: OptimizationMode = 'system', templateId?: string, modelKey?: string): Promise<OptimizationResult> {
    const content = this.editorStore.content;
    this.originalContent = content;
    
    // Get default model and template if not provided
    const actualModelKey = modelKey || await this.getDefaultModel();
    const actualTemplateId = templateId || await this.getDefaultTemplate(mode);
    
    // Use existing optimization service exactly as current implementation
    const optimizationRequest: OptimizationRequest = {
      optimizationMode: mode,
      targetPrompt: content,
      templateId: actualTemplateId,
      modelKey: actualModelKey
    };
    
    const result = await this.services.promptService.optimizePrompt(optimizationRequest);
    
    return {
      original: this.originalContent,
      optimized: result,
      metadata: {
        model: actualModelKey,
        template: actualTemplateId,
        mode: mode,
        timestamp: new Date(),
        originalLength: content.length,
        optimizedLength: result.length,
        changePercentage: Math.round(((result.length - content.length) / content.length) * 100)
      }
    };
  }
  
  applyOptimization(optimizedContent: string): void {
    // Store original for undo
    this.pushToUndoStack(this.originalContent);
    
    // Apply optimized content
    this.editorStore.setContent(optimizedContent);
    
    // Mark as modified
    this.markAsModified();
  }
  
  revertOptimization(): void {
    if (this.originalContent) {
      this.editorStore.setContent(this.originalContent);
    }
  }
  
  private async getDefaultModel(): Promise<string> {
    // Get the first available model from model manager
    const models = await this.services.modelManager.getModels();
    const modelKeys = Object.keys(models);
    if (modelKeys.length === 0) {
      throw new Error('No models available for optimization');
    }
    return modelKeys[0];
  }
  
  private async getDefaultTemplate(mode: OptimizationMode): Promise<string> {
    // Get default template based on mode
    const templates = await this.services.templateManager.getTemplates();
    
    // Look for default templates based on mode
    const defaultTemplateIds = mode === 'system' 
      ? ['general-optimize', 'analytical-optimize', 'output-format-optimize']
      : ['user-prompt-basic', 'user-prompt-planning', 'user-prompt-professional'];
    
    for (const id of defaultTemplateIds) {
      if (templates.some(t => t.id === id)) {
        return id;
      }
    }
    
    // Fallback to first available template
    if (templates.length > 0) {
      return templates[0].id;
    }
    
    throw new Error('No templates available for optimization');
  }
  
  private pushToUndoStack(content: string): void {
    // Safely attempt to push to undo stack with error handling
    try {
      if (this.editorStore.pushToUndoStack) {
        this.editorStore.pushToUndoStack(content);
      } else {
        // Log warning if undo functionality is not available
        console.warn('Undo stack functionality not available in editor store');
      }
    } catch (error) {
      console.error('Failed to push to undo stack:', error);
      // Continue execution as this is not critical
    }
  }
  
  private markAsModified(): void {
    // Safely mark as modified with error handling
    try {
      if (this.editorStore.markAsModified) {
        this.editorStore.markAsModified();
      } else {
        // Log warning if modification tracking is not available
        console.warn('Modification tracking not available in editor store');
      }
    } catch (error) {
      console.error('Failed to mark as modified:', error);
      // Continue execution as this is not critical
    }
  }
}