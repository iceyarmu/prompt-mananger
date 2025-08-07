/**
 * WebDAV Service Unit Tests - Simplified Version
 * Following the test pattern from packages/core tests
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Import from the built module to avoid ES module issues
const mockClient = {
  stat: vi.fn(),
  getFileContents: vi.fn(),
  putFileContents: vi.fn(),
  deleteFile: vi.fn(),
  moveFile: vi.fn(),
  getDirectoryContents: vi.fn(),
  createDirectory: vi.fn()
};

// Mock the webdav module before importing anything else
vi.mock('webdav', () => ({
  createClient: vi.fn(() => mockClient)
}));

// Now import our service after mocking
import { WebDAVService } from '../../src/service';
import { WebDAVError, WebDAVErrorCode, WebDAVConfigError } from '../../src/errors';
import { WebDAVConfig, FileContent } from '../../src/types';

describe('WebDAVService', () => {
  let service: WebDAVService;

  const validConfig: WebDAVConfig = {
    url: 'https://webdav.example.com',
    username: 'testuser',
    password: 'testpass',
    authType: 'basic',
    timeout: 30000,
    maxConnections: 5
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset mock responses to default successful responses
    mockClient.stat.mockResolvedValue({ type: 'directory' });
    mockClient.getFileContents.mockResolvedValue('test content');
    mockClient.putFileContents.mockResolvedValue(undefined);
    mockClient.deleteFile.mockResolvedValue(undefined);
    mockClient.moveFile.mockResolvedValue(undefined);
    mockClient.getDirectoryContents.mockResolvedValue([]);
    mockClient.createDirectory.mockResolvedValue(undefined);

    service = new WebDAVService();
  });

  describe('Constructor and Dependencies', () => {
    it('should create service instance without errors', () => {
      expect(service).toBeInstanceOf(WebDAVService);
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for missing config', async () => {
      await expect(service.connect(null as any)).rejects.toThrow(WebDAVConfigError);
    });

    it('should throw error for missing URL', async () => {
      const invalidConfig = { ...validConfig, url: '' };
      await expect(service.connect(invalidConfig)).rejects.toThrow('Valid URL is required');
    });

    it('should throw error for invalid URL protocol', async () => {
      const invalidConfig = { ...validConfig, url: 'ftp://example.com' };
      await expect(service.connect(invalidConfig)).rejects.toThrow('URL must start with http:// or https://');
    });

    it('should throw error for missing username with basic auth', async () => {
      const invalidConfig = { ...validConfig, username: '', authType: 'basic' as const };
      await expect(service.connect(invalidConfig)).rejects.toThrow('Username is required for authentication');
    });

    it('should throw error for invalid timeout', async () => {
      const invalidConfig = { ...validConfig, timeout: 500 };
      await expect(service.connect(invalidConfig)).rejects.toThrow('Timeout must be between 1000 and 120000 milliseconds');
    });
  });

  describe('Path Validation', () => {
    beforeEach(async () => {
      // Connect first
      mockClient.stat.mockResolvedValue({ type: 'directory' });
      await service.connect(validConfig);
    });

    it('should throw error for empty path', async () => {
      await expect(service.getFile('')).rejects.toThrow('Path is required and must be a string');
    });

    it('should throw error for path with directory traversal', async () => {
      await expect(service.getFile('/path/../sensitive')).rejects.toThrow('Path contains invalid characters');
    });

    it('should throw error for path not starting with forward slash', async () => {
      await expect(service.getFile('relative/path')).rejects.toThrow('Path must start with forward slash');
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid config', async () => {
      mockClient.stat.mockResolvedValue({ type: 'directory' });
      
      const result = await service.connect(validConfig);
      
      expect(result).toBe(true);
      expect(service.isConnected()).toBe(true);
      expect(mockClient.stat).toHaveBeenCalledWith('/');
    });

    it('should handle connection failure', async () => {
      mockClient.stat.mockRejectedValue(new Error('Connection failed'));
      
      await expect(service.connect(validConfig)).rejects.toThrow();
      expect(service.isConnected()).toBe(false);
    });

    it('should disconnect successfully', async () => {
      // Connect first
      await service.connect(validConfig);
      expect(service.isConnected()).toBe(true);
      
      // Then disconnect
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should test connection successfully', async () => {
      // Mock with delay to ensure responseTime > 0
      mockClient.stat.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ type: 'directory' }), 10))
      );
      
      const result = await service.testConnection(validConfig, 5000);
      
      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.serverInfo).toContain('WebDAV server responding');
    });

    it('should handle test connection failure', async () => {
      mockClient.stat.mockRejectedValue(new Error('Connection timeout'));
      
      const result = await service.testConnection(validConfig, 5000);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      // Connect before each test
      mockClient.stat.mockResolvedValue({ type: 'directory' });
      await service.connect(validConfig);
    });

    describe('getFile', () => {
      it('should get file successfully', async () => {
        const mockContent = 'file content';
        const mockStat = {
          basename: 'test.md',
          filename: '/test.md',
          mime: 'text/markdown'
        };
        
        mockClient.getFileContents.mockResolvedValue(mockContent);
        mockClient.stat.mockImplementation((path) => {
          if (path === '/test.md') return Promise.resolve(mockStat);
          return Promise.resolve({ type: 'directory' });
        });
        
        const result = await service.getFile('/test.md');
        
        expect(result).toEqual({
          path: '/test.md',
          content: mockContent,
          encoding: 'utf8',
          mimeType: 'text/markdown'
        });
        expect(mockClient.getFileContents).toHaveBeenCalledWith('/test.md', { format: 'text' });
      });

      it('should throw error when not connected', async () => {
        await service.disconnect();
        
        await expect(service.getFile('/test.md')).rejects.toThrow('Service not connected');
      });
    });

    describe('putFile', () => {
      it('should put file successfully', async () => {
        const fileContent: FileContent = {
          path: '/test.md',
          content: 'test content',
          mimeType: 'text/markdown'
        };
        
        mockClient.putFileContents.mockResolvedValue(undefined);
        
        await service.putFile(fileContent);
        
        expect(mockClient.putFileContents).toHaveBeenCalledWith(
          '/test.md',
          'test content',
          { headers: { 'Content-Type': 'text/markdown' } }
        );
      });

      it('should throw error for empty content', async () => {
        const fileContent: FileContent = {
          path: '/test.md',
          content: ''
        };
        
        await expect(service.putFile(fileContent)).rejects.toThrow('File content is required');
      });
    });

    describe('deleteFile', () => {
      it('should delete file successfully', async () => {
        // Mock file exists and is a file
        mockClient.stat.mockImplementation((path) => {
          if (path === '/test.md') return Promise.resolve({ type: 'file' });
          return Promise.resolve({ type: 'directory' });
        });
        
        await service.deleteFile('/test.md');
        
        expect(mockClient.deleteFile).toHaveBeenCalledWith('/test.md');
      });

      it('should throw error if file does not exist', async () => {
        mockClient.stat.mockRejectedValue({ status: 404 });
        
        await expect(service.deleteFile('/nonexistent.md')).rejects.toThrow();
      });
    });
  });

  describe('Folder Operations', () => {
    beforeEach(async () => {
      mockClient.stat.mockResolvedValue({ type: 'directory' });
      await service.connect(validConfig);
    });

    describe('listFolder', () => {
      it('should list folder contents successfully', async () => {
        const mockContents = [
          {
            basename: 'file1.md',
            filename: '/folder/file1.md',
            type: 'file',
            size: 100,
            lastmod: '2023-01-01',
            etag: 'etag1',
            mime: 'text/markdown'
          },
          {
            basename: 'subfolder',
            filename: '/folder/subfolder',
            type: 'directory',
            size: 0,
            lastmod: '2023-01-01'
          }
        ];
        
        mockClient.getDirectoryContents.mockResolvedValue(mockContents);
        
        const result = await service.listFolder('/folder');
        
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('file1.md');
        expect(result[0].type).toBe('file');
        expect(result[1].name).toBe('subfolder');
        expect(result[1].type).toBe('directory');
      });
    });

    describe('createFolder', () => {
      it('should create folder successfully', async () => {
        mockClient.stat.mockRejectedValue({ status: 404 }); // folder doesn't exist
        mockClient.createDirectory.mockResolvedValue(undefined);
        
        await service.createFolder('/newfolder');
        
        expect(mockClient.createDirectory).toHaveBeenCalledWith('/newfolder', { recursive: true });
      });

      it('should not error if folder already exists', async () => {
        mockClient.stat.mockResolvedValue({ type: 'directory' });
        
        await expect(service.createFolder('/existing')).resolves.not.toThrow();
        expect(mockClient.createDirectory).not.toHaveBeenCalled();
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      mockClient.stat.mockResolvedValue({ type: 'directory' });
      await service.connect(validConfig);
    });

    describe('exists', () => {
      it('should return true if path exists', async () => {
        mockClient.stat.mockImplementation((path) => {
          if (path === '/test.md') return Promise.resolve({ type: 'file' });
          return Promise.resolve({ type: 'directory' });
        });
        
        const result = await service.exists('/test.md');
        expect(result).toBe(true);
      });

      it('should return false if path does not exist', async () => {
        mockClient.stat.mockImplementation((path) => {
          if (path === '/nonexistent.md') return Promise.reject({ status: 404 });
          return Promise.resolve({ type: 'directory' });
        });
        
        const result = await service.exists('/nonexistent.md');
        expect(result).toBe(false);
      });
    });

    describe('getFileInfo', () => {
      it('should get file info successfully', async () => {
        const mockStat = {
          basename: 'test.md',
          filename: '/test.md',
          type: 'file',
          size: 100,
          lastmod: '2023-01-01',
          etag: 'etag123',
          mime: 'text/markdown'
        };
        
        mockClient.stat.mockImplementation((path) => {
          if (path === '/test.md') return Promise.resolve(mockStat);
          return Promise.resolve({ type: 'directory' });
        });
        
        const result = await service.getFileInfo('/test.md');
        
        expect(result).toEqual({
          name: 'test.md',
          path: '/test.md',
          type: 'file',
          size: 100,
          lastModified: expect.any(Date),
          etag: 'etag123',
          mimeType: 'text/markdown',
          readable: true,
          writable: true
        });
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockClient.stat.mockResolvedValue({ type: 'directory' });
      await service.connect(validConfig);
    });

    it('should handle HTTP 401 errors as authentication errors', async () => {
      mockClient.getFileContents.mockRejectedValue({ status: 401 });
      
      await expect(service.getFile('/test.md')).rejects.toThrow();
    });

    it('should handle HTTP 404 errors as not found errors', async () => {
      mockClient.getFileContents.mockRejectedValue({ status: 404 });
      
      await expect(service.getFile('/nonexistent.md')).rejects.toThrow(WebDAVError);
    });
  });
});