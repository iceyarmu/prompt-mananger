import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import MarkdownEditor from '../../src/components/MarkdownEditor.vue';
import { createTestingPinia } from '@pinia/testing';

// Mock the MdEditor component
vi.mock('md-editor-v3', () => ({
  MdEditor: {
    name: 'MdEditor',
    template: '<div class="md-editor-mock"><slot /></div>',
    props: ['modelValue', 'theme', 'language', 'preview', 'previewOnly', 'toolbars', 'codeTheme'],
    emits: ['update:modelValue', 'on-change', 'on-save', 'on-upload-img']
  }
}));

// Mock child components
vi.mock('../../src/components/EditorErrorBoundary.vue', () => ({
  default: {
    name: 'EditorErrorBoundary',
    template: '<div><slot /></div>'
  }
}));

vi.mock('../../src/components/OptimizationResultsModal.vue', () => ({
  default: {
    name: 'OptimizationResultsModal',
    template: '<div class="optimization-modal-mock" v-if="visible">Modal</div>',
    props: ['visible', 'result'],
    emits: ['update:visible', 'apply']
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

// Mock composables with reactive values
const mockContent = ref('Test content');
const mockOptimizing = ref(false);
const mockOpenOptimizationModal = vi.fn();
const mockApplyOptimization = vi.fn();
const mockSetOptimizationMode = vi.fn();

vi.mock('../../src/composables/useMarkdownEditor', () => ({
  useMarkdownEditor: () => ({
    content: mockContent,
    currentFileName: ref('test.md'),
    hasUnsavedChanges: ref(false),
    currentViewMode: ref('edit'),
    viewModes: [
      { value: 'edit', label: 'Edit' },
      { value: 'preview', label: 'Preview' },
      { value: 'split', label: 'Split' }
    ],
    editorTheme: ref('light'),
    codeTheme: ref('github'),
    currentLocale: ref('en'),
    toolbarConfig: [],
    loading: ref(false),
    loadProgress: ref(0),
    handleContentChange: vi.fn(),
    handleSave: vi.fn(),
    handleImageUpload: vi.fn(),
    setViewMode: vi.fn()
  })
}));

vi.mock('../../src/composables/useEditorOptimization', () => ({
  useEditorOptimization: () => ({
    optimizing: mockOptimizing,
    showOptimizationModal: ref(false),
    optimizationResult: ref(null),
    optimizationMode: ref('system'),
    selectedModel: ref(''),
    selectedTemplate: ref(''),
    openOptimizationModal: mockOpenOptimizationModal,
    applyOptimization: mockApplyOptimization,
    setOptimizationMode: mockSetOptimizationMode,
    setSelectedModel: vi.fn(),
    setSelectedTemplate: vi.fn()
  })
}));

vi.mock('../../src/composables/usePromptExecution', () => ({
  usePromptExecution: () => ({
    executing: ref(false),
    selectedExecutionModel: ref('gpt-4'),
    executionOptions: ref({}),
    executionResult: ref(null),
    showExecutionResults: ref(false),
    showModelManager: ref(false),
    executePrompt: vi.fn()
  })
}));

describe('MarkdownEditor - Optimization Button', () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock values to defaults
    mockContent.value = 'Test content';
    mockOptimizing.value = false;
    mockOpenOptimizationModal.mockClear();
    
    wrapper = mount(MarkdownEditor, {
      global: {
        plugins: [createTestingPinia()],
        mocks: {
          $t: (key: string, defaultValue?: string) => defaultValue || key
        }
      }
    });
  });
  
  afterEach(() => {
    wrapper?.unmount();
  });

  it('should render the optimize button', () => {
    const button = wrapper.find('button[aria-label="Optimize"]');
    expect(button.exists()).toBe(true);
  });

  it('should display the optimize icon when not optimizing', () => {
    const button = wrapper.find('button[aria-label="Optimize"]');
    const svg = button.find('svg:not(.animate-spin)');
    expect(svg.exists()).toBe(true);
  });

  it('should show the correct tooltip with keyboard shortcut', () => {
    const button = wrapper.find('button[aria-label="Optimize"]');
    expect(button.attributes('title')).toBe('Optimize prompt (Ctrl+Alt+O / Cmd+Alt+O)');
  });

  it('should be enabled when content exists', () => {
    const button = wrapper.find('button[aria-label="Optimize"]');
    expect(button.element.disabled).toBe(false);
    expect(button.classes()).toContain('bg-blue-500');
  });

  it('should be disabled when no content exists', async () => {
    // Set empty content
    mockContent.value = '';
    await nextTick();

    const button = wrapper.find('button[aria-label="Optimize"]');
    expect(button.element.disabled).toBe(true);
    expect(button.classes()).toContain('cursor-not-allowed');
  });

  it('should call openOptimizationModal when clicked', async () => {
    const button = wrapper.find('button[aria-label="Optimize"]');
    await button.trigger('click');
    expect(mockOpenOptimizationModal).toHaveBeenCalled();
  });

  it('should show spinner when optimizing', async () => {
    // Set optimizing state
    mockOptimizing.value = true;
    await nextTick();

    const button = wrapper.find('button[aria-label="Optimize"]');
    const spinner = button.find('svg.animate-spin');
    expect(spinner.exists()).toBe(true);
    expect(button.text()).toContain('Optimizing...');
  });

  it('should be disabled during optimization', async () => {
    // Set optimizing state
    mockOptimizing.value = true;
    await nextTick();

    const button = wrapper.find('button[aria-label="Optimize"]');
    expect(button.element.disabled).toBe(true);
  });

  it('should position button in toolbar with correct styling', () => {
    const toolbar = wrapper.find('.editor-header');
    const optimizeSection = toolbar.find('.ml-2.pl-2.border-l');
    expect(optimizeSection.exists()).toBe(true);
    
    const button = optimizeSection.find('button[aria-label="Optimize"]');
    expect(button.exists()).toBe(true);
    expect(button.classes()).toContain('px-3');
    expect(button.classes()).toContain('py-1');
    expect(button.classes()).toContain('text-xs');
    expect(button.classes()).toContain('rounded');
  });
});

describe('MarkdownEditor - Keyboard Shortcut', () => {
  let wrapper: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockContent.value = 'Test content';
    mockOptimizing.value = false;
    
    wrapper = mount(MarkdownEditor, {
      global: {
        plugins: [createTestingPinia()],
        mocks: {
          $t: (key: string, defaultValue?: string) => defaultValue || key
        }
      }
    });
  });
  
  afterEach(() => {
    wrapper?.unmount();
  });
  
  it('should trigger optimization with Ctrl+Alt+O', async () => {
    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      altKey: true,
      bubbles: true
    });

    document.dispatchEvent(keyboardEvent);
    await nextTick();

    expect(mockOpenOptimizationModal).toHaveBeenCalled();
  });

  it('should trigger optimization with Cmd+Alt+O on Mac', async () => {
    mockOpenOptimizationModal.mockClear();
    
    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'o',
      metaKey: true,
      altKey: true,
      bubbles: true
    });

    document.dispatchEvent(keyboardEvent);
    await nextTick();

    expect(mockOpenOptimizationModal).toHaveBeenCalled();
  });

  it('should not trigger optimization without correct modifiers', async () => {
    mockOpenOptimizationModal.mockClear();
    
    // Just 'o' key
    const keyEvent1 = new KeyboardEvent('keydown', {
      key: 'o',
      bubbles: true
    });
    document.dispatchEvent(keyEvent1);
    
    // Ctrl+O without Alt
    const keyEvent2 = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true
    });
    document.dispatchEvent(keyEvent2);
    
    // Alt+O without Ctrl
    const keyEvent3 = new KeyboardEvent('keydown', {
      key: 'o',
      altKey: true,
      bubbles: true
    });
    document.dispatchEvent(keyEvent3);
    
    await nextTick();
    expect(mockOpenOptimizationModal).not.toHaveBeenCalled();
  });
});