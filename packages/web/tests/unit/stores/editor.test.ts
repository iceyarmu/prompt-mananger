import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorStore } from '../../../src/stores/editor'

const mockFileInfo = {
  path: '/test.md',
  name: 'test.md',
  type: 'file' as const,
  size: 100,
  lastModified: new Date()
}

const mockFileOperationsService = {
  readFile: vi.fn().mockResolvedValue('File content'),
  saveFile: vi.fn().mockResolvedValue(undefined)
}

describe('Editor Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const store = useEditorStore()
    
    expect(store.currentFile).toBe(null)
    expect(store.content).toBe('')
    expect(store.originalContent).toBe('')
    expect(store.viewMode).toBe('edit')
    expect(store.isLoading).toBe(false)
    expect(store.modifiedFiles.size).toBe(0)
    expect(store.cursorPosition).toBe(null)
    expect(store.scrollPosition).toBe(null)
    expect(store.isDirty).toBe(false)
    expect(store.lastSaved).toBe(null)
    expect(store.error).toBe(null)
    expect(store.hasUnsavedChanges).toBe(false)
    expect(store.canSave).toBe(false)
  })

  it('should set current file', () => {
    const store = useEditorStore()
    
    store.setCurrentFile(mockFileInfo)
    expect(store.currentFile).toEqual(mockFileInfo)
    
    store.setCurrentFile(null)
    expect(store.currentFile).toBe(null)
    expect(store.content).toBe('')
    expect(store.originalContent).toBe('')
  })

  it('should track content changes', () => {
    const store = useEditorStore()
    store.setCurrentFile(mockFileInfo)
    store.setOriginalContent('Original content')
    
    expect(store.hasUnsavedChanges).toBe(false)
    
    store.setContent('Modified content')
    expect(store.content).toBe('Modified content')
    expect(store.hasUnsavedChanges).toBe(true)
    expect(store.isDirty).toBe(true)
    expect(store.isCurrentFileModified).toBe(true)
    expect(store.modifiedFiles.has('/test.md')).toBe(true)
    
    store.setContent('Original content')
    expect(store.hasUnsavedChanges).toBe(false)
    expect(store.isCurrentFileModified).toBe(false)
    expect(store.modifiedFiles.has('/test.md')).toBe(false)
  })

  it('should manage view mode', () => {
    const store = useEditorStore()
    
    expect(store.viewMode).toBe('edit')
    
    store.setViewMode('preview')
    expect(store.viewMode).toBe('preview')
    
    store.setViewMode('split')
    expect(store.viewMode).toBe('split')
  })

  it('should track cursor and scroll positions', () => {
    const store = useEditorStore()
    
    const cursorPos = { line: 10, column: 5 }
    const scrollPos = { top: 100, left: 0 }
    
    store.setCursorPosition(cursorPos)
    expect(store.cursorPosition).toEqual(cursorPos)
    
    store.setScrollPosition(scrollPos)
    expect(store.scrollPosition).toEqual(scrollPos)
  })

  it('should mark file as saved', () => {
    const store = useEditorStore()
    store.setCurrentFile(mockFileInfo)
    store.setOriginalContent('Original')
    store.setContent('Modified')
    
    expect(store.hasUnsavedChanges).toBe(true)
    expect(store.modifiedFiles.has('/test.md')).toBe(true)
    
    store.markFileSaved('/test.md')
    
    expect(store.originalContent).toBe('Modified')
    expect(store.hasUnsavedChanges).toBe(false)
    expect(store.isDirty).toBe(false)
    expect(store.lastSaved).toBeInstanceOf(Date)
    expect(store.modifiedFiles.has('/test.md')).toBe(false)
  })

  it('should load file content', async () => {
    const store = useEditorStore()
    
    const result = await store.loadFile(mockFileInfo, mockFileOperationsService as any)
    
    expect(result).toBe(true)
    expect(mockFileOperationsService.readFile).toHaveBeenCalledWith('/test.md')
    expect(store.currentFile).toEqual(mockFileInfo)
    expect(store.content).toBe('File content')
    expect(store.originalContent).toBe('File content')
    expect(store.error).toBe(null)
    expect(store.isLoading).toBe(false)
  })

  it('should handle file load errors', async () => {
    const store = useEditorStore()
    const failingService = {
      readFile: vi.fn().mockRejectedValue(new Error('Read failed'))
    }
    
    const result = await store.loadFile(mockFileInfo, failingService as any)
    
    expect(result).toBe(false)
    expect(store.error).toBe('Read failed')
    expect(store.isLoading).toBe(false)
  })

  it('should save file content', async () => {
    const store = useEditorStore()
    store.setCurrentFile(mockFileInfo)
    store.setOriginalContent('Original')
    store.setContent('Modified content')
    
    const result = await store.saveFile(mockFileOperationsService as any)
    
    expect(result).toBe(true)
    expect(mockFileOperationsService.saveFile).toHaveBeenCalledWith('/test.md', 'Modified content')
    expect(store.originalContent).toBe('Modified content')
    expect(store.hasUnsavedChanges).toBe(false)
    expect(store.error).toBe(null)
    expect(store.isLoading).toBe(false)
  })

  it('should handle save errors', async () => {
    const store = useEditorStore()
    store.setCurrentFile(mockFileInfo)
    store.setContent('Modified content')
    
    const failingService = {
      saveFile: vi.fn().mockRejectedValue(new Error('Save failed'))
    }
    
    const result = await store.saveFile(failingService as any)
    
    expect(result).toBe(false)
    expect(store.error).toBe('Save failed')
    expect(store.isLoading).toBe(false)
  })

  it('should track multiple modified files', () => {
    const store = useEditorStore()
    
    store.setCurrentFile({ ...mockFileInfo, path: '/file1.md' })
    store.setContent('Modified 1')
    
    store.setCurrentFile({ ...mockFileInfo, path: '/file2.md' })
    store.setContent('Modified 2')
    
    expect(store.hasModifiedFiles()).toBe(true)
    expect(store.getModifiedFilesList()).toContain('/file1.md')
    expect(store.getModifiedFilesList()).toContain('/file2.md')
    expect(store.getModifiedFilesList()).toHaveLength(2)
    
    store.clearModifiedState()
    expect(store.hasModifiedFiles()).toBe(false)
    expect(store.getModifiedFilesList()).toHaveLength(0)
  })

  it('should compute file status correctly', () => {
    const store = useEditorStore()
    
    expect(store.fileStatus).toBe('saved')
    
    store.setLoading(true)
    expect(store.fileStatus).toBe('loading')
    store.setLoading(false)
    
    store.setError('Some error')
    expect(store.fileStatus).toBe('error')
    store.clearError()
    
    store.setCurrentFile(mockFileInfo)
    store.setOriginalContent('Original')
    store.setContent('Modified')
    expect(store.fileStatus).toBe('modified')
  })

  it('should check if save is allowed', () => {
    const store = useEditorStore()
    
    expect(store.canSave).toBe(false)
    
    store.setCurrentFile(mockFileInfo)
    expect(store.canSave).toBe(false)
    
    store.setOriginalContent('Original')
    store.setContent('Modified')
    expect(store.canSave).toBe(true)
    
    store.setLoading(true)
    expect(store.canSave).toBe(false)
  })
})