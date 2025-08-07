import { describe, test, expect, vi, beforeEach } from 'vitest';
import { loadLargeFile } from '../../src/composables/useMarkdownEditor';

describe('loadLargeFile', () => {
  let mockWebDavService: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock WebDAV service
    mockWebDavService = {
      getFile: vi.fn(),
      getFileInfo: vi.fn(),
      getFileRange: vi.fn()
    };
  });

  test('loads small files directly without chunking', async () => {
    const mockContent = 'Small file content';
    const mockProgress = vi.fn();
    
    mockWebDavService.getFile.mockResolvedValue(mockContent);
    
    const result = await loadLargeFile('/test.md', mockWebDavService, mockProgress);
    
    expect(result).toBe(mockContent);
    expect(mockWebDavService.getFile).toHaveBeenCalledWith('/test.md');
    expect(mockWebDavService.getFileRange).not.toHaveBeenCalled();
    expect(mockProgress).toHaveBeenCalledWith(1);
  });

  test('uses chunked loading for large files', async () => {
    const mockProgress = vi.fn();
    const largeFileSize = 2 * 1024 * 1024; // 2MB
    
    // Mock file info for large file
    mockWebDavService.getFileInfo.mockResolvedValue({
      size: largeFileSize,
      name: 'large.md',
      path: '/large.md'
    });
    
    // Mock chunked responses
    mockWebDavService.getFileRange
      .mockResolvedValueOnce('Chunk 1 ')
      .mockResolvedValueOnce('Chunk 2 ')
      .mockResolvedValueOnce('Chunk 3');
    
    const result = await loadLargeFile('/large.md', mockWebDavService, mockProgress);
    
    expect(result).toBe('Chunk 1 Chunk 2 Chunk 3');
    expect(mockWebDavService.getFileInfo).toHaveBeenCalledWith('/large.md');
    expect(mockWebDavService.getFileRange).toHaveBeenCalled();
    expect(mockProgress).toHaveBeenCalled();
    
    // Verify progress was updated multiple times
    const progressCalls = mockProgress.mock.calls.map(call => call[0]);
    expect(progressCalls.length).toBeGreaterThan(1);
    expect(progressCalls[progressCalls.length - 1]).toBeCloseTo(1, 1);
  });

  test('falls back to direct loading if getFileRange is not available', async () => {
    const mockContent = 'File content';
    const mockProgress = vi.fn();
    
    // Service without getFileRange support
    const basicService = {
      getFile: vi.fn().mockResolvedValue(mockContent)
    };
    
    const result = await loadLargeFile('/test.md', basicService, mockProgress);
    
    expect(result).toBe(mockContent);
    expect(basicService.getFile).toHaveBeenCalledWith('/test.md');
    expect(mockProgress).toHaveBeenCalledWith(1);
  });

  test('falls back to direct loading if chunked loading fails', async () => {
    const mockContent = 'Fallback content';
    const mockProgress = vi.fn();
    
    mockWebDavService.getFileInfo.mockRejectedValue(new Error('Failed to get file info'));
    mockWebDavService.getFile.mockResolvedValue(mockContent);
    
    const result = await loadLargeFile('/test.md', mockWebDavService, mockProgress);
    
    expect(result).toBe(mockContent);
    expect(mockWebDavService.getFile).toHaveBeenCalledWith('/test.md');
    expect(mockProgress).toHaveBeenCalledWith(1);
  });

  test('validates file path before loading', async () => {
    const mockProgress = vi.fn();
    
    // Test path traversal attempt
    await expect(
      loadLargeFile('../../../etc/passwd', mockWebDavService, mockProgress)
    ).rejects.toThrow('path traversal detected');
    
    expect(mockWebDavService.getFile).not.toHaveBeenCalled();
    expect(mockWebDavService.getFileRange).not.toHaveBeenCalled();
  });

  test('handles progress updates correctly during chunked loading', async () => {
    const mockProgress = vi.fn();
    const fileSize = 200 * 1024; // 200KB (will need 4 chunks of 64KB)
    
    mockWebDavService.getFileInfo.mockResolvedValue({
      size: fileSize,
      name: 'medium.md',
      path: '/medium.md'
    });
    
    // Mock 4 chunks
    mockWebDavService.getFileRange
      .mockResolvedValueOnce('A'.repeat(64 * 1024))
      .mockResolvedValueOnce('B'.repeat(64 * 1024))
      .mockResolvedValueOnce('C'.repeat(64 * 1024))
      .mockResolvedValueOnce('D'.repeat(8 * 1024)); // Last chunk is smaller
    
    await loadLargeFile('/medium.md', mockWebDavService, mockProgress);
    
    // Check that progress was called with increasing values
    const progressValues = mockProgress.mock.calls.map(call => call[0]);
    
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
    
    // Final progress should be 1 (100%)
    expect(progressValues[progressValues.length - 1]).toBeCloseTo(1, 1);
  });

  test('correctly calculates byte ranges for chunks', async () => {
    const mockProgress = vi.fn();
    const fileSize = 130 * 1024; // 130KB (2 full chunks + partial)
    
    mockWebDavService.getFileInfo.mockResolvedValue({
      size: fileSize,
      name: 'test.md',
      path: '/test.md'
    });
    
    mockWebDavService.getFileRange.mockResolvedValue('chunk');
    
    await loadLargeFile('/test.md', mockWebDavService, mockProgress);
    
    // Verify the byte ranges passed to getFileRange
    expect(mockWebDavService.getFileRange).toHaveBeenNthCalledWith(1, '/test.md', 0, 65535); // 0-64KB
    expect(mockWebDavService.getFileRange).toHaveBeenNthCalledWith(2, '/test.md', 65536, 131071); // 64KB-128KB
    expect(mockWebDavService.getFileRange).toHaveBeenNthCalledWith(3, '/test.md', 131072, 133119); // 128KB-130KB
  });
});