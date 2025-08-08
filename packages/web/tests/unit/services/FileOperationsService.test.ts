import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileOperationsService } from '../../../src/services/FileOperationsService'
import { WebDAVService } from '../../../src/services/WebDAVService'
import type { WebDAVConfig } from '../../../src/types/application'

// Mock WebDAVService
vi.mock('../../../src/services/WebDAVService')

describe('FileOperationsService', () => {
  let service: FileOperationsService
  let mockStorageService: any
  let mockWebDAVService: WebDAVService
  
  beforeEach(() => {
    // Mock storage service
    mockStorageService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn().mockResolvedValue([])
    }
    
    // Mock WebDAV service
    mockWebDAVService = new WebDAVService({
      enabled: true,
      url: 'https://webdav.example.com',
      username: 'test',
      password: 'test'
    })
    
    // Setup WebDAV mock methods
    mockWebDAVService.getConnectionStatus = vi.fn().mockReturnValue({
      connected: true,
      url: 'https://webdav.example.com',
      lastChecked: new Date()
    })
    mockWebDAVService.readFile = vi.fn()
    mockWebDAVService.writeFile = vi.fn()
    mockWebDAVService.deleteFile = vi.fn()
    mockWebDAVService.listFiles = vi.fn()
    mockWebDAVService.fileExists = vi.fn()
    mockWebDAVService.checkHealth = vi.fn()
    
    service = new FileOperationsService(mockStorageService, mockWebDAVService)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('read', () => {
    it('should read from WebDAV when connected', async () => {
      const content = 'test content'
      ;(mockWebDAVService.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(content)
      
      const result = await service.read('/test.txt')
      
      expect(result.content).toBe(content)
      expect(result.path).toBe('/test.txt')
      expect(mockWebDAVService.readFile).toHaveBeenCalledWith('/test.txt')
      expect(mockStorageService.get).not.toHaveBeenCalled()
    })
    
    it('should fallback to local storage when WebDAV fails', async () => {
      const localContent = 'local content'
      ;(mockWebDAVService.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('WebDAV error'))
      mockStorageService.get.mockResolvedValueOnce({
        content: localContent,
        metadata: {
          name: 'test.txt',
          path: '/test.txt',
          size: localContent.length,
          lastModified: new Date(),
          isDirectory: false
        }
      })
      
      const result = await service.read('/test.txt')
      
      expect(result.content).toBe(localContent)
      expect(mockStorageService.get).toHaveBeenCalledWith('file:/test.txt')
    })
    
    it('should read from local storage when WebDAV is not available', async () => {
      const serviceWithoutWebDAV = new FileOperationsService(mockStorageService)
      const localContent = 'local content'
      mockStorageService.get.mockResolvedValueOnce({
        content: localContent
      })
      
      const result = await serviceWithoutWebDAV.read('/test.txt')
      
      expect(result.content).toBe(localContent)
      expect(mockStorageService.get).toHaveBeenCalledWith('file:/test.txt')
    })
    
    it('should throw error when file not found in local storage', async () => {
      const serviceWithoutWebDAV = new FileOperationsService(mockStorageService)
      mockStorageService.get.mockResolvedValueOnce(null)
      
      await expect(serviceWithoutWebDAV.read('/missing.txt')).rejects.toThrow('File not found: /missing.txt')
    })
  })
  
  describe('write', () => {
    it('should write to both WebDAV and local storage', async () => {
      const content = 'new content'
      ;(mockWebDAVService.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.set.mockResolvedValueOnce(undefined)
      
      const result = await service.write('/test.txt', content)
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Written to WebDAV')
      expect(result.message).toContain('Written to local storage')
      expect(mockWebDAVService.writeFile).toHaveBeenCalledWith('/test.txt', content)
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'file:/test.txt',
        expect.objectContaining({ content })
      )
    })
    
    it('should succeed if local storage write succeeds even when WebDAV fails', async () => {
      const content = 'new content'
      ;(mockWebDAVService.writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('WebDAV error'))
      mockStorageService.set.mockResolvedValueOnce(undefined)
      
      const result = await service.write('/test.txt', content)
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('WebDAV write failed')
      expect(result.message).toContain('Written to local storage')
    })
    
    it('should write only to local storage when WebDAV is not available', async () => {
      const serviceWithoutWebDAV = new FileOperationsService(mockStorageService)
      const content = 'new content'
      mockStorageService.set.mockResolvedValueOnce(undefined)
      
      const result = await serviceWithoutWebDAV.write('/test.txt', content)
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Written to local storage')
      expect(mockStorageService.set).toHaveBeenCalled()
    })
  })
  
  describe('delete', () => {
    it('should delete from both WebDAV and local storage', async () => {
      ;(mockWebDAVService.deleteFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      
      const result = await service.delete('/test.txt')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Deleted from WebDAV')
      expect(result.message).toContain('Deleted from local storage')
      expect(mockWebDAVService.deleteFile).toHaveBeenCalledWith('/test.txt')
      expect(mockStorageService.delete).toHaveBeenCalledWith('file:/test.txt')
    })
    
    it('should succeed if local storage delete succeeds even when WebDAV fails', async () => {
      ;(mockWebDAVService.deleteFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('WebDAV error'))
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      
      const result = await service.delete('/test.txt')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('WebDAV delete failed')
      expect(result.message).toContain('Deleted from local storage')
    })
  })
  
  describe('rename', () => {
    it('should rename file by copying and deleting', async () => {
      const content = 'file content'
      
      // Mock read
      ;(mockWebDAVService.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(content)
      
      // Mock write
      ;(mockWebDAVService.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.set.mockResolvedValueOnce(undefined)
      
      // Mock delete
      ;(mockWebDAVService.deleteFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      
      const result = await service.rename('/old.txt', '/new.txt')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('renamed from /old.txt to /new.txt')
    })
    
    it('should rollback new file if delete of old file fails', async () => {
      const content = 'file content'
      
      // Mock read
      ;(mockWebDAVService.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(content)
      
      // Mock write success
      ;(mockWebDAVService.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.set.mockResolvedValueOnce(undefined)
      
      // Mock delete failure
      ;(mockWebDAVService.deleteFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed'))
      mockStorageService.delete.mockRejectedValueOnce(new Error('Delete failed'))
      
      // Mock rollback delete
      ;(mockWebDAVService.deleteFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      
      const result = await service.rename('/old.txt', '/new.txt')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to delete old file after copy')
    })
  })
  
  describe('list', () => {
    it('should list files from WebDAV when connected', async () => {
      const files = [
        {
          filename: 'test1.txt',
          path: '/test1.txt',
          size: 100,
          lastModified: new Date(),
          isDirectory: false,
          contentType: 'text/plain'
        },
        {
          filename: 'test2.txt',
          path: '/test2.txt',
          size: 200,
          lastModified: new Date(),
          isDirectory: false,
          contentType: 'text/plain'
        }
      ]
      ;(mockWebDAVService.listFiles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(files)
      
      const result = await service.list('/')
      
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('test1.txt')
      expect(result[1].name).toBe('test2.txt')
      expect(mockWebDAVService.listFiles).toHaveBeenCalledWith('/')
    })
    
    it('should fallback to local storage when WebDAV fails', async () => {
      ;(mockWebDAVService.listFiles as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('WebDAV error'))
      mockStorageService.keys.mockResolvedValueOnce(['file:/test.txt'])
      mockStorageService.get.mockResolvedValueOnce({
        metadata: {
          name: 'test.txt',
          path: '/test.txt',
          size: 100,
          lastModified: new Date(),
          isDirectory: false
        }
      })
      
      const result = await service.list('/')
      
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('test.txt')
      expect(mockStorageService.keys).toHaveBeenCalled()
    })
  })
  
  describe('exists', () => {
    it('should check WebDAV first when connected', async () => {
      ;(mockWebDAVService.fileExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
      
      const result = await service.exists('/test.txt')
      
      expect(result).toBe(true)
      expect(mockWebDAVService.fileExists).toHaveBeenCalledWith('/test.txt')
      expect(mockStorageService.get).not.toHaveBeenCalled()
    })
    
    it('should check local storage when file not found in WebDAV', async () => {
      ;(mockWebDAVService.fileExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)
      mockStorageService.get.mockResolvedValueOnce({ content: 'test' })
      
      const result = await service.exists('/test.txt')
      
      expect(result).toBe(true)
      expect(mockWebDAVService.fileExists).toHaveBeenCalled()
      expect(mockStorageService.get).toHaveBeenCalledWith('file:/test.txt')
    })
    
    it('should return false when file not found anywhere', async () => {
      ;(mockWebDAVService.fileExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)
      mockStorageService.get.mockResolvedValueOnce(null)
      
      const result = await service.exists('/test.txt')
      
      expect(result).toBe(false)
    })
  })
  
  describe('checkHealth', () => {
    it('should check both local storage and WebDAV health', async () => {
      mockStorageService.set.mockResolvedValueOnce(undefined)
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      ;(mockWebDAVService.checkHealth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
      
      const result = await service.checkHealth()
      
      expect(result).toBe(true)
      expect(mockStorageService.set).toHaveBeenCalledWith('file:health-check', 'test')
      expect(mockStorageService.delete).toHaveBeenCalledWith('file:health-check')
      expect(mockWebDAVService.checkHealth).toHaveBeenCalled()
    })
    
    it('should return true even if WebDAV is unhealthy', async () => {
      mockStorageService.set.mockResolvedValueOnce(undefined)
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      ;(mockWebDAVService.checkHealth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)
      
      const result = await service.checkHealth()
      
      expect(result).toBe(true)
    })
    
    it('should return false if local storage check fails', async () => {
      mockStorageService.set.mockRejectedValueOnce(new Error('Storage error'))
      
      const result = await service.checkHealth()
      
      expect(result).toBe(false)
    })
  })
  
  describe('move', () => {
    it('should be an alias for rename', async () => {
      const content = 'file content'
      
      // Mock for rename operation
      ;(mockWebDAVService.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(content)
      ;(mockWebDAVService.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.set.mockResolvedValueOnce(undefined)
      ;(mockWebDAVService.deleteFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      mockStorageService.delete.mockResolvedValueOnce(undefined)
      
      const result = await service.move('/source.txt', '/destination.txt')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('renamed from /source.txt to /destination.txt')
    })
  })
})