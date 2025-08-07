import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FileInfo } from '../types';

export const useEditorStore = defineStore('editor', () => {
  // State
  const currentFile = ref<FileInfo | null>(null);
  const content = ref('');
  const originalContent = ref('');
  const viewMode = ref<'edit' | 'preview' | 'split'>('edit');
  const isLoading = ref(false);
  const modifiedFiles = ref<Set<string>>(new Set());
  
  // Computed
  const hasUnsavedChanges = computed(() => {
    return content.value !== originalContent.value;
  });
  
  const isCurrentFileModified = computed(() => {
    return currentFile.value ? modifiedFiles.value.has(currentFile.value.path) : false;
  });
  
  // Actions
  const setCurrentFile = (file: FileInfo | null) => {
    currentFile.value = file;
  };
  
  const setContent = (newContent: string) => {
    content.value = newContent;
    
    // Track modified state
    if (currentFile.value) {
      if (newContent !== originalContent.value) {
        modifiedFiles.value.add(currentFile.value.path);
      } else {
        modifiedFiles.value.delete(currentFile.value.path);
      }
    }
  };
  
  const setOriginalContent = (newContent: string) => {
    originalContent.value = newContent;
  };
  
  const setViewMode = (mode: 'edit' | 'preview' | 'split') => {
    viewMode.value = mode;
  };
  
  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
  };
  
  const markFileSaved = (filePath: string) => {
    modifiedFiles.value.delete(filePath);
    if (currentFile.value?.path === filePath) {
      originalContent.value = content.value;
    }
  };
  
  const clearModifiedState = () => {
    modifiedFiles.value.clear();
  };
  
  const isFileModified = (filePath: string) => {
    return modifiedFiles.value.has(filePath);
  };
  
  return {
    // State
    currentFile,
    content,
    originalContent,
    viewMode,
    isLoading,
    modifiedFiles,
    
    // Computed
    hasUnsavedChanges,
    isCurrentFileModified,
    
    // Actions
    setCurrentFile,
    setContent,
    setOriginalContent,
    setViewMode,
    setLoading,
    markFileSaved,
    clearModifiedState,
    isFileModified
  };
});