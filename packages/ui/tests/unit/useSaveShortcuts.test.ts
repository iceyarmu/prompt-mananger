import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useSaveShortcuts } from '../../src/composables/useSaveShortcuts';

describe('useSaveShortcuts', () => {
  let saveHandler: any;
  
  beforeEach(() => {
    saveHandler = vi.fn().mockResolvedValue(undefined);
  });
  
  const TestComponent = defineComponent({
    setup() {
      const { isSaving, enable, disable } = useSaveShortcuts({
        onSave: saveHandler
      });
      
      return { isSaving, enable, disable };
    },
    template: '<div>Test</div>'
  });
  
  describe('keyboard shortcuts', () => {
    it('triggers save on Ctrl+S', async () => {
      const wrapper = mount(TestComponent);
      
      // Simulate Ctrl+S
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(saveHandler).toHaveBeenCalledTimes(1);
      
      wrapper.unmount();
    });
    
    it('triggers save on Cmd+S (Mac)', async () => {
      const wrapper = mount(TestComponent);
      
      // Simulate Cmd+S
      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(saveHandler).toHaveBeenCalledTimes(1);
      
      wrapper.unmount();
    });
    
    it('prevents default browser save behavior', async () => {
      const wrapper = mount(TestComponent);
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      
      wrapper.unmount();
    });
    
    it('does not trigger save on other key combinations', async () => {
      const wrapper = mount(TestComponent);
      
      // Try various other combinations
      const events = [
        new KeyboardEvent('keydown', { key: 's' }), // Just S
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }), // Ctrl+A
        new KeyboardEvent('keydown', { key: 's', shiftKey: true }), // Shift+S
        new KeyboardEvent('keydown', { key: 's', altKey: true }), // Alt+S
      ];
      
      for (const event of events) {
        document.dispatchEvent(event);
      }
      
      await wrapper.vm.$nextTick();
      
      expect(saveHandler).not.toHaveBeenCalled();
      
      wrapper.unmount();
    });
  });
  
  describe('concurrent save prevention', () => {
    it('prevents multiple concurrent saves', async () => {
      // Make save handler take some time
      saveHandler = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const wrapper = mount(defineComponent({
        setup() {
          const { isSaving } = useSaveShortcuts({
            onSave: saveHandler
          });
          return { isSaving };
        },
        template: '<div>{{ isSaving }}</div>'
      }));
      
      // Trigger multiple saves rapidly
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      document.dispatchEvent(event);
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should only have called save once
      expect(saveHandler).toHaveBeenCalledTimes(1);
      
      wrapper.unmount();
    });
    
    it('tracks saving state correctly', async () => {
      let resolveFunc: any;
      saveHandler = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFunc = resolve; })
      );
      
      const wrapper = mount(defineComponent({
        setup() {
          const { isSaving } = useSaveShortcuts({
            onSave: saveHandler
          });
          return { isSaving };
        },
        template: '<div>{{ isSaving }}</div>'
      }));
      
      expect(wrapper.vm.isSaving).toBe(false);
      
      // Trigger save
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(wrapper.vm.isSaving).toBe(true);
      
      // Resolve the save
      resolveFunc();
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(wrapper.vm.isSaving).toBe(false);
      
      wrapper.unmount();
    });
  });
  
  describe('enable/disable functionality', () => {
    it('can be disabled', async () => {
      const wrapper = mount(TestComponent);
      
      // Disable shortcuts
      wrapper.vm.disable();
      await wrapper.vm.$nextTick();
      
      // Try to trigger save
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(saveHandler).not.toHaveBeenCalled();
      
      wrapper.unmount();
    });
    
    it('can be re-enabled after disabling', async () => {
      const wrapper = mount(TestComponent);
      
      // Disable then re-enable
      wrapper.vm.disable();
      wrapper.vm.enable();
      await wrapper.vm.$nextTick();
      
      // Should work again
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(saveHandler).toHaveBeenCalledTimes(1);
      
      wrapper.unmount();
    });
    
    it('respects initial enabled option', async () => {
      const wrapper = mount(defineComponent({
        setup() {
          return useSaveShortcuts({
            onSave: saveHandler,
            enabled: false
          });
        },
        template: '<div>Test</div>'
      }));
      
      // Should not work when initially disabled
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      
      expect(saveHandler).not.toHaveBeenCalled();
      
      wrapper.unmount();
    });
  });
  
  describe('error handling', () => {
    it('handles save errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      saveHandler = vi.fn().mockRejectedValue(new Error('Save failed'));
      
      const wrapper = mount(defineComponent({
        setup() {
          const { isSaving } = useSaveShortcuts({
            onSave: saveHandler
          });
          return { isSaving };
        },
        template: '<div>{{ isSaving }}</div>'
      }));
      
      // Trigger save
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should log error
      expect(consoleError).toHaveBeenCalledWith('Save shortcut failed:', expect.any(Error));
      
      // Should reset saving state
      expect(wrapper.vm.isSaving).toBe(false);
      
      consoleError.mockRestore();
      wrapper.unmount();
    });
  });
  
  describe('cleanup', () => {
    it('removes event listener on unmount', async () => {
      const wrapper = mount(TestComponent);
      
      wrapper.unmount();
      
      // After unmount, shortcuts should not work
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(event);
      
      expect(saveHandler).not.toHaveBeenCalled();
    });
  });
});