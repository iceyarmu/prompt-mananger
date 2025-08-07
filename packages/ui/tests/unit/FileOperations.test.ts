import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useFileOperations } from '../../src/composables/useFileOperations'
import type { AppServices } from '../../src/types/services'

// Mock useToast
vi.mock('../../src/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

// Mock useFileTreeStore
vi.mock('../../src/composables/useFileTreeStore', () => ({
  useFileTreeStore: () => ({
    refreshNode: vi.fn()
  })
}))

describe('useFileOperations', () => {
  let mockServices: AppServices
  let fileOps: ReturnType<typeof useFileOperations>

  beforeEach(() => {
    // Create mock services
    mockServices = {
      webdavService: {
        putFile: vi.fn(),
        createFolder: vi.fn(),
        moveFile: vi.fn(),
        deleteFile: vi.fn(),
        deleteFolder: vi.fn(),
        listFolder: vi.fn(),
        getFile: vi.fn()
      }
    } as any

    // Initialize file operations
    fileOps = useFileOperations(ref(mockServices))
  })

  describe('createFile', () => {
    it('creates a file with .md extension', async () => {
      await fileOps.createFile('/test', 'newfile')

      expect(mockServices.webdavService.putFile).toHaveBeenCalledWith({
        path: '/test/newfile.md',
        content: '# newfile\n\n'
      })
    })

    it('does not duplicate .md extension', async () => {
      await fileOps.createFile('/test', 'newfile.md')

      expect(mockServices.webdavService.putFile).toHaveBeenCalledWith({
        path: '/test/newfile.md',
        content: '# newfile\n\n'
      })
    })

    it('handles root path correctly', async () => {
      await fileOps.createFile('/', 'rootfile')

      expect(mockServices.webdavService.putFile).toHaveBeenCalledWith({
        path: '/rootfile.md',
        content: '# rootfile\n\n'
      })
    })

    it('handles errors gracefully', async () => {
      const error = new Error('Network error')
      mockServices.webdavService.putFile = vi.fn().mockRejectedValue(error)

      await expect(fileOps.createFile('/test', 'newfile')).rejects.toThrow('Network error')
    })
  })

  describe('createFolder', () => {
    it('creates a folder at the specified path', async () => {
      await fileOps.createFolder('/parent', 'newfolder')

      expect(mockServices.webdavService.createFolder).toHaveBeenCalledWith(
        '/parent/newfolder',
        true
      )
    })

    it('handles root path correctly', async () => {
      await fileOps.createFolder('/', 'rootfolder')

      expect(mockServices.webdavService.createFolder).toHaveBeenCalledWith(
        '/rootfolder',
        true
      )
    })

    it('handles errors gracefully', async () => {
      const error = new Error('Permission denied')
      mockServices.webdavService.createFolder = vi.fn().mockRejectedValue(error)

      await expect(fileOps.createFolder('/test', 'newfolder')).rejects.toThrow('Permission denied')
    })
  })

  describe('renameItem', () => {
    it('renames a file and adds .md extension if missing', async () => {
      await fileOps.renameItem('/folder/oldfile.md', 'newfile')

      expect(mockServices.webdavService.moveFile).toHaveBeenCalledWith(
        '/folder/oldfile.md',
        '/folder/newfile.md'
      )
    })

    it('renames a folder without adding .md extension', async () => {
      await fileOps.renameItem('/parent/oldfolder', 'newfolder')

      expect(mockServices.webdavService.moveFile).toHaveBeenCalledWith(
        '/parent/oldfolder',
        '/parent/newfolder'
      )
    })

    it('preserves .md extension when renaming files', async () => {
      await fileOps.renameItem('/folder/oldfile.md', 'newfile.md')

      expect(mockServices.webdavService.moveFile).toHaveBeenCalledWith(
        '/folder/oldfile.md',
        '/folder/newfile.md'
      )
    })

    it('handles errors gracefully', async () => {
      const error = new Error('File already exists')
      mockServices.webdavService.moveFile = vi.fn().mockRejectedValue(error)

      await expect(fileOps.renameItem('/test.md', 'newname')).rejects.toThrow('File already exists')
    })
  })

  describe('deleteItem', () => {
    it('deletes a file and stores content for undo', async () => {
      mockServices.webdavService.listFolder = vi.fn().mockResolvedValue([
        { path: '/test.md', type: 'file', name: 'test.md' }
      ])
      mockServices.webdavService.getFile = vi.fn().mockResolvedValue({
        content: '# Test Content'
      })

      await fileOps.deleteItem('/test.md')

      expect(mockServices.webdavService.deleteFile).toHaveBeenCalledWith('/test.md')
      expect(fileOps.undoableOperations.value.size).toBe(1)
    })

    it('deletes a folder without storing content', async () => {
      mockServices.webdavService.listFolder = vi.fn().mockResolvedValue([
        { path: '/testfolder', type: 'directory', name: 'testfolder' }
      ])

      await fileOps.deleteItem('/testfolder')

      expect(mockServices.webdavService.deleteFolder).toHaveBeenCalledWith('/testfolder')
      expect(fileOps.undoableOperations.value.size).toBe(1)
    })

    it('handles errors gracefully', async () => {
      const error = new Error('Delete failed')
      mockServices.webdavService.listFolder = vi.fn().mockRejectedValue(error)

      await expect(fileOps.deleteItem('/test.md')).rejects.toThrow('Delete failed')
    })
  })

  describe('restoreItem', () => {
    it('restores a deleted file', async () => {
      // Setup undo operation
      const undoOp = {
        id: '123',
        type: 'delete' as const,
        path: '/test.md',
        content: '# Restored Content',
        isFolder: false,
        timestamp: Date.now()
      }
      fileOps.undoableOperations.value.set('123', undoOp)

      await fileOps.restoreItem('123')

      expect(mockServices.webdavService.putFile).toHaveBeenCalledWith({
        path: '/test.md',
        content: '# Restored Content'
      })
      expect(fileOps.undoableOperations.value.has('123')).toBe(false)
    })

    it('restores a deleted folder', async () => {
      // Setup undo operation
      const undoOp = {
        id: '456',
        type: 'delete' as const,
        path: '/testfolder',
        content: undefined,
        isFolder: true,
        timestamp: Date.now()
      }
      fileOps.undoableOperations.value.set('456', undoOp)

      await fileOps.restoreItem('456')

      expect(mockServices.webdavService.createFolder).toHaveBeenCalledWith('/testfolder', true)
      expect(fileOps.undoableOperations.value.has('456')).toBe(false)
    })

    it('does nothing if undo operation not found', async () => {
      await fileOps.restoreItem('nonexistent')

      expect(mockServices.webdavService.putFile).not.toHaveBeenCalled()
      expect(mockServices.webdavService.createFolder).not.toHaveBeenCalled()
    })
  })

  describe('copyPath', () => {
    it('copies path to clipboard', async () => {
      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      })

      await fileOps.copyPath('/test/file.md')

      expect(writeTextMock).toHaveBeenCalledWith('/test/file.md')
    })

    it('handles clipboard errors gracefully', async () => {
      // Mock clipboard API to throw error
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard access denied'))
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      })

      await expect(fileOps.copyPath('/test/file.md')).rejects.toThrow()
    })
  })

  describe('Loading State', () => {
    it('sets loading state during operations', async () => {
      expect(fileOps.loading.value).toBe(false)

      const promise = fileOps.createFile('/test', 'newfile')
      expect(fileOps.loading.value).toBe(true)

      await promise
      expect(fileOps.loading.value).toBe(false)
    })

    it('resets loading state on error', async () => {
      const error = new Error('Operation failed')
      mockServices.webdavService.putFile = vi.fn().mockRejectedValue(error)

      try {
        await fileOps.createFile('/test', 'newfile')
      } catch {
        // Expected error
      }

      expect(fileOps.loading.value).toBe(false)
    })
  })
})