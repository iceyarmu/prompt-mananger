import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import SystemRouter from '../SystemRouter.vue';

// Mock the feature flag service
vi.mock('@prompt-optimizer/ui/services/FeatureFlagService', () => ({
  useFeatureFlags: vi.fn(() => ({
    isNewPlatformEnabled: vi.fn(() => false),
    getCutoverVariant: vi.fn(() => 'old_system'),
    getVariant: vi.fn(() => 'control'),
    onFlagChange: vi.fn((flag, callback) => {
      // Store callback for testing
      (global as any).__flagChangeCallback = callback;
      return () => {};
    }),
    getRolloutStatus: vi.fn(() => ({ percentage: 0, usersAffected: 0, variant: 'disabled' }))
  }))
}));

// Mock the store communication
vi.mock('../../stores/communication', () => ({
  useStoreCommunication: vi.fn(() => ({
    emit: vi.fn(),
    subscribe: vi.fn(),
    cleanup: vi.fn()
  }))
}));

// Mock components
const MockNewComponent = defineComponent({
  name: 'MockNewComponent',
  template: '<div class="new-component">New System Component</div>'
});

const MockOldComponent = defineComponent({
  name: 'MockOldComponent',
  template: '<div class="old-component">Old System Component</div>'
});

describe('SystemRouter', () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup component mocks
    vi.mock('../AppContent.vue', () => ({
      default: MockNewComponent
    }));
    
    vi.mock('../legacy/AppContentLegacy.vue', () => ({
      default: MockOldComponent
    }));
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Loading', () => {
    it('should load old system component when feature flag is disabled', async () => {
      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: () => false,
        getCutoverVariant: () => 'old_system',
        getVariant: () => 'control',
        onFlagChange: vi.fn(() => () => {}),
        getRolloutStatus: () => ({ percentage: 0, usersAffected: 0, variant: 'disabled' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent',
          showIndicator: true
        }
      });

      await flushPromises();

      expect(wrapper.vm.isNewSystem).toBe(false);
      expect(wrapper.vm.userVariant).toBe('old_system');
    });

    it('should load new system component when feature flag is enabled', async () => {
      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: () => true,
        getCutoverVariant: () => 'new_system',
        getVariant: () => 'variant_a',
        onFlagChange: vi.fn(() => () => {}),
        getRolloutStatus: () => ({ percentage: 50, usersAffected: 50, variant: 'variant_a' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent',
          showIndicator: true
        }
      });

      await flushPromises();

      expect(wrapper.vm.isNewSystem).toBe(true);
      expect(wrapper.vm.userVariant).toBe('new_system');
    });
  });

  describe('System Switching', () => {
    it('should switch systems when feature flag changes', async () => {
      let flagChangeCallback: any;
      
      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: vi.fn()
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true),
        getCutoverVariant: vi.fn()
          .mockReturnValueOnce('old_system')
          .mockReturnValueOnce('new_system'),
        getVariant: () => 'control',
        onFlagChange: vi.fn((flag, callback) => {
          flagChangeCallback = callback;
          return () => {};
        }),
        getRolloutStatus: () => ({ percentage: 50, usersAffected: 50, variant: 'control' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent'
        }
      });

      await flushPromises();
      expect(wrapper.vm.isNewSystem).toBe(false);

      // Simulate feature flag change
      if (flagChangeCallback) {
        await flagChangeCallback(true);
        await flushPromises();
      }

      expect(wrapper.vm.isNewSystem).toBe(true);
    });

    it('should emit system-switched event when system changes', async () => {
      let flagChangeCallback: any;
      
      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: vi.fn()
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true),
        getCutoverVariant: vi.fn()
          .mockReturnValueOnce('old_system')
          .mockReturnValueOnce('new_system'),
        getVariant: () => 'control',
        onFlagChange: vi.fn((flag, callback) => {
          flagChangeCallback = callback;
          return () => {};
        }),
        getRolloutStatus: () => ({ percentage: 50, usersAffected: 50, variant: 'control' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent'
        }
      });

      await flushPromises();

      // Trigger system switch
      if (flagChangeCallback) {
        await flagChangeCallback(true);
        await flushPromises();
      }

      expect(wrapper.emitted('system-switched')).toBeTruthy();
      expect(wrapper.emitted('system-switched')[0]).toEqual(['new']);
    });
  });

  describe('Error Handling', () => {
    it('should emit component-error when component fails to load', async () => {
      // Mock a component that will fail to load
      vi.mock('../BrokenComponent.vue', () => {
        throw new Error('Component load failed');
      });

      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: () => true,
        getCutoverVariant: () => 'new_system',
        getVariant: () => 'control',
        onFlagChange: vi.fn(() => () => {}),
        getRolloutStatus: () => ({ percentage: 100, usersAffected: 100, variant: 'control' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'BrokenComponent'
        }
      });

      await flushPromises();

      // Check if error handling was triggered
      expect(wrapper.vm.loadError).toBeTruthy();
    });

    it('should fallback to old system on new system component error', async () => {
      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      let isNewPlatformEnabledValue = true;
      
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: () => isNewPlatformEnabledValue,
        getCutoverVariant: () => isNewPlatformEnabledValue ? 'new_system' : 'old_system',
        getVariant: () => 'control',
        onFlagChange: vi.fn(() => () => {}),
        getRolloutStatus: () => ({ percentage: 100, usersAffected: 100, variant: 'control' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent'
        }
      });

      await flushPromises();
      expect(wrapper.vm.isNewSystem).toBe(true);

      // Simulate component error
      wrapper.vm.handleComponentError(new Error('Component failed'));
      await flushPromises();

      expect(wrapper.emitted('fallback-triggered')).toBeTruthy();
      expect(wrapper.emitted('fallback-triggered')[0]).toEqual(['component_error']);
    });
  });

  describe('System Indicator', () => {
    it('should show system indicator in dev mode', async () => {
      const originalEnv = import.meta.env.DEV;
      Object.defineProperty(import.meta.env, 'DEV', {
        value: true,
        writable: true
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent',
          showIndicator: false // Even with false, should show in dev
        }
      });

      await flushPromises();

      expect(wrapper.find('.system-indicator').exists()).toBe(true);

      Object.defineProperty(import.meta.env, 'DEV', {
        value: originalEnv,
        writable: true
      });
    });

    it('should show correct system label', async () => {
      const { useFeatureFlags } = await import('@prompt-optimizer/ui/services/FeatureFlagService');
      (useFeatureFlags as any).mockReturnValue({
        isNewPlatformEnabled: () => true,
        getCutoverVariant: () => 'new_system',
        getVariant: () => 'variant_a',
        onFlagChange: vi.fn(() => () => {}),
        getRolloutStatus: () => ({ percentage: 100, usersAffected: 100, variant: 'variant_a' })
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent',
          showIndicator: true
        }
      });

      await flushPromises();

      const indicator = wrapper.find('.system-indicator');
      expect(indicator.classes()).toContain('new-system');
      expect(indicator.text()).toContain('New Platform');
    });
  });

  describe('Transition Handling', () => {
    it('should prevent concurrent system switches', async () => {
      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent'
        }
      });

      await flushPromises();

      // Set transition in progress
      wrapper.vm.transitionInProgress = true;

      // Try to switch system
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await wrapper.vm.handleSystemSwitch(true);

      expect(consoleSpy).toHaveBeenCalledWith('System switch already in progress');
      
      consoleSpy.mockRestore();
    });

    it('should track transition events', async () => {
      const { useStoreCommunication } = await import('../../stores/communication');
      const emitMock = vi.fn();
      (useStoreCommunication as any).mockReturnValue({
        emit: emitMock,
        subscribe: vi.fn(),
        cleanup: vi.fn()
      });

      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent'
        }
      });

      await flushPromises();

      // Trigger transition handlers
      wrapper.vm.handleBeforeLeave();
      expect(emitMock).toHaveBeenCalledWith('analytics', 'track', expect.objectContaining({
        event: 'system_transition_start'
      }));

      wrapper.vm.handleAfterEnter();
      expect(emitMock).toHaveBeenCalledWith('analytics', 'track', expect.objectContaining({
        event: 'system_transition_complete'
      }));
    });
  });

  describe('URL Compatibility', () => {
    it('should maintain URL compatibility between old and new systems', async () => {
      const currentPath = '/files/document.md';
      
      wrapper = mount(SystemRouter, {
        props: {
          componentName: 'AppContent',
          componentProps: {
            path: currentPath
          }
        }
      });

      await flushPromises();

      // Path should be preserved in component props
      expect(wrapper.props('componentProps').path).toBe(currentPath);

      // Switch systems
      wrapper.vm.isNewSystem = true;
      await flushPromises();

      // Path should still be preserved
      expect(wrapper.props('componentProps').path).toBe(currentPath);
    });
  });
});