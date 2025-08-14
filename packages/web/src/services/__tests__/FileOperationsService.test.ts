import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FileOperationsService } from '../FileOperationsService'
import type { WebDAVService } from '../WebDAVService'

describe('FileOperationsService', () => {
  let service: FileOperationsService
  let mockStorageService: any
  let mockWebDAVService: any

  beforeEach(() => {
    // Mock storage service
    mockStorageService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn().mockResolvedValue([])
    }

    // Mock WebDAV service
    mockWebDAVService = {
      getConnectionStatus: vi.fn().mockReturnValue({ connected: true }),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      deleteFile: vi.fn(),
      createDirectory: vi.fn(),
      fileExists: vi.fn(),
      getFileStat: vi.fn()
    } as unknown as WebDAVService

    service = new FileOperationsService(mockStorageService, mockWebDAVService)
  })

  describe('createFile', () => {
    it('should create a new file successfully', async () => {
      mockWebDAVService.fileExists = vi.fn().mockResolvedValue(false)
      mockWebDAVService.writeFile = vi.fn().mockResolvedValue(true)
      mockStorageService.set = vi.fn().mockResolvedValue(true)

      const result = await service.createFile('/test.md', '# Test')
      
      expect(result.success).toBe(true)
      expect(mockWebDAVService.writeFile).toHaveBeenCalledWith('/test.md', '# Test')
      expect(mockStorageService.set).toHaveBeenCalled()
    })

    it('should fail if file already exists', async () => {
      mockWebDAVService.fileExists = vi.fn().mockResolvedValue(true)
      mockStorageService.get = vi.fn().mockResolvedValue({ content: 'existing' })

      const result = await service.createFile('/test.md', '# Test')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('already exists')
    })
  })

  describe('createFolder', () => {
    it('should create a new folder successfully', async () => {
      mockWebDAVService.createDirectory = vi.fn().mockResolvedValue(true)
      mockStorageService.set = vi.fn().mockResolvedValue(true)

      const result = await service.createFolder('/newfolder')
      
      expect(result.success).toBe(true)
      expect(mockWebDAVService.createDirectory).toHaveBeenCalledWith('/newfolder')
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'file:/newfolder/.folder',
        expect.objectContaining({ isDirectory: true })
      )
    })

    it('should handle WebDAV failure gracefully', async () => {
      mockWebDAVService.createDirectory = vi.fn().mockRejectedValue(new Error('WebDAV error'))
      mockStorageService.set = vi.fn().mockResolvedValue(true)

      const result = await service.createFolder('/newfolder')
      
      expect(result.success).toBe(true) // Should succeed with local storage
      expect(result.message).toContain('Created in local storage')
    })
  })

  describe('copy', () => {
    it('should copy file to new location', async () => {
      const content = '# Source content'
      mockWebDAVService.readFile = vi.fn().mockResolvedValue(content)
      mockWebDAVService.writeFile = vi.fn().mockResolvedValue(true)
      mockStorageService.set = vi.fn().mockResolvedValue(true)

      const result = await service.copy('/source.md', '/dest.md')
      
      expect(result.success).toBe(true)
      expect(mockWebDAVService.writeFile).toHaveBeenCalledWith('/dest.md', content)
    })

    it('should handle read failure', async () => {
      mockWebDAVService.readFile = vi.fn().mockRejectedValue(new Error('Read failed'))
      mockStorageService.get = vi.fn().mockResolvedValue(null)

      const result = await service.copy('/source.md', '/dest.md')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to read source file')
    })
  })

  describe('duplicate', () => {
    it('should create duplicate with _copy suffix', async () => {
      const content = '# Original'
      mockWebDAVService.readFile = vi.fn().mockResolvedValue(content)
      mockWebDAVService.fileExists = vi.fn().mockResolvedValue(false)
      mockWebDAVService.writeFile = vi.fn().mockResolvedValue(true)
      mockStorageService.get = vi.fn().mockResolvedValue(null)
      mockStorageService.set = vi.fn().mockResolvedValue(true)

      const result = await service.duplicate('/file.md')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('_copy.md')
      expect(mockWebDAVService.writeFile).toHaveBeenCalledWith('/file_copy.md', content)
    })

    it('should increment counter if duplicate exists', async () => {
      const content = '# Original'
      mockWebDAVService.readFile = vi.fn().mockResolvedValue(content)
      mockWebDAVService.fileExists = vi.fn()
        .mockResolvedValueOnce(false) // Original exists check
        .mockResolvedValueOnce(true)  // file_copy.md exists
        .mockResolvedValueOnce(false) // file_copy_2.md doesn't exist
      mockWebDAVService.writeFile = vi.fn().mockResolvedValue(true)
      mockStorageService.get = vi.fn()
        .mockResolvedValueOnce({ content }) // Original file
        .mockResolvedValueOnce({ content: 'exists' }) // file_copy.md exists
        .mockResolvedValueOnce(null) // file_copy_2.md doesn't exist
      mockStorageService.set = vi.fn().mockResolvedValue(true)

      const result = await service.duplicate('/file.md')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('_copy_2.md')
    })
  })

  describe('rename', () => {
    it('should rename file successfully', async () => {
      const content = '# Content'
      mockWebDAVService.readFile = vi.fn().mockResolvedValue(content)
      mockWebDAVService.writeFile = vi.fn().mockResolvedValue(true)
      mockWebDAVService.deleteFile = vi.fn().mockResolvedValue(true)
      mockStorageService.set = vi.fn().mockResolvedValue(true)
      mockStorageService.delete = vi.fn().mockResolvedValue(true)

      const result = await service.rename('/old.md', '/new.md')
      
      expect(result.success).toBe(true)
      expect(mockWebDAVService.writeFile).toHaveBeenCalledWith('/new.md', content)
      expect(mockWebDAVService.deleteFile).toHaveBeenCalledWith('/old.md')
    })

    it('should rollback on delete failure', async () => {
      const content = '# Content'
      mockWebDAVService.readFile = vi.fn().mockResolvedValue(content)
      mockWebDAVService.writeFile = vi.fn().mockResolvedValue(true)
      mockWebDAVService.deleteFile = vi.fn()
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValue(true)
      mockStorageService.set = vi.fn().mockResolvedValue(true)
      mockStorageService.delete = vi.fn().mockResolvedValue(true)

      const result = await service.rename('/old.md', '/new.md')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to delete old file')
      expect(mockWebDAVService.deleteFile).toHaveBeenCalledTimes(2) // Original + rollback
    })
  })

  describe('exists', () => {
    it('should check WebDAV first', async () => {
      mockWebDAVService.fileExists = vi.fn().mockResolvedValue(true)

      const exists = await service.exists('/file.md')
      
      expect(exists).toBe(true)
      expect(mockWebDAVService.fileExists).toHaveBeenCalledWith('/file.md')
      expect(mockStorageService.get).not.toHaveBeenCalled()
    })

    it('should fallback to local storage', async () => {
      mockWebDAVService.fileExists = vi.fn().mockResolvedValue(false)
      mockStorageService.get = vi.fn().mockResolvedValue({ content: 'exists' })

      const exists = await service.exists('/file.md')
      
      expect(exists).toBe(true)
      expect(mockStorageService.get).toHaveBeenCalledWith('file:/file.md')
    })
  })

  describe('getMetadata', () => {
    it('should get metadata from WebDAV', async () => {
      const metadata = {
        size: 1024,
        lastModified: new Date(),
        isDirectory: false,
        contentType: 'text/markdown'
      }
      mockWebDAVService.getFileStat = vi.fn().mockResolvedValue(metadata)

      const result = await service.getMetadata('/file.md')
      
      expect(result.name).toBe('file.md')
      expect(result.path).toBe('/file.md')
      expect(result.size).toBe(1024)
      expect(mockWebDAVService.getFileStat).toHaveBeenCalledWith('/file.md')
    })

    it('should fallback to local storage metadata', async () => {
      mockWebDAVService.getFileStat = vi.fn().mockRejectedValue(new Error('Not found'))
      mockStorageService.get = vi.fn().mockResolvedValue({
        content: 'test',
        metadata: {
          name: 'file.md',
          path: '/file.md',
          size: 4,
          lastModified: new Date(),
          isDirectory: false
        }
      })

      const result = await service.getMetadata('/file.md')
      
      expect(result.name).toBe('file.md')
      expect(result.size).toBe(4)
    })
  })
})