import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SaveStatusIndicator from '../../src/components/SaveStatusIndicator.vue';

describe('SaveStatusIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('unsaved changes indicator', () => {
    it('shows unsaved indicator when there are unsaved changes', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: true,
          saving: false
        }
      });
      
      const unsavedIndicator = wrapper.find('.text-orange-500');
      expect(unsavedIndicator.exists()).toBe(true);
      expect(unsavedIndicator.text()).toBe('●');
    });
    
    it('hides unsaved indicator when saving', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: true,
          saving: true
        }
      });
      
      const unsavedIndicator = wrapper.find('.text-orange-500');
      expect(unsavedIndicator.exists()).toBe(false);
    });
    
    it('hides unsaved indicator when no unsaved changes', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false
        }
      });
      
      const unsavedIndicator = wrapper.find('.text-orange-500');
      expect(unsavedIndicator.exists()).toBe(false);
    });
  });
  
  describe('saving status', () => {
    it('shows saving indicator when saving', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: true
        }
      });
      
      expect(wrapper.text()).toContain('Saving...');
      const loader = wrapper.find('.animate-spin');
      expect(loader.exists()).toBe(true);
    });
    
    it('shows saved confirmation after successful save', async () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: true
        }
      });
      
      // Complete the save
      await wrapper.setProps({ saving: false });
      
      expect(wrapper.text()).toContain('Saved');
      const checkIcon = wrapper.find('.text-green-600');
      expect(checkIcon.exists()).toBe(true);
    });
    
    it('hides saved confirmation after 2 seconds', async () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: true
        }
      });
      
      // Complete the save
      await wrapper.setProps({ saving: false });
      expect(wrapper.text()).toContain('Saved');
      
      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000);
      await wrapper.vm.$nextTick();
      
      expect(wrapper.text()).not.toContain('Saved');
    });
  });
  
  describe('error states', () => {
    it('shows error indicator when save fails', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          saveError: new Error('Save failed')
        }
      });
      
      expect(wrapper.text()).toContain('Save failed');
      const errorIcon = wrapper.find('.text-red-600');
      expect(errorIcon.exists()).toBe(true);
    });
    
    it('does not show saved confirmation when error occurs', async () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: true
        }
      });
      
      // Complete save with error
      await wrapper.setProps({ 
        saving: false,
        saveError: new Error('Failed')
      });
      
      expect(wrapper.text()).not.toContain('Saved');
      expect(wrapper.text()).toContain('Save failed');
    });
  });
  
  describe('conflict detection', () => {
    it('shows conflict indicator when conflict detected', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          conflictDetected: true
        }
      });
      
      expect(wrapper.text()).toContain('Conflict detected');
      const conflictIcon = wrapper.find('.text-yellow-600');
      expect(conflictIcon.exists()).toBe(true);
    });
  });
  
  describe('connection status', () => {
    it('shows disconnected indicator when not connected', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          isConnected: false
        }
      });
      
      const disconnectedIcon = wrapper.find('.text-red-500');
      expect(disconnectedIcon.exists()).toBe(true);
      expect(disconnectedIcon.attributes('title')).toBe('Disconnected from server');
    });
    
    it('hides disconnected indicator when connected', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          isConnected: true
        }
      });
      
      const disconnectedIcon = wrapper.find('.text-red-500');
      expect(disconnectedIcon.exists()).toBe(false);
    });
  });
  
  describe('timestamp display', () => {
    it('shows last saved time when available', () => {
      const lastSavedTime = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(new Date('2024-01-01T12:00:05Z'));
      
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          lastSavedTime
        }
      });
      
      expect(wrapper.text()).toContain('5s ago');
    });
    
    it('formats relative time correctly', () => {
      const lastSavedTime = new Date('2024-01-01T12:00:00Z');
      
      const testCases = [
        { now: '2024-01-01T12:00:03Z', expected: 'just now' },
        { now: '2024-01-01T12:00:30Z', expected: '30s ago' },
        { now: '2024-01-01T12:05:00Z', expected: '5m ago' },
        { now: '2024-01-01T14:00:00Z', expected: '2h ago' },
        { now: '2024-01-03T12:00:00Z', expected: '2d ago' },
      ];
      
      for (const testCase of testCases) {
        vi.setSystemTime(new Date(testCase.now));
        
        const wrapper = mount(SaveStatusIndicator, {
          props: {
            hasUnsavedChanges: false,
            saving: false,
            lastSavedTime
          }
        });
        
        expect(wrapper.text()).toContain(testCase.expected);
        wrapper.unmount();
      }
    });
    
    it('hides timestamp when saving', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: true,
          lastSavedTime: new Date()
        }
      });
      
      const timestamp = wrapper.find('.text-gray-400.text-xs');
      expect(timestamp.text()).not.toMatch(/\d+[smhd] ago/);
    });
    
    it('hides timestamp when there is an error', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          lastSavedTime: new Date(),
          saveError: new Error('Failed')
        }
      });
      
      const timestamp = wrapper.find('.text-gray-400.text-xs');
      expect(timestamp.text()).not.toMatch(/\d+[smhd] ago/);
    });
  });
  
  describe('auto-save indicator', () => {
    it('shows auto-save indicator when enabled', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          autoSaveEnabled: true
        }
      });
      
      const autoSaveIcon = wrapper.find('[title="Auto-save enabled"]');
      expect(autoSaveIcon.exists()).toBe(true);
    });
    
    it('hides auto-save indicator when disabled', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: false,
          autoSaveEnabled: false
        }
      });
      
      const autoSaveIcon = wrapper.find('[title="Auto-save enabled"]');
      expect(autoSaveIcon.exists()).toBe(false);
    });
    
    it('hides auto-save indicator when saving', () => {
      const wrapper = mount(SaveStatusIndicator, {
        props: {
          hasUnsavedChanges: false,
          saving: true,
          autoSaveEnabled: true
        }
      });
      
      const autoSaveIcon = wrapper.find('[title="Auto-save enabled"]');
      expect(autoSaveIcon.exists()).toBe(false);
    });
  });
});