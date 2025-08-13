import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FileInfo } from '@prompt-optimizer/webdav'
import type { FileOperationsService } from '../services/FileOperationsService'

export interface CursorPosition {
  line: number
  column: number
}

export interface ScrollPosition {
  top: number
  left: number
}

export const useEditorStore = defineStore('editor', () => {
  const currentFile = ref<FileInfo | null>(null)
  const content = ref('')
  const originalContent = ref('')
  const viewMode = ref<'edit' | 'preview' | 'split'>('edit')
  const isLoading = ref(false)
  const modifiedFiles = ref<Set<string>>(new Set())
  const cursorPosition = ref<CursorPosition | null>(null)
  const scrollPosition = ref<ScrollPosition | null>(null)
  const isDirty = ref(false)
  const lastSaved = ref<Date | null>(null)
  const error = ref<string | null>(null)
  
  const hasUnsavedChanges = computed(() => {
    return content.value !== originalContent.value
  })
  
  const isCurrentFileModified = computed(() => {
    return currentFile.value ? modifiedFiles.value.has(currentFile.value.path) : false
  })
  
  const canSave = computed(() => {
    return currentFile.value !== null && hasUnsavedChanges.value && !isLoading.value
  })
  
  const fileStatus = computed(() => {
    if (isLoading.value) return 'loading'
    if (error.value) return 'error'
    if (hasUnsavedChanges.value) return 'modified'
    return 'saved'
  })
  
  const setCurrentFile = (file: FileInfo | null) => {
    currentFile.value = file
    if (!file) {
      clearEditor()
    }
  }
  
  const setContent = (newContent: string) => {
    content.value = newContent
    
    if (currentFile.value) {
      if (newContent !== originalContent.value) {
        modifiedFiles.value.add(currentFile.value.path)
        isDirty.value = true
      } else {
        modifiedFiles.value.delete(currentFile.value.path)
        isDirty.value = false
      }
    }
  }
  
  const setOriginalContent = (newContent: string) => {
    originalContent.value = newContent
    isDirty.value = false
  }
  
  const setViewMode = (mode: 'edit' | 'preview' | 'split') => {
    viewMode.value = mode
  }
  
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }
  
  const setCursorPosition = (position: CursorPosition | null) => {
    cursorPosition.value = position
  }
  
  const setScrollPosition = (position: ScrollPosition | null) => {
    scrollPosition.value = position
  }
  
  const markFileSaved = (filePath: string) => {
    modifiedFiles.value.delete(filePath)
    if (currentFile.value?.path === filePath) {
      originalContent.value = content.value
      isDirty.value = false
      lastSaved.value = new Date()
    }
  }
  
  const clearModifiedState = () => {
    modifiedFiles.value.clear()
    isDirty.value = false
  }
  
  const isFileModified = (filePath: string) => {
    return modifiedFiles.value.has(filePath)
  }
  
  const clearEditor = () => {
    content.value = ''
    originalContent.value = ''
    cursorPosition.value = null
    scrollPosition.value = null
    isDirty.value = false
    error.value = null
  }
  
  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }
  
  const clearError = () => {
    error.value = null
  }
  
  async function loadFile(file: FileInfo, fileOperationsService?: FileOperationsService) {
    if (!fileOperationsService) {
      setError('File operations service not available')
      return false
    }
    
    setLoading(true)
    setError(null)
    
    try {
      setCurrentFile(file)
      const fileContent = await fileOperationsService.readFile(file.path)
      setContent(fileContent)
      setOriginalContent(fileContent)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load file'
      setError(errorMessage)
      console.error('Failed to load file:', err)
      return false
    } finally {
      setLoading(false)
    }
  }
  
  async function saveFile(fileOperationsService?: FileOperationsService) {
    if (!fileOperationsService || !currentFile.value) {
      setError('Cannot save: No file selected or service unavailable')
      return false
    }
    
    if (!canSave.value) {
      return false
    }
    
    setLoading(true)
    setError(null)
    
    try {
      await fileOperationsService.saveFile(currentFile.value.path, content.value)
      markFileSaved(currentFile.value.path)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save file'
      setError(errorMessage)
      console.error('Failed to save file:', err)
      return false
    } finally {
      setLoading(false)
    }
  }
  
  async function optimizeContent(optimizationService?: any) {
    if (!optimizationService || !content.value) {
      setError('Cannot optimize: No content or service unavailable')
      return null
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const optimized = await optimizationService.optimize(content.value)
      return optimized
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to optimize content'
      setError(errorMessage)
      console.error('Failed to optimize content:', err)
      return null
    } finally {
      setLoading(false)
    }
  }
  
  function getModifiedFilesList(): string[] {
    return Array.from(modifiedFiles.value)
  }
  
  function hasModifiedFiles(): boolean {
    return modifiedFiles.value.size > 0
  }
  
  return {
    currentFile,
    content,
    originalContent,
    viewMode,
    isLoading,
    modifiedFiles,
    cursorPosition,
    scrollPosition,
    isDirty,
    lastSaved,
    error,
    hasUnsavedChanges,
    isCurrentFileModified,
    canSave,
    fileStatus,
    setCurrentFile,
    setContent,
    setOriginalContent,
    setViewMode,
    setLoading,
    setCursorPosition,
    setScrollPosition,
    markFileSaved,
    clearModifiedState,
    isFileModified,
    clearEditor,
    setError,
    clearError,
    loadFile,
    saveFile,
    optimizeContent,
    getModifiedFilesList,
    hasModifiedFiles
  }
})