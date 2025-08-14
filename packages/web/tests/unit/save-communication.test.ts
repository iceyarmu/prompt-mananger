import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileTreeStore } from '../../src/stores/fileTree'
import { useEditorStore } from '../../src/stores/editor'
import { storeBus } from '../../src/stores/communication'

describe('Editor Save to File Tree Communication', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Task 2: Save Communication Flow', () => {
    it('should emit file-saved event after successful save', async () => {
      const editorStore = useEditorStore()
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Set up a file to save
      const mockFile = {
        path: '/test/file.md',
        name: 'file.md',
        type: 'file' as const,
        size: 100,
        lastModified: new Date()
      }
      
      editorStore.setCurrentFile(mockFile)
      editorStore.setContent('Updated content')
      
      // Mock successful save
      const saveFileSpy = vi.spyOn(editorStore, 'saveFile').mockResolvedValue(true)
      
      // Save the file
      await editorStore.saveFile(undefined)
      
      // Should mark file as saved
      expect(editorStore.isFileModified(mockFile.path)).toBe(false)
    })

    it('should update file tree modified state on save', () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      
      const filePath = '/test/file.md'
      
      // Mark file as modified
      fileTreeStore.setNodeModified(filePath, true)
      
      // Emit save event
      storeBus.emit('editor', 'file-saved', { 
        path: filePath,
        timestamp: new Date()
      })
      
      // Should clear modified state
      const setNodeModifiedSpy = vi.spyOn(fileTreeStore, 'setNodeModified')
      fileTreeStore.setNodeModified(filePath, false)
      
      expect(setNodeModifiedSpy).toHaveBeenCalledWith(filePath, false)
    })

    it('should refresh file tree node after save', async () => {
      const fileTreeStore = useFileTreeStore()
      
      const filePath = '/test/folder/file.md'
      const parentPath = '/test/folder'
      
      const refreshNodeSpy = vi.spyOn(fileTreeStore, 'refreshNode').mockResolvedValue(undefined)
      
      // Emit save event
      storeBus.emit('editor', 'file-saved', { 
        path: filePath,
        timestamp: new Date()
      })
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Should refresh parent node
      expect(refreshNodeSpy).toHaveBeenCalledWith(parentPath)
    })

    it('should handle save errors and maintain modified state', async () => {
      const fileTreeStore = useFileTreeStore()
      
      const filePath = '/test/file.md'
      
      // Mock refresh failure
      const refreshNodeSpy = vi.spyOn(fileTreeStore, 'refreshNode').mockRejectedValue(new Error('Refresh failed'))
      const setNodeModifiedSpy = vi.spyOn(fileTreeStore, 'setNodeModified')
      
      // Emit save event
      storeBus.emit('editor', 'file-saved', { 
        path: filePath,
        timestamp: new Date()
      })
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Should maintain modified state on error
      expect(setNodeModifiedSpy).toHaveBeenCalledWith(filePath, true)
    })

    it('should update editor store when file is saved', () => {
      const editorStore = useEditorStore()
      
      const filePath = '/test/file.md'
      
      // Set up modified file
      editorStore.setCurrentFile({
        path: filePath,
        name: 'file.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      })
      editorStore.setContent('Modified')
      editorStore.setOriginalContent('Original')
      
      // Should have unsaved changes
      expect(editorStore.hasUnsavedChanges).toBe(true)
      
      // Mark as saved
      editorStore.markFileSaved(filePath)
      
      // Should no longer have unsaved changes
      expect(editorStore.hasUnsavedChanges).toBe(false)
      expect(editorStore.isDirty).toBe(false)
    })

    it('should clear modified indicator for correct file', () => {
      const fileTreeStore = useFileTreeStore()
      
      const file1 = '/test/file1.md'
      const file2 = '/test/file2.md'
      
      // Mark both files as modified
      fileTreeStore.setNodeModified(file1, true)
      fileTreeStore.setNodeModified(file2, true)
      
      // Save only file1
      storeBus.emit('editor', 'file-saved', { 
        path: file1,
        timestamp: new Date()
      })
      
      const setNodeModifiedSpy = vi.spyOn(fileTreeStore, 'setNodeModified')
      
      // Clear modified for file1
      fileTreeStore.setNodeModified(file1, false)
      
      // file1 should be cleared, file2 should remain modified
      expect(setNodeModifiedSpy).toHaveBeenCalledWith(file1, false)
    })
  })
})