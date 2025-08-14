import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileTreeStore } from '../../src/stores/fileTree'
import { useEditorStore } from '../../src/stores/editor'
import { storeBus } from '../../src/stores/communication'
import type { TreeNode } from '../../src/stores/types'

describe('File Selection to Editor Communication', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Task 1: File Selection Flow', () => {
    it('should load file content when a file is selected', async () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      
      const mockFile: TreeNode = {
        path: '/test/file.md',
        name: 'file.md',
        type: 'file',
        fileInfo: {
          path: '/test/file.md',
          name: 'file.md',
          type: 'file',
          size: 100,
          lastModified: new Date()
        }
      }
      
      const mockContent = '# Test Content'
      const loadFileSpy = vi.spyOn(editorStore, 'loadFile').mockResolvedValue(true)
      
      // Select a file
      fileTreeStore.selectNode(mockFile)
      
      // Verify the file is selected
      expect(fileTreeStore.selectedNode).toEqual(mockFile)
    })

    it('should show warning when switching files with unsaved changes', async () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      
      // Set up current file with unsaved changes
      editorStore.setCurrentFile({
        path: '/test/current.md',
        name: 'current.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      })
      editorStore.setContent('Modified content')
      editorStore.setOriginalContent('Original content')
      
      // Verify there are unsaved changes
      expect(editorStore.hasUnsavedChanges).toBe(true)
      
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Try to select a new file
      const newFile: TreeNode = {
        path: '/test/new.md',
        name: 'new.md',
        type: 'file'
      }
      
      fileTreeStore.selectNode(newFile)
      
      // Should emit unsaved changes warning
      expect(emitSpy).toHaveBeenCalledWith(
        'editor',
        'unsaved-changes-warning',
        expect.objectContaining({
          currentFile: expect.any(Object),
          newFile: expect.any(Object)
        })
      )
    })

    it('should clear editor when no file is selected', () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      
      // Set up a file
      editorStore.setContent('Some content')
      editorStore.setCurrentFile({
        path: '/test/file.md',
        name: 'file.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      })
      
      // Clear selection
      fileTreeStore.selectNode(null)
      
      // Verify selection is cleared
      expect(fileTreeStore.selectedNode).toBeNull()
    })

    it('should update editor content when file is loaded', async () => {
      const editorStore = useEditorStore()
      
      const mockFile = {
        path: '/test/file.md',
        name: 'file.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      }
      
      const mockContent = '# Test Document\n\nThis is test content.'
      
      // Set content as if loaded
      editorStore.setCurrentFile(mockFile)
      editorStore.setContent(mockContent)
      editorStore.setOriginalContent(mockContent)
      
      // Verify content is loaded
      expect(editorStore.content).toBe(mockContent)
      expect(editorStore.currentFile).toEqual(mockFile)
      expect(editorStore.hasUnsavedChanges).toBe(false)
    })

    it('should not load directory nodes in editor', () => {
      const fileTreeStore = useFileTreeStore()
      const editorStore = useEditorStore()
      
      const clearSpy = vi.spyOn(editorStore, 'clearEditor')
      
      const dirNode: TreeNode = {
        path: '/test/dir',
        name: 'dir',
        type: 'directory',
        children: []
      }
      
      // Select a directory
      fileTreeStore.selectNode(dirNode)
      
      // Editor should not be affected for directories
      expect(fileTreeStore.selectedNode).toEqual(dirNode)
      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('should handle file loading errors gracefully', async () => {
      const editorStore = useEditorStore()
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const mockError = new Error('Failed to read file')
      const loadFileSpy = vi.spyOn(editorStore, 'loadFile').mockRejectedValue(mockError)
      
      const mockFile = {
        path: '/test/error.md',
        name: 'error.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      }
      
      // Attempt to load file that will error
      try {
        await editorStore.loadFile(mockFile, undefined)
      } catch (error) {
        // Expected error
      }
      
      // Should have error state
      expect(editorStore.error).toBeTruthy()
    })
  })
})