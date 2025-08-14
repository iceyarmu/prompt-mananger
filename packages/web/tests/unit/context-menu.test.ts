import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileTreeStore } from '../../src/stores/fileTree'
import { useEditorStore } from '../../src/stores/editor'
import { useAppStore } from '../../src/stores/app'
import { storeBus } from '../../src/stores/communication'

describe('Context Menu Operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Task 8: File Operations', () => {
    it('should create a new file', async () => {
      const fileTreeStore = useFileTreeStore()
      const createFileSpy = vi.spyOn(fileTreeStore, 'createFile').mockResolvedValue(true)
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const parentPath = '/test/folder'
      const fileName = 'newfile.md'
      
      await fileTreeStore.createFile(parentPath, fileName)
      
      expect(createFileSpy).toHaveBeenCalledWith(parentPath, fileName)
      
      // Simulate success event
      storeBus.emit('fileTree', 'file-created', { 
        path: `${parentPath}/${fileName}`,
        parentPath,
        fileName
      })
      
      expect(emitSpy).toHaveBeenCalledWith('fileTree', 'file-created', expect.any(Object))
    })

    it('should create a new folder', async () => {
      const fileTreeStore = useFileTreeStore()
      const createFolderSpy = vi.spyOn(fileTreeStore, 'createFolder').mockResolvedValue(true)
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const parentPath = '/test'
      const folderName = 'newfolder'
      
      await fileTreeStore.createFolder(parentPath, folderName)
      
      expect(createFolderSpy).toHaveBeenCalledWith(parentPath, folderName)
      
      // Simulate success event
      storeBus.emit('fileTree', 'folder-created', { 
        path: `${parentPath}/${folderName}`,
        parentPath,
        folderName
      })
      
      expect(emitSpy).toHaveBeenCalledWith('fileTree', 'folder-created', expect.any(Object))
    })

    it('should rename a node', async () => {
      const fileTreeStore = useFileTreeStore()
      const renameNodeSpy = vi.spyOn(fileTreeStore, 'renameNode').mockResolvedValue(true)
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const oldPath = '/test/oldfile.md'
      const newName = 'newfile.md'
      
      await fileTreeStore.renameNode(oldPath, newName)
      
      expect(renameNodeSpy).toHaveBeenCalledWith(oldPath, newName)
      
      // Simulate success event
      storeBus.emit('fileTree', 'node-renamed', { 
        oldPath,
        newPath: '/test/newfile.md',
        newName
      })
      
      expect(emitSpy).toHaveBeenCalledWith('fileTree', 'node-renamed', expect.any(Object))
    })

    it('should update editor state when renamed file is open', () => {
      const editorStore = useEditorStore()
      
      const oldPath = '/test/oldfile.md'
      const newPath = '/test/newfile.md'
      const newName = 'newfile.md'
      
      // Set current file
      editorStore.setCurrentFile({
        path: oldPath,
        name: 'oldfile.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      })
      
      // Update file path
      editorStore.updateFilePath(newPath, newName)
      
      expect(editorStore.currentFile?.path).toBe(newPath)
      expect(editorStore.currentFile?.name).toBe(newName)
    })

    it('should delete a node', async () => {
      const fileTreeStore = useFileTreeStore()
      const deleteNodeSpy = vi.spyOn(fileTreeStore, 'deleteNode').mockResolvedValue(true)
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const path = '/test/file.md'
      
      await fileTreeStore.deleteNode(path)
      
      expect(deleteNodeSpy).toHaveBeenCalledWith(path)
      
      // Simulate success event
      storeBus.emit('fileTree', 'node-deleted', { 
        path,
        parentPath: '/test'
      })
      
      expect(emitSpy).toHaveBeenCalledWith('fileTree', 'node-deleted', expect.any(Object))
    })

    it('should clear editor when deleted file is open', () => {
      const editorStore = useEditorStore()
      const fileTreeStore = useFileTreeStore()
      
      const filePath = '/test/file.md'
      
      // Set current file
      editorStore.setCurrentFile({
        path: filePath,
        name: 'file.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      })
      editorStore.setContent('File content')
      
      // Clear editor when file is deleted
      if (editorStore.currentFile?.path === filePath) {
        editorStore.clearEditor()
      }
      
      expect(editorStore.currentFile).toBeNull()
      expect(editorStore.content).toBe('')
    })

    it('should duplicate a node', async () => {
      const fileTreeStore = useFileTreeStore()
      const duplicateNodeSpy = vi.spyOn(fileTreeStore, 'duplicateNode').mockResolvedValue(true)
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      const originalPath = '/test/file.md'
      
      await fileTreeStore.duplicateNode(originalPath)
      
      expect(duplicateNodeSpy).toHaveBeenCalledWith(originalPath)
      
      // Simulate success event
      storeBus.emit('fileTree', 'node-duplicated', { 
        originalPath,
        duplicatePath: '/test/file_copy.md'
      })
      
      expect(emitSpy).toHaveBeenCalledWith('fileTree', 'node-duplicated', expect.any(Object))
    })

    it('should handle file operation errors', async () => {
      const fileTreeStore = useFileTreeStore()
      const emitSpy = vi.spyOn(storeBus, 'emit')
      
      // Mock failure
      vi.spyOn(fileTreeStore, 'createFile').mockResolvedValue(false)
      
      const result = await fileTreeStore.createFile('/test', 'newfile.md')
      
      expect(result).toBe(false)
      
      // Simulate error event
      storeBus.emit('fileTree', 'error', { 
        operation: 'create-file',
        error: 'Failed to create file'
      })
      
      expect(emitSpy).toHaveBeenCalledWith('fileTree', 'error', expect.any(Object))
    })

    it('should show loading state during operations', async () => {
      const appStore = useAppStore()
      const fileTreeStore = useFileTreeStore()
      
      const startLoadingSpy = vi.spyOn(appStore, 'startLoading')
      const stopLoadingSpy = vi.spyOn(appStore, 'stopLoading')
      
      // Mock successful operation
      vi.spyOn(fileTreeStore, 'deleteNode').mockResolvedValue(true)
      
      const loadingId = 'delete-node'
      
      // Start loading
      appStore.startLoading(loadingId, 'Deleting...')
      expect(startLoadingSpy).toHaveBeenCalledWith(loadingId, 'Deleting...')
      
      // Perform operation
      await fileTreeStore.deleteNode('/test/file.md')
      
      // Stop loading
      appStore.stopLoading(loadingId)
      expect(stopLoadingSpy).toHaveBeenCalledWith(loadingId)
    })

    it('should update modified files set when file path changes', () => {
      const editorStore = useEditorStore()
      
      const oldPath = '/test/oldfile.md'
      const newPath = '/test/newfile.md'
      
      // Set current file and mark as modified
      editorStore.setCurrentFile({
        path: oldPath,
        name: 'oldfile.md',
        type: 'file',
        size: 100,
        lastModified: new Date()
      })
      editorStore.setContent('Modified content')
      editorStore.setOriginalContent('Original content')
      
      // File should be marked as modified
      expect(editorStore.isFileModified(oldPath)).toBe(true)
      
      // Update file path
      editorStore.updateFilePath(newPath, 'newfile.md')
      
      // Modified status should transfer to new path
      expect(editorStore.isFileModified(newPath)).toBe(true)
      expect(editorStore.isFileModified(oldPath)).toBe(false)
    })
  })
})