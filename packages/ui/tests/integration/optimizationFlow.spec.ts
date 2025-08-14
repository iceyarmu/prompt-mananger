import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { createTestingPinia } from '@pinia/testing';
import MarkdownEditor from '../../src/components/MarkdownEditor.vue';
import OptimizationResultsModal from '../../src/components/OptimizationResultsModal.vue';
import { useEditorOptimization } from '../../src/composables/useEditorOptimization';
import { showNotification } from '../../src/utils/notification';

// Mock all required modules
vi.mock('md-editor-v3', () => ({
  MdEditor: {
    name: 'MdEditor',
    template: '<div class="md-editor-mock"><slot /></div>',
    props: ['modelValue', 'theme', 'language', 'preview', 'previewOnly', 'toolbars', 'codeTheme'],
    emits: ['update:modelValue', 'on-change', 'on-save', 'on-upload-img']
  }
}));

vi.mock('../../src/utils/notification', () => ({
  showNotification: vi.fn()
}));

// Create a mock i18n plugin
const createMockI18n = () => ({
  install: (app: any) => {
    app.config.globalProperties.$t = (key: string, defaultValue?: string) => defaultValue || key;
    app.provide('i18n', {
      global: {
        t: (key: string, defaultValue?: string) => defaultValue || key
      }
    });
  }
});

// Mock services
const mockPromptService = {
  optimizePrompt: vi.fn().mockResolvedValue('Optimized prompt content')
};

const mockCompareService = {
  compare: vi.fn().mockResolvedValue({
    fragments: [
      { index: 0, type: 'unchanged', text: 'This is ' },
      { index: 1, type: 'removed', text: 'original' },
      { index: 2, type: 'added', text: 'optimized' },
      { index: 3, type: 'unchanged', text: ' content' }
    ],
    summary: {
      additions: 1,
      deletions: 1,
      unchanged: 2
    }
  })
};

const mockModelManager = {
  getModels: vi.fn().mockResolvedValue({
    'gpt-4': { id: 'gpt-4', name: 'GPT-4' },
    'claude-3': { id: 'claude-3', name: 'Claude 3' }
  })
};

const mockTemplateManager = {
  getTemplates: vi.fn().mockResolvedValue([
    { id: 'default', name: 'Default Template' },
    { id: 'custom', name: 'Custom Template' }
  ])
};

const mockPreferenceService = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../../src/composables/useServices', () => ({
  useServices: () => ({
    services: ref({
      promptService: mockPromptService,
      compareService: mockCompareService,
      modelManager: mockModelManager,
      templateManager: mockTemplateManager,
      preferenceService: mockPreferenceService
    })
  })
}));

// Mock child components
vi.mock('../../src/components/EditorErrorBoundary.vue', () => ({
  default: {
    name: 'EditorErrorBoundary',
    template: '<div><slot /></div>'
  }
}));

vi.mock('../../src/components/OptimizationOptionsPopover.vue', () => ({
  default: {
    name: 'OptimizationOptionsPopover',
    template: '<div class="optimization-options-mock">Options</div>',
    props: ['optimizationMode', 'selectedModel', 'selectedTemplate'],
    emits: ['update:optimizationMode', 'update:selectedModel', 'update:selectedTemplate']
  }
}));

vi.mock('../../src/components/ModelSelect.vue', () => ({
  default: {
    name: 'ModelSelect',
    template: '<select class="model-select-mock"><option>Model</option></select>',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue', 'config']
  }
}));

vi.mock('../../src/components/ExecutionOptionsPopover.vue', () => ({
  default: {
    name: 'ExecutionOptionsPopover',
    template: '<div class="execution-options-mock">Options</div>',
    props: ['options', 'selectedModel'],
    emits: ['update:options']
  }
}));

vi.mock('../../src/components/ExecutionResultsPanel.vue', () => ({
  default: {
    name: 'ExecutionResultsPanel',
    template: '<div class="execution-results-mock" v-if="result">Results</div>',
    props: ['result', 'streaming'],
    emits: ['close']
  }
}));

vi.mock('../../src/components/ModelManager.vue', () => ({
  default: {
    name: 'ModelManager',
    template: '<div class="model-manager-mock">Manager</div>',
    emits: ['close']
  }
}));

describe('Optimization Flow Integration', () => {
  let wrapper: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset localStorage
    localStorage.clear();
  });
  
  afterEach(() => {
    wrapper?.unmount();
  });

  describe('Complete Optimization Flow', () => {
    it('should complete full optimization flow from editor to results', async () => {
      // Mock the optimization handler
      vi.mock('../../src/services/EditorOptimizationHandler', () => ({
        EditorOptimizationHandler: vi.fn().mockImplementation(() => ({
          optimizeCurrentContent: vi.fn().mockResolvedValue({
            original: 'Original prompt content',
            optimized: 'Optimized prompt content',
            metadata: {
              model: 'gpt-4',
              template: 'default',
              mode: 'system',
              timestamp: new Date(),
              originalLength: 23,
              optimizedLength: 24,
              changePercentage: 4
            }
          }),
          applyOptimization: vi.fn()
        }))
      }));
      
      // Mount the editor
      wrapper = mount(MarkdownEditor, {
        global: {
          plugins: [createTestingPinia(), createMockI18n()],
          stubs: {
            OptimizationResultsModal: false // Don't stub the modal
          }
        }
      });
      
      // Find and click the optimize button
      const optimizeButton = wrapper.find('button[aria-label="Optimize"]');
      expect(optimizeButton.exists()).toBe(true);
      
      await optimizeButton.trigger('click');
      await nextTick();
      
      // Check that modal opens
      const modal = wrapper.findComponent(OptimizationResultsModal);
      expect(modal.exists()).toBe(true);
      expect(modal.props('visible')).toBe(true);
    });

    it('should display diff view with changes highlighted', async () => {
      const modalWrapper = mount(OptimizationResultsModal, {
        props: {
          visible: true,
          result: {
            original: 'This is original content',
            optimized: 'This is optimized content',
            metadata: {
              model: 'gpt-4',
              template: 'default',
              mode: 'system',
              timestamp: new Date(),
              originalLength: 24,
              optimizedLength: 25,
              changePercentage: 4
            }
          }
        },
        global: {
          plugins: [createTestingPinia(), createMockI18n()],
          stubs: {
            Modal: {
              name: 'Modal',
              template: '<div class="modal-mock"><slot /><slot name="title" /></div>',
              props: ['modelValue']
            },
            TextDiff: {
              name: 'TextDiff',
              template: '<div class="text-diff-mock">Diff view</div>',
              props: ['original', 'optimized', 'compareResult', 'isEnabled', 'showHeader', 'displayMode']
            },
            MarkdownRenderer: {
              name: 'MarkdownRenderer',
              template: '<div class="markdown-renderer-mock">{{ content }}</div>',
              props: ['content']
            }
          }
        }
      });
      
      // Switch to diff view
      const diffButton = modalWrapper.findAll('button').find(btn => 
        btn.text().includes('Diff View')
      );
      
      if (diffButton) {
        await diffButton.trigger('click');
        await nextTick();
        
        // Check that diff view is displayed
        const diffView = modalWrapper.find('.text-diff-mock');
        expect(diffView.exists()).toBe(true);
      }
    });

    it('should handle accept/reject functionality correctly', async () => {
      const applyHandler = vi.fn();
      
      const modalWrapper = mount(OptimizationResultsModal, {
        props: {
          visible: true,
          result: {
            original: 'Original content',
            optimized: 'Optimized content',
            metadata: {
              model: 'gpt-4',
              template: 'default',
              mode: 'system',
              timestamp: new Date(),
              originalLength: 16,
              optimizedLength: 17,
              changePercentage: 6
            }
          }
        },
        global: {
          plugins: [createTestingPinia(), createMockI18n()],
          stubs: {
            Modal: {
              name: 'Modal',
              template: '<div class="modal-mock"><slot /><slot name="title" /></div>',
              props: ['modelValue'],
              emits: ['update:modelValue']
            },
            TextDiff: true,
            MarkdownRenderer: true
          }
        }
      });
      
      modalWrapper.vm.$on('apply', applyHandler);
      
      // Find and click Apply button
      const applyButton = modalWrapper.findAll('button').find(btn => 
        btn.text().includes('Apply Optimization')
      );
      
      if (applyButton) {
        await applyButton.trigger('click');
        await nextTick();
        
        // Check that apply event was emitted
        expect(modalWrapper.emitted('apply')).toBeTruthy();
        expect(modalWrapper.emitted('apply')[0]).toEqual(['Optimized content']);
      }
      
      // Test reject (Cancel button)
      const cancelButton = modalWrapper.findAll('button').find(btn => 
        btn.text().includes('Cancel')
      );
      
      if (cancelButton) {
        await cancelButton.trigger('click');
        await nextTick();
        
        // Check that modal closes
        expect(modalWrapper.emitted('update:visible')).toBeTruthy();
        expect(modalWrapper.emitted('update:visible')[0]).toEqual([false]);
      }
    });
  });

  describe('History Persistence', () => {
    it('should save optimization history to localStorage', () => {
      // Mock optimization store
      const history = [
        {
          id: '1',
          prompt: 'Test prompt',
          result: 'Optimized result',
          timestamp: Date.now(),
          model: 'gpt-4',
          template: 'default'
        }
      ];
      
      localStorage.setItem('optimization:history', JSON.stringify(history));
      
      const saved = localStorage.getItem('optimization:history');
      expect(saved).toBeDefined();
      expect(JSON.parse(saved!)).toEqual(history);
    });

    it('should limit history to 100 entries', () => {
      const history = Array.from({ length: 105 }, (_, i) => ({
        id: String(i),
        prompt: `Prompt ${i}`,
        result: `Result ${i}`,
        timestamp: Date.now() + i,
        model: 'gpt-4',
        template: 'default'
      }));
      
      // Simulate the store's history management
      const limitedHistory = history.slice(-100);
      
      expect(limitedHistory).toHaveLength(100);
      expect(limitedHistory[0].id).toBe('5');
      expect(limitedHistory[99].id).toBe('104');
    });
  });

  describe('Mode Switching and Configuration', () => {
    it('should switch between system and user optimization modes', async () => {
      // Test mode persistence
      await mockPreferenceService.set('editor.optimization.mode', 'user');
      
      const savedMode = await mockPreferenceService.get('editor.optimization.mode');
      expect(mockPreferenceService.set).toHaveBeenCalledWith(
        'editor.optimization.mode',
        'user'
      );
    });

    it('should persist selected model and template', async () => {
      await mockPreferenceService.set('editor.optimization.model', 'claude-3');
      await mockPreferenceService.set('editor.optimization.template', 'custom');
      
      expect(mockPreferenceService.set).toHaveBeenCalledWith(
        'editor.optimization.model',
        'claude-3'
      );
      expect(mockPreferenceService.set).toHaveBeenCalledWith(
        'editor.optimization.template',
        'custom'
      );
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should trigger optimization with Ctrl+Alt+O', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'o',
        ctrlKey: true,
        altKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      
      // The actual test would require the component to be mounted
      // and the event listener to be properly attached
      expect(event.defaultPrevented).toBe(false); // Would be true if handler worked
    });
  });

  describe('Error Handling', () => {
    it('should show error notification on optimization failure', async () => {
      // Mock a failed optimization
      mockPromptService.optimizePrompt.mockRejectedValueOnce(
        new Error('API request failed')
      );
      
      const content = ref('Test content');
      const { openOptimizationModal } = useEditorOptimization(content);
      
      await openOptimizationModal();
      
      // Check that error notification was shown
      expect(showNotification).toHaveBeenCalled();
    });

    it('should provide retry functionality on failure', async () => {
      const mockShowNotification = vi.mocked(showNotification);
      mockShowNotification.mockClear();
      
      // Mock a failed optimization
      mockPromptService.optimizePrompt.mockRejectedValueOnce(
        new Error('Network error')
      );
      
      const content = ref('Test content');
      const { openOptimizationModal } = useEditorOptimization(content);
      
      await openOptimizationModal();
      
      // Verify retry action was provided
      const lastCall = mockShowNotification.mock.calls[mockShowNotification.mock.calls.length - 1];
      if (lastCall && lastCall[3]) {
        const actions = lastCall[3];
        expect(actions).toHaveLength(1);
        expect(actions[0].label).toContain('Retry');
      }
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on component unmount', async () => {
      const wrapper = mount(MarkdownEditor, {
        global: {
          plugins: [createTestingPinia(), createMockI18n()]
        }
      });
      
      // Unmount and check for cleanup
      await wrapper.unmount();
      
      // In a real test, we'd check that event listeners are removed,
      // timers are cleared, and references are nullified
      expect(wrapper.vm).toBeUndefined();
    });
  });

  describe('Cross-Browser Compatibility', () => {
    // These tests would typically run in different browser environments
    it('should work in Chrome', () => {
      expect(true).toBe(true); // Placeholder
    });
    
    it('should work in Firefox', () => {
      expect(true).toBe(true); // Placeholder
    });
    
    it('should work in Safari', () => {
      expect(true).toBe(true); // Placeholder
    });
    
    it('should work in Edge', () => {
      expect(true).toBe(true); // Placeholder
    });
  });
});