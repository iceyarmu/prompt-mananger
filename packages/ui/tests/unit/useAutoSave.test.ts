import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ref } from 'vue';
import { useAutoSave } from '../../src/composables/useAutoSave';
import type { SaveManager } from '../../src/services/SaveManager';

describe('useAutoSave', () => {
  let mockEditorStore: any;
  let mockSaveManager: SaveManager;
  let autoSaveConfig: any;
  
  beforeEach(() => {
    vi.useFakeTimers();
    
    mockEditorStore = {
      content: ref('Initial content'),
      currentFile: { path: '/test.md' },
      hasUnsavedChanges: true,
      markAsSaved: vi.fn()
    };
    
    mockSaveManager = {
      saveFile: vi.fn().mockResolvedValue({
        success: true,
        timestamp: new Date(),
        bytesWritten: 100
      })
    } as any;
    
    autoSaveConfig = ref({
      enabled: true,
      interval: 30000, // 30 seconds
      debounceDelay: 300, // 300ms
      maxRetries: 3
    });
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('debounced auto-save', () => {
    it('triggers save after debounce delay', async () => {
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Change content
      mockEditorStore.content.value = 'New content';
      
      // Should not save immediately
      expect(mockSaveManager.saveFile).not.toHaveBeenCalled();
      
      // Fast-forward past debounce delay
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(mockSaveManager.saveFile).toHaveBeenCalledWith(
        '/test.md',
        'New content',
        { retryCount: 3 }
      );
    });
    
    it('resets debounce timer on multiple changes', async () => {
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Make multiple rapid changes
      mockEditorStore.content.value = 'Change 1';
      vi.advanceTimersByTime(100);
      
      mockEditorStore.content.value = 'Change 2';
      vi.advanceTimersByTime(100);
      
      mockEditorStore.content.value = 'Change 3';
      vi.advanceTimersByTime(100);
      
      // Total time: 300ms, but timer was reset each time
      expect(mockSaveManager.saveFile).not.toHaveBeenCalled();
      
      // Wait for debounce delay from last change
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      // Should save with final content
      expect(mockSaveManager.saveFile).toHaveBeenCalledTimes(1);
      expect(mockSaveManager.saveFile).toHaveBeenCalledWith(
        '/test.md',
        'Change 3',
        { retryCount: 3 }
      );
    });
  });
  
  describe('interval-based auto-save', () => {
    it('triggers after inactivity period', async () => {
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Make a change
      mockEditorStore.content.value = 'Changed content';
      
      // Wait for debounce
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      // Clear the first save call
      mockSaveManager.saveFile.mockClear();
      mockEditorStore.hasUnsavedChanges = true;
      
      // Wait for 30 seconds of inactivity + interval
      vi.advanceTimersByTime(30000 + 30000);
      await vi.runAllTimersAsync();
      
      expect(mockSaveManager.saveFile).toHaveBeenCalled();
    });
    
    it('does not trigger if changes are still happening', async () => {
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Make continuous changes
      for (let i = 0; i < 10; i++) {
        mockEditorStore.content.value = `Change ${i}`;
        vi.advanceTimersByTime(5000); // Every 5 seconds
      }
      
      // Even after 50 seconds, should not have interval-saved
      // because changes kept happening
      expect(mockSaveManager.saveFile).not.toHaveBeenCalled();
    });
  });
  
  describe('configuration changes', () => {
    it('disables auto-save when config.enabled is false', async () => {
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Disable auto-save
      autoSaveConfig.value.enabled = false;
      
      // Make changes
      mockEditorStore.content.value = 'Changed content';
      
      // Wait for what would be debounce delay
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(mockSaveManager.saveFile).not.toHaveBeenCalled();
    });
    
    it('updates interval when config.interval changes', async () => {
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Change interval to 10 seconds
      autoSaveConfig.value.interval = 10000;
      
      // Make a change
      mockEditorStore.content.value = 'Changed content';
      
      // Wait for debounce
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      // Clear the first save
      mockSaveManager.saveFile.mockClear();
      mockEditorStore.hasUnsavedChanges = true;
      
      // Wait for inactivity + new interval
      vi.advanceTimersByTime(30000 + 10000);
      await vi.runAllTimersAsync();
      
      expect(mockSaveManager.saveFile).toHaveBeenCalled();
    });
  });
  
  describe('save state tracking', () => {
    it('tracks last save time', async () => {
      const saveTime = new Date('2024-01-01T12:00:00Z');
      mockSaveManager.saveFile = vi.fn().mockResolvedValue({
        success: true,
        timestamp: saveTime,
        bytesWritten: 100
      });
      
      const { state } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Trigger save
      mockEditorStore.content.value = 'New content';
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(state.value.lastSaveTime).toEqual(saveTime);
    });
    
    it('tracks failed save count', async () => {
      mockSaveManager.saveFile = vi.fn().mockResolvedValue({
        success: false,
        timestamp: new Date(),
        error: new Error('Save failed')
      });
      
      const { state } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Trigger multiple failed saves
      for (let i = 0; i < 3; i++) {
        mockEditorStore.content.value = `Change ${i}`;
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
        vi.advanceTimersByTime(30000);
      }
      
      expect(state.value.failedSaveCount).toBe(3);
    });
    
    it('resets failed count on successful save', async () => {
      const { state } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // First fail
      mockSaveManager.saveFile = vi.fn().mockResolvedValue({
        success: false,
        timestamp: new Date(),
        error: new Error('Save failed')
      });
      
      mockEditorStore.content.value = 'Change 1';
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(state.value.failedSaveCount).toBe(1);
      
      // Then succeed
      mockSaveManager.saveFile = vi.fn().mockResolvedValue({
        success: true,
        timestamp: new Date(),
        bytesWritten: 100
      });
      
      mockEditorStore.hasUnsavedChanges = true;
      mockEditorStore.content.value = 'Change 2';
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(state.value.failedSaveCount).toBe(0);
    });
  });
  
  describe('edge cases', () => {
    it('does not save when no file is open', async () => {
      mockEditorStore.currentFile = null;
      
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      mockEditorStore.content.value = 'Changed content';
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(mockSaveManager.saveFile).not.toHaveBeenCalled();
    });
    
    it('does not save when there are no unsaved changes', async () => {
      mockEditorStore.hasUnsavedChanges = false;
      
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      mockEditorStore.content.value = 'Changed content';
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      
      expect(mockSaveManager.saveFile).not.toHaveBeenCalled();
    });
    
    it('prevents concurrent saves', async () => {
      // Make saveFile take some time
      mockSaveManager.saveFile = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          timestamp: new Date(),
          bytesWritten: 100
        }), 1000))
      );
      
      const { performAutoSave } = useAutoSave(
        mockEditorStore,
        mockSaveManager,
        autoSaveConfig
      );
      
      // Trigger first save
      await performAutoSave();
      
      // Try to trigger another while first is in progress
      await performAutoSave();
      
      // Should only have called saveFile once
      expect(mockSaveManager.saveFile).toHaveBeenCalledTimes(1);
    });
  });
});