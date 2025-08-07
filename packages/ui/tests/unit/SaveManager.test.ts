import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../../src/services/SaveManager';

describe('SaveManager', () => {
  let saveManager: SaveManager;
  let mockWebDAVService: any;
  let mockNotificationService: any;
  let mockStorageService: any;
  
  beforeEach(() => {
    mockWebDAVService = {
      putFile: vi.fn(),
      getFileInfo: vi.fn().mockResolvedValue({
        lastModified: new Date(),
        size: 100,
        etag: 'test-etag'
      }),
      getFile: vi.fn().mockResolvedValue('file content')
    };
    mockNotificationService = {
      show: vi.fn(),
      error: vi.fn(),
      success: vi.fn()
    };
    mockStorageService = {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn()
    };
    
    saveManager = new SaveManager(
      mockWebDAVService,
      mockNotificationService,
      mockStorageService
    );
  });
  
  describe('saveFile', () => {
    it('saves file successfully', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      
      mockWebDAVService.putFile.mockResolvedValue(undefined);
      
      const result = await saveManager.saveFile(filePath, content);
      
      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(content.length);
      expect(mockWebDAVService.putFile).toHaveBeenCalledWith(filePath, content);
    });
    
    it('prevents concurrent saves', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      
      // Make putFile take some time
      mockWebDAVService.putFile.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const save1 = saveManager.saveFile(filePath, content);
      
      // Try to start another save while first is in progress
      await expect(saveManager.saveFile(filePath, content)).rejects.toThrow('Save already in progress');
      
      // Wait for first save to complete
      await save1;
    });
    
    it('retries on network failure', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      
      mockWebDAVService.putFile
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      
      const result = await saveManager.saveFile(filePath, content, { retryCount: 3 });
      
      expect(result.success).toBe(true);
      expect(mockWebDAVService.putFile).toHaveBeenCalledTimes(3);
    });
    
    it('fails after max retries', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      const error = new Error('Network error');
      
      mockWebDAVService.putFile.mockRejectedValue(error);
      
      const result = await saveManager.saveFile(filePath, content, { retryCount: 2 });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(mockWebDAVService.putFile).toHaveBeenCalledTimes(3); // Initial + 2 retries
      
      // Check that failed content was stored for recovery
      expect(mockStorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('file_backup_failed_'),
        expect.stringContaining(content)
      );
    });
    
    it('respects timeout option', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      
      // Make putFile take longer than timeout
      mockWebDAVService.putFile.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 3000))
      );
      
      const result = await saveManager.saveFile(filePath, content, { 
        timeout: 100,
        retryCount: 0 // Don't retry to speed up test
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });
    
    it('detects retryable errors correctly', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      
      const retryableErrors = [
        'Network error',
        'Connection timeout',
        'ECONNREFUSED',
        '503 Service Unavailable'
      ];
      
      for (const errorMsg of retryableErrors) {
        mockWebDAVService.putFile
          .mockRejectedValueOnce(new Error(errorMsg))
          .mockResolvedValueOnce(undefined);
        
        const result = await saveManager.saveFile(filePath, content, { retryCount: 1 });
        
        expect(result.success).toBe(true);
        mockWebDAVService.putFile.mockClear();
      }
    });
    
    it('does not retry non-retryable errors', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      const error = new Error('Permission denied');
      
      mockWebDAVService.putFile.mockRejectedValue(error);
      
      const result = await saveManager.saveFile(filePath, content, { retryCount: 3 });
      
      expect(result.success).toBe(false);
      expect(mockWebDAVService.putFile).toHaveBeenCalledTimes(1); // No retries
    });
    
    it('uses exponential backoff for retries', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      
      mockWebDAVService.putFile
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      
      const startTime = Date.now();
      const result = await saveManager.saveFile(filePath, content, { retryCount: 2 });
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      // First retry after ~1000ms, second after ~2000ms, total ~3000ms
      // Allow some tolerance for test execution time
      expect(duration).toBeGreaterThan(2500);
      expect(duration).toBeLessThan(4000);
    });
  });
  
  describe('progress tracking', () => {
    it('calls progress callback when enabled', async () => {
      const content = '# Test content'.repeat(100); // Make content larger
      const filePath = '/test.md';
      const progressUpdates: any[] = [];
      
      saveManager.setProgressCallback((progress) => {
        progressUpdates.push(progress);
      });
      
      mockWebDAVService.putFile.mockResolvedValue(undefined);
      
      await saveManager.saveFile(filePath, content, { showProgress: true });
      
      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Last update should be 100%
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.percentage).toBe(100);
      expect(lastUpdate.totalBytes).toBe(content.length);
    });
    
    it('does not call progress callback when disabled', async () => {
      const content = '# Test content';
      const filePath = '/test.md';
      const progressCallback = vi.fn();
      
      saveManager.setProgressCallback(progressCallback);
      
      mockWebDAVService.putFile.mockResolvedValue(undefined);
      
      await saveManager.saveFile(filePath, content, { showProgress: false });
      
      expect(progressCallback).not.toHaveBeenCalled();
    });
  });
});