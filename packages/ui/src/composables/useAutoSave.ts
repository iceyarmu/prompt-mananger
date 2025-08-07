import { ref, watch, Ref, onUnmounted } from 'vue';
import type { SaveManager } from '../services/SaveManager';

export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // milliseconds
  debounceDelay: number;
  maxRetries: number;
}

export interface AutoSaveState {
  lastSaveTime: Date | null;
  saveInProgress: boolean;
  failedSaveCount: number;
}

export function useAutoSave(
  editorStore: any,
  saveManager: SaveManager,
  config: Ref<AutoSaveConfig>
) {
  const autoSaveTimer = ref<NodeJS.Timeout | null>(null);
  const lastChangeTime = ref<Date | null>(null);
  const debouncedSaveTimer = ref<NodeJS.Timeout | null>(null);
  const state = ref<AutoSaveState>({
    lastSaveTime: null,
    saveInProgress: false,
    failedSaveCount: 0
  });
  
  // Watch for content changes
  watch(
    () => editorStore.content,
    (newContent, oldContent) => {
      if (newContent !== oldContent) {
        lastChangeTime.value = new Date();
        scheduleAutoSave();
      }
    }
  );
  
  const scheduleAutoSave = () => {
    if (!config.value.enabled || !editorStore.hasUnsavedChanges) return;
    
    // Clear existing timers
    clearAutoSaveTimers();
    
    // Debounced save - reset timer on each change
    debouncedSaveTimer.value = setTimeout(() => {
      performAutoSave();
    }, config.value.debounceDelay);
  };
  
  const performAutoSave = async () => {
    if (!editorStore.currentFile || !editorStore.hasUnsavedChanges || state.value.saveInProgress) {
      return;
    }
    
    state.value.saveInProgress = true;
    
    try {
      const result = await saveManager.saveFile(
        editorStore.currentFile.path,
        editorStore.content,
        { retryCount: config.value.maxRetries }
      );
      
      if (result.success) {
        editorStore.markAsSaved();
        state.value.lastSaveTime = result.timestamp;
        state.value.failedSaveCount = 0;
      } else {
        state.value.failedSaveCount++;
        // Don't show notification for auto-save failures
        // User will see unsaved indicator
        console.warn('Auto-save failed:', result.error);
      }
      
    } catch (error) {
      state.value.failedSaveCount++;
      console.error('Auto-save error:', error);
    } finally {
      state.value.saveInProgress = false;
    }
  };
  
  const clearAutoSaveTimers = () => {
    if (autoSaveTimer.value) {
      clearTimeout(autoSaveTimer.value);
      autoSaveTimer.value = null;
    }
    if (debouncedSaveTimer.value) {
      clearTimeout(debouncedSaveTimer.value);
      debouncedSaveTimer.value = null;
    }
  };
  
  // Setup interval-based auto-save timer
  const setupIntervalTimer = () => {
    clearAutoSaveTimers();
    
    if (config.value.enabled && config.value.interval > 0) {
      autoSaveTimer.value = setInterval(() => {
        // Check for inactivity period
        const now = new Date();
        const timeSinceLastChange = lastChangeTime.value 
          ? now.getTime() - lastChangeTime.value.getTime() 
          : Infinity;
        
        // Only save if there was a change and enough time has passed since last change
        if (editorStore.hasUnsavedChanges && timeSinceLastChange >= 30000) {
          performAutoSave();
        }
      }, config.value.interval);
    }
  };
  
  // Watch for interval changes
  watch(
    () => config.value.interval,
    () => setupIntervalTimer(),
    { immediate: true }
  );
  
  // Watch for enabled/disabled changes
  watch(
    () => config.value.enabled,
    () => setupIntervalTimer()
  );
  
  // Cleanup on unmount
  onUnmounted(() => {
    clearAutoSaveTimers();
  });
  
  return {
    performAutoSave,
    clearAutoSaveTimers,
    state
  };
}