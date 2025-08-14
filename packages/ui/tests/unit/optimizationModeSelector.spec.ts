import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import OptimizationModeSelector from '../../src/components/OptimizationModeSelector.vue';
import OptimizationOptionsPopover from '../../src/components/OptimizationOptionsPopover.vue';
import { createTestingPinia } from '@pinia/testing';

// Mock child components
vi.mock('../../src/components/ModelSelect.vue', () => ({
  default: {
    name: 'ModelSelect',
    template: '<select class="model-select-mock"><option>Model</option></select>',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue', 'config']
  }
}));

vi.mock('../../src/components/TemplateSelect.vue', () => ({
  default: {
    name: 'TemplateSelect',
    template: '<select class="template-select-mock"><option>Template</option></select>',
    props: ['modelValue', 'optimizationMode'],
    emits: ['update:modelValue']
  }
}));

// Mock services
vi.mock('../../src/composables/useServices', () => ({
  useServices: () => ({
    services: {
      value: {
        preferenceService: {
          get: vi.fn().mockResolvedValue('system'),
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    }
  })
}));

// Mock notification
vi.mock('../../src/utils/notification', () => ({
  showNotification: vi.fn()
}));

// Mock i18n
const mockT = (key: string, defaultValue?: string) => defaultValue || key;

describe('OptimizationModeSelector', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(OptimizationModeSelector, {
      props: {
        modelValue: 'system'
      },
      global: {
        mocks: {
          $t: mockT,
          t: mockT
        }
      }
    });
  });

  it('should render both system and user mode buttons', () => {
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text()).toContain('promptOptimizer.systemPrompt');
    expect(buttons[1].text()).toContain('promptOptimizer.userPrompt');
  });

  it('should highlight the selected mode', () => {
    const systemButton = wrapper.find('button:first-child');
    const userButton = wrapper.find('button:last-child');
    
    expect(systemButton.classes()).toContain('theme-button-toggle-active');
    expect(userButton.classes()).toContain('theme-button-toggle-inactive');
  });

  it('should emit update:modelValue when mode is changed', async () => {
    const userButton = wrapper.find('button:last-child');
    await userButton.trigger('click');
    
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['user']);
  });

  it('should emit change event when mode is changed', async () => {
    const userButton = wrapper.find('button:last-child');
    await userButton.trigger('click');
    
    expect(wrapper.emitted('change')).toBeTruthy();
    expect(wrapper.emitted('change')[0]).toEqual(['user']);
  });

  it('should not emit events when clicking already selected mode', async () => {
    const systemButton = wrapper.find('button:first-child');
    await systemButton.trigger('click');
    
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
    expect(wrapper.emitted('change')).toBeFalsy();
  });

  it('should update visual state when modelValue prop changes', async () => {
    await wrapper.setProps({ modelValue: 'user' });
    
    const systemButton = wrapper.find('button:first-child');
    const userButton = wrapper.find('button:last-child');
    
    expect(systemButton.classes()).toContain('theme-button-toggle-inactive');
    expect(userButton.classes()).toContain('theme-button-toggle-active');
  });

  it('should have proper aria attributes', () => {
    const systemButton = wrapper.find('button:first-child');
    const userButton = wrapper.find('button:last-child');
    
    expect(systemButton.attributes('aria-pressed')).toBe('true');
    expect(userButton.attributes('aria-pressed')).toBe('false');
  });

  it('should have tooltips on buttons', () => {
    const systemButton = wrapper.find('button:first-child');
    const userButton = wrapper.find('button:last-child');
    
    expect(systemButton.attributes('title')).toBe('promptOptimizer.systemPromptHelp');
    expect(userButton.attributes('title')).toBe('promptOptimizer.userPromptHelp');
  });
});

describe('OptimizationOptionsPopover Integration', () => {
  let wrapper: any;
  let mockPreferenceService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPreferenceService = {
      get: vi.fn().mockResolvedValue('system'),
      set: vi.fn().mockResolvedValue(undefined)
    };

    // Re-mock useServices for this test suite
    vi.mock('../../src/composables/useServices', () => ({
      useServices: () => ({
        services: {
          value: {
            preferenceService: mockPreferenceService
          }
        }
      })
    }), { override: true });

    wrapper = mount(OptimizationOptionsPopover, {
      props: {
        optimizationMode: 'system',
        selectedModel: 'gpt-4',
        selectedTemplate: 'default'
      },
      global: {
        plugins: [createTestingPinia()],
        mocks: {
          $t: mockT,
          t: mockT
        },
        stubs: {
          OptimizationModeSelector: false // Don't stub this component
        }
      }
    });
  });

  it('should render optimization mode selector in popover', async () => {
    // Open popover
    const button = wrapper.find('button[aria-label="Optimization Options"]');
    await button.trigger('click');
    await nextTick();
    
    const modeSelector = wrapper.findComponent(OptimizationModeSelector);
    expect(modeSelector.exists()).toBe(true);
  });

  it('should pass optimizationMode prop to selector', async () => {
    // Open popover
    const button = wrapper.find('button[aria-label="Optimization Options"]');
    await button.trigger('click');
    await nextTick();
    
    const modeSelector = wrapper.findComponent(OptimizationModeSelector);
    expect(modeSelector.props('modelValue')).toBe('system');
  });

  it('should emit update:optimizationMode when mode changes', async () => {
    // Open popover
    const button = wrapper.find('button[aria-label="Optimization Options"]');
    await button.trigger('click');
    await nextTick();
    
    const modeSelector = wrapper.findComponent(OptimizationModeSelector);
    await modeSelector.vm.$emit('update:modelValue', 'user');
    
    expect(wrapper.emitted('update:optimizationMode')).toBeTruthy();
    expect(wrapper.emitted('update:optimizationMode')[0]).toEqual(['user']);
  });

  it('should save mode preference when save as default is clicked', async () => {
    const { showNotification } = await import('../../src/utils/notification');
    const mockShowNotification = vi.mocked(showNotification);
    
    // Open popover
    const button = wrapper.find('button[aria-label="Optimization Options"]');
    await button.trigger('click');
    await nextTick();
    
    // Click save as default
    const saveButton = wrapper.find('button').element.textContent?.includes('Save as Default') 
      ? wrapper.find('button:contains("Save as Default")')
      : wrapper.findAll('button').filter((w: any) => w.text().includes('Save as Default'))[0];
      
    if (saveButton) {
      await saveButton.trigger('click');
      
      expect(mockPreferenceService.set).toHaveBeenCalledWith('editor.optimization.mode', 'system');
      expect(mockPreferenceService.set).toHaveBeenCalledWith('editor.optimization.model', 'gpt-4');
      expect(mockPreferenceService.set).toHaveBeenCalledWith('editor.optimization.template', 'default');
    }
  });

  it('should close popover when clicking outside', async () => {
    // Open popover
    const button = wrapper.find('button[aria-label="Optimization Options"]');
    await button.trigger('click');
    await nextTick();
    
    expect(wrapper.find('.absolute.right-0.mt-2').exists()).toBe(true);
    
    // Simulate click outside
    document.body.click();
    await nextTick();
    
    // Popover should close
    expect(wrapper.find('.absolute.right-0.mt-2').exists()).toBe(false);
  });

  it('should toggle popover visibility on button click', async () => {
    const button = wrapper.find('button[aria-label="Optimization Options"]');
    
    // Initially closed
    expect(wrapper.find('.absolute.right-0.mt-2').exists()).toBe(false);
    
    // Open
    await button.trigger('click');
    await nextTick();
    expect(wrapper.find('.absolute.right-0.mt-2').exists()).toBe(true);
    
    // Close
    await button.trigger('click');
    await nextTick();
    expect(wrapper.find('.absolute.right-0.mt-2').exists()).toBe(false);
  });
});