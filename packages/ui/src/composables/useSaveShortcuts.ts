import { onMounted, onUnmounted, ref } from 'vue';

export interface SaveShortcutOptions {
  onSave: () => Promise<void>;
  enabled?: boolean;
}

export function useSaveShortcuts(options: SaveShortcutOptions) {
  const isSaving = ref(false);
  const enabled = ref(options.enabled ?? true);
  
  const handleKeydown = async (event: KeyboardEvent) => {
    if (!enabled.value) return;
    
    // Ctrl+S or Cmd+S
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      
      // Prevent multiple concurrent saves
      if (isSaving.value) return;
      
      isSaving.value = true;
      
      try {
        await options.onSave();
      } catch (error) {
        console.error('Save shortcut failed:', error);
      } finally {
        isSaving.value = false;
      }
    }
  };
  
  const enable = () => {
    enabled.value = true;
  };
  
  const disable = () => {
    enabled.value = false;
  };
  
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
  
  return {
    isSaving,
    enable,
    disable
  };
}