import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebDAVService } from '../../../src/services/WebDAVService'
import type { WebDAVConfig } from '../../../src/types/application'

// Mock fetch globally
global.fetch = vi.fn()

describe('WebDAVService', () => {
  let service: WebDAVService
  let config: WebDAVConfig
  
  beforeEach(() => {
    config = {
      enabled: true,
      url: 'https://webdav.example.com',
      username: 'testuser',
      password: 'testpass'
    }
    
    service = new WebDAVService(config)
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('init', () => {
    it('should initialize connection successfully', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      
      await service.init()
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://webdav.example.com/',
        expect.objectContaining({
          method: 'OPTIONS',
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Basic /)
          })
        })
      )
      
      const status = service.getConnectionStatus()
      expect(status.connected).toBe(true)
      expect(status.url).toBe(config.url)
    })
    
    it('should handle connection failure', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })
      
      await expect(service.init()).rejects.toThrow('WebDAV server responded with status 401')
      
      const status = service.getConnectionStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('401')
    })
    
    it('should handle network error', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      await expect(service.init()).rejects.toThrow('Failed to connect to WebDAV server')
      
      const status = service.getConnectionStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('Network error')
    })
  })
  
  describe('checkHealth', () => {
    it('should return true when connection is healthy', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      
      const result = await service.checkHealth()
      
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://webdav.example.com/',
        expect.objectContaining({
          method: 'OPTIONS'
        })
      )
    })
    
    it('should return false when connection fails', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503
      })
      
      const result = await service.checkHealth()
      
      expect(result).toBe(false)
      const status = service.getConnectionStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('503')
    })
    
    it('should handle timeout', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockImplementationOnce(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100)
      }))
      
      const result = await service.checkHealth()
      
      expect(result).toBe(false)
    })
  })
  
  describe('file operations', () => {
    beforeEach(async () => {
      // Initialize service first
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      await service.init()
      vi.clearAllMocks()
    })
    
    describe('readFile', () => {
      it('should read file content successfully', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        const fileContent = 'test file content'
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => fileContent
        })
        
        const result = await service.readFile('/test.txt')
        
        expect(result).toBe(fileContent)
        expect(mockFetch).toHaveBeenCalledWith(
          'https://webdav.example.com/test.txt',
          expect.objectContaining({
            method: 'GET'
          })
        )
      })
      
      it('should throw error when file read fails', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
        
        await expect(service.readFile('/missing.txt')).rejects.toThrow('Failed to read file: 404 Not Found')
      })
    })
    
    describe('writeFile', () => {
      it('should write file content successfully', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201
        })
        
        await service.writeFile('/test.txt', 'new content')
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://webdav.example.com/test.txt',
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'text/plain'
            }),
            body: 'new content'
          })
        )
      })
      
      it('should handle 204 response for write', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204
        })
        
        await expect(service.writeFile('/test.txt', 'content')).resolves.toBeUndefined()
      })
    })
    
    describe('deleteFile', () => {
      it('should delete file successfully', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204
        })
        
        await service.deleteFile('/test.txt')
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://webdav.example.com/test.txt',
          expect.objectContaining({
            method: 'DELETE'
          })
        )
      })
    })
    
    describe('fileExists', () => {
      it('should return true when file exists', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        
        const result = await service.fileExists('/test.txt')
        
        expect(result).toBe(true)
        expect(mockFetch).toHaveBeenCalledWith(
          'https://webdav.example.com/test.txt',
          expect.objectContaining({
            method: 'HEAD'
          })
        )
      })
      
      it('should return false when file does not exist', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404
        })
        
        const result = await service.fileExists('/missing.txt')
        
        expect(result).toBe(false)
      })
    })
    
    describe('moveFile', () => {
      it('should move file successfully', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201
        })
        
        await service.moveFile('/old.txt', '/new.txt')
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://webdav.example.com/old.txt',
          expect.objectContaining({
            method: 'MOVE',
            headers: expect.objectContaining({
              'Destination': 'https://webdav.example.com/new.txt',
              'Overwrite': 'F'
            })
          })
        )
      })
    })
    
    describe('createDirectory', () => {
      it('should create directory successfully', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201
        })
        
        await service.createDirectory('/newdir')
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://webdav.example.com/newdir',
          expect.objectContaining({
            method: 'MKCOL'
          })
        )
      })
    })
  })
  
  describe('listFiles', () => {
    it('should parse PROPFIND response correctly', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      const xmlResponse = `<?xml version="1.0"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response>
            <d:href>/</d:href>
            <d:propstat>
              <d:prop>
                <d:resourcetype><d:collection/></d:resourcetype>
              </d:prop>
            </d:propstat>
          </d:response>
          <d:response>
            <d:href>/test.txt</d:href>
            <d:propstat>
              <d:prop>
                <d:displayname>test.txt</d:displayname>
                <d:getcontentlength>1234</d:getcontentlength>
                <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
                <d:getcontenttype>text/plain</d:getcontenttype>
                <d:resourcetype/>
              </d:prop>
            </d:propstat>
          </d:response>
        </d:multistatus>`
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 207,
        text: async () => xmlResponse
      })
      
      const files = await service.listFiles('/')
      
      expect(files).toHaveLength(1)
      expect(files[0]).toMatchObject({
        filename: 'test.txt',
        path: '/test.txt',
        size: 1234,
        isDirectory: false,
        contentType: 'text/plain'
      })
    })
  })
})