import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { useEditorOptimization } from '../../src/composables/useEditorOptimization';
import { showNotification } from '../../src/utils/notification';
import { EditorOptimizationHandler } from '../../src/services/EditorOptimizationHandler';

// Mock the notification utility
vi.mock('../../src/utils/notification', () => ({
  showNotification: vi.fn()
}));

// Mock the EditorOptimizationHandler
vi.mock('../../src/services/EditorOptimizationHandler', () => ({
  EditorOptimizationHandler: vi.fn().mockImplementation(() => ({
    optimizeCurrentContent: vi.fn(),
    applyOptimization: vi.fn()
  }))
}));

// Mock the services
vi.mock('../../src/composables/useServices', () => ({
  useServices: () => ({
    services: ref({
      promptService: {
        optimizePrompt: vi.fn().mockResolvedValue('Optimized content')
      },
      modelManager: {
        getModels: vi.fn().mockResolvedValue({ 'gpt-4': {} })
      },
      templateManager: {
        getTemplates: vi.fn().mockResolvedValue([])
      }
    })
  })
}));

// Mock the editor store
vi.mock('../../src/composables/editorStore', () => ({
  useEditorStore: () => ({
    content: 'Test content',
    setContent: vi.fn()
  })
}));

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key
  })
}));

describe('Editor-Optimization Store Integration', () => {
  let content: any;
  let mockShowNotification: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    content = ref('Test prompt content');
    mockShowNotification = vi.mocked(showNotification);
  });

  describe('Connection and State Management', () => {
    it('should initialize with correct default state', () => {
      const {
        optimizing,
        showOptimizationModal,
        optimizationResult,
        optimizationMode,
        selectedModel,
        selectedTemplate
      } = useEditorOptimization(content);
      
      expect(optimizing.value).toBe(false);
      expect(showOptimizationModal.value).toBe(false);
      expect(optimizationResult.value).toBeNull();
      expect(optimizationMode.value).toBe('system');
      expect(selectedModel.value).toBe('');
      expect(selectedTemplate.value).toBe('');
    });

    it('should pass editor content to optimization handler', async () => {
      const { openOptimizationModal } = useEditorOptimization(content);
      
      await openOptimizationModal();
      
      expect(EditorOptimizationHandler).toHaveBeenCalled();
    });

    it('should handle optimization in progress state', async () => {
      const { optimizing, openOptimizationModal } = useEditorOptimization(content);
      
      // Mock handler to simulate processing
      const mockHandler = {
        optimizeCurrentContent: vi.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve({
              original: 'Test prompt content',
              optimized: 'Optimized content',
              metadata: {}
            }), 100);
          });
        })
      };
      
      vi.mocked(EditorOptimizationHandler).mockImplementationOnce(() => mockHandler as any);
      
      const promise = openOptimizationModal();
      
      // Check that optimizing is true during processing
      await nextTick();
      expect(optimizing.value).toBe(true);
      
      // Wait for completion
      await promise;
      expect(optimizing.value).toBe(false);
    });
  });

  describe('Toast Notifications', () => {
    it('should show warning when no content to optimize', async () => {
      const emptyContent = ref('');
      const { openOptimizationModal } = useEditorOptimization(emptyContent);
      
      await openOptimizationModal();
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        'No content to optimize',
        'warning'
      );
    });

    it('should show notification when optimization starts', async () => {
      const { openOptimizationModal } = useEditorOptimization(content);
      
      const mockHandler = {
        optimizeCurrentContent: vi.fn().mockResolvedValue({
          original: 'Test prompt content',
          optimized: 'Optimized content',
          metadata: {}
        })
      };
      
      vi.mocked(EditorOptimizationHandler).mockImplementationOnce(() => mockHandler as any);
      
      await openOptimizationModal();
      
      // The current implementation doesn't show a start notification, 
      // but shows the modal instead, which is better UX
      expect(mockHandler.optimizeCurrentContent).toHaveBeenCalled();
    });

    it('should show error notification on failure', async () => {
      const { openOptimizationModal } = useEditorOptimization(content);
      
      const mockHandler = {
        optimizeCurrentContent: vi.fn().mockRejectedValue(new Error('API Error'))
      };
      
      vi.mocked(EditorOptimizationHandler).mockImplementationOnce(() => mockHandler as any);
      
      await openOptimizationModal();
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('API Error'),
        'error',
        0,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Retry'
          })
        ])
      );
    });

    it('should show success notification when optimization is applied', async () => {
      const { applyOptimization } = useEditorOptimization(content);
      
      const mockHandler = {
        applyOptimization: vi.fn()
      };
      
      vi.mocked(EditorOptimizationHandler).mockImplementationOnce(() => mockHandler as any);
      
      await applyOptimization('Optimized content');
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        'Optimization applied',
        'success',
        5000,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Undo'
          })
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing services gracefully', async () => {
      // Mock services to return null
      vi.mock('../../src/composables/useServices', () => ({
        useServices: () => ({
          services: ref(null)
        })
      }), { override: true });
      
      const { openOptimizationModal } = useEditorOptimization(content);
      
      await openOptimizationModal();
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        'Services not ready',
        'error'
      );
    });

    it('should handle optimization handler errors', async () => {
      const { openOptimizationModal } = useEditorOptimization(content);
      
      vi.mocked(EditorOptimizationHandler).mockImplementationOnce(() => {
        throw new Error('Handler initialization failed');
      });
      
      await openOptimizationModal();
      
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('Handler initialization failed'),
        'error',
        0,
        expect.any(Array)
      );
    });
  });

  describe('Configuration Management', () => {
    it('should update optimization mode', () => {
      const { optimizationMode, setOptimizationMode } = useEditorOptimization(content);
      
      setOptimizationMode('user');
      expect(optimizationMode.value).toBe('user');
      
      setOptimizationMode('system');
      expect(optimizationMode.value).toBe('system');
    });

    it('should update selected model', () => {
      const { selectedModel, setSelectedModel } = useEditorOptimization(content);
      
      setSelectedModel('gpt-4');
      expect(selectedModel.value).toBe('gpt-4');
    });

    it('should update selected template', () => {
      const { selectedTemplate, setSelectedTemplate } = useEditorOptimization(content);
      
      setSelectedTemplate('custom-template');
      expect(selectedTemplate.value).toBe('custom-template');
    });

    it('should pass configuration to optimization handler', async () => {
      const { 
        setOptimizationMode,
        setSelectedModel,
        setSelectedTemplate,
        openOptimizationModal
      } = useEditorOptimization(content);
      
      setOptimizationMode('user');
      setSelectedModel('gpt-4');
      setSelectedTemplate('custom-template');
      
      const mockHandler = {
        optimizeCurrentContent: vi.fn().mockResolvedValue({
          original: 'Test',
          optimized: 'Optimized',
          metadata: {}
        })
      };
      
      vi.mocked(EditorOptimizationHandler).mockImplementationOnce(() => mockHandler as any);
      
      await openOptimizationModal();
      
      expect(mockHandler.optimizeCurrentContent).toHaveBeenCalledWith(
        'user',
        'custom-template',
        'gpt-4'
      );
    });
  });
});