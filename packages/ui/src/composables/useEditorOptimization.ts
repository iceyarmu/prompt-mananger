import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';
import { useServices } from './useServices';
import { useEditorStore } from './editorStore';
import { showNotification } from '../utils/notification';
import { useI18n } from 'vue-i18n';
import { EditorOptimizationHandler, type OptimizationResult } from '../services/EditorOptimizationHandler';
import type { OptimizationMode } from '@prompt-optimizer/core';

export function useEditorOptimization(content: Ref<string>) {
  const { services } = useServices();
  const editorStore = useEditorStore();
  const { t } = useI18n();
  
  // State
  const optimizing = ref(false);
  const showOptimizationModal = ref(false);
  const optimizationResult = ref<OptimizationResult | null>(null);
  const optimizationMode = ref<OptimizationMode>('system');
  const selectedModel = ref<string>('');
  const selectedTemplate = ref<string>('');
  
  // Open optimization modal
  const openOptimizationModal = async () => {
    if (!content.value?.trim()) {
      showNotification(t('editor.notifications.noContent', 'No content to optimize'), 'warning');
      return;
    }
    
    if (!services.value) {
      showNotification(t('editor.notifications.servicesNotReady', 'Services not ready'), 'error');
      return;
    }
    
    optimizing.value = true;
    
    try {
      // Create an adapter to match EditorStore interface expected by handler
      const editorStoreAdapter = {
        content: editorStore.content,
        setContent: (content: string) => editorStore.setContent(content),
        pushToUndoStack: undefined,
        markAsModified: () => {
          // The setContent method already handles marking as modified
        }
      };
      
      const handler = new EditorOptimizationHandler(services.value, editorStoreAdapter);
      const result = await handler.optimizeCurrentContent(
        optimizationMode.value,
        selectedTemplate.value || undefined,
        selectedModel.value || undefined
      );
      
      optimizationResult.value = result;
      showOptimizationModal.value = true;
      
    } catch (error) {
      console.error('Optimization failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Optimization failed';
      showNotification(
        t('editor.notifications.optimizationFailed', { error: errorMessage }),
        'error',
        0,
        [{
          label: t('common.retry', 'Retry'),
          action: () => openOptimizationModal()
        }]
      );
    } finally {
      optimizing.value = false;
    }
  };
  
  // Apply optimization to editor
  const applyOptimization = async (optimizedContent: string) => {
    if (!services.value) return;
    
    try {
      // Create an adapter to match EditorStore interface expected by handler
      const editorStoreAdapter = {
        content: editorStore.content,
        setContent: (content: string) => editorStore.setContent(content),
        // These are optional methods that may not exist in the Pinia store
        pushToUndoStack: undefined,
        markAsModified: () => {
          // The setContent method already handles marking as modified
        }
      };
      
      const handler = new EditorOptimizationHandler(services.value, editorStoreAdapter);
      
      // Store original content for undo
      const originalContent = editorStore.content;
      
      // Apply the optimized content
      handler.applyOptimization(optimizedContent);
      
      // Close the modal
      showOptimizationModal.value = false;
      optimizationResult.value = null;
      
      // Show success notification with undo option
      showNotification(
        t('editor.notifications.optimizationApplied', 'Optimization applied'),
        'success',
        5000,
        [{
          label: t('common.undo', 'Undo'),
          action: () => {
            editorStore.setContent(originalContent);
            showNotification(t('editor.notifications.reverted', 'Reverted to original'), 'info');
          }
        }]
      );
    } catch (error) {
      console.error('Failed to apply optimization:', error);
      showNotification(
        t('editor.notifications.applyFailed', 'Failed to apply optimization'),
        'error'
      );
    }
  };
  
  // Set optimization options
  const setOptimizationMode = (mode: OptimizationMode) => {
    optimizationMode.value = mode;
  };
  
  const setSelectedModel = (model: string) => {
    selectedModel.value = model;
  };
  
  const setSelectedTemplate = (template: string) => {
    selectedTemplate.value = template;
  };
  
  // Keyboard shortcut handler
  const handleKeyboardShortcut = (event: KeyboardEvent) => {
    // Ctrl+Shift+O or Cmd+Shift+O for optimization
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'o') {
      event.preventDefault();
      
      if (content.value && !optimizing.value) {
        openOptimizationModal();
      }
    }
  };
  
  // Setup keyboard shortcuts
  onMounted(() => {
    document.addEventListener('keydown', handleKeyboardShortcut);
  });
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyboardShortcut);
    // Clean up optimization results to prevent memory leaks
    optimizationResult.value = null;
    showOptimizationModal.value = false;
  });
  
  return {
    // State
    optimizing,
    showOptimizationModal,
    optimizationResult,
    optimizationMode,
    selectedModel,
    selectedTemplate,
    
    // Actions
    openOptimizationModal,
    applyOptimization,
    setOptimizationMode,
    setSelectedModel,
    setSelectedTemplate
  };
}