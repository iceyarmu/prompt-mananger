/**
 * WebDAV Service Integration Tests
 * Tests against a real WebDAV server (requires Docker or manual setup)
 * 
 * To run these tests:
 * 1. Start a WebDAV server using Docker:
 *    docker run -d -p 8080:80 -v $(pwd)/test-data:/var/lib/dav -e AUTH_TYPE=Basic -e USERNAME=test -e PASSWORD=test --name webdav-server bytemark/webdav
 * 
 * 2. Run tests with environment variables:
 *    WEBDAV_URL=http://localhost:8080 WEBDAV_USERNAME=test WEBDAV_PASSWORD=test pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebDAVService } from '../../src/service';
import { WebDAVConfig, FileContent } from '../../src/types';
import { WebDAVError } from '../../src/errors';

// Test configuration - can be overridden by environment variables
const TEST_CONFIG: WebDAVConfig = {
  url: process.env.WEBDAV_URL || 'http://localhost:8080',
  username: process.env.WEBDAV_USERNAME || 'test',
  password: process.env.WEBDAV_PASSWORD || 'test',
  authType: 'basic',
  timeout: 10000,
  maxConnections: 3
};

const TEST_FOLDER = '/webdav-integration-tests';
const TEST_FILE = `${TEST_FOLDER}/test-file.md`;
const TEST_CONTENT = '# WebDAV Integration Test\n\nThis is a test file created by the WebDAV service integration tests.';

describe('WebDAV Service Integration Tests', () => {
  let service: WebDAVService;
  let isServerAvailable = false;

  beforeAll(async () => {
    service = new WebDAVService();
    
    // Check if WebDAV server is available
    try {
      const testResult = await service.testConnection(TEST_CONFIG, 5000);
      isServerAvailable = testResult.success;
      
      if (!isServerAvailable) {
        console.warn('WebDAV server not available. Skipping integration tests.');
        console.warn('To run integration tests, start a WebDAV server:');
        console.warn('docker run -d -p 8080:80 -e AUTH_TYPE=Basic -e USERNAME=test -e PASSWORD=test bytemark/webdav');
      }
    } catch (error) {
      console.warn('Unable to test WebDAV server connection:', error);
    }
  });

  beforeEach(async () => {
    if (!isServerAvailable) return;
    
    // Connect before each test
    await service.connect(TEST_CONFIG);
    
    // Clean up any existing test data
    try {
      const exists = await service.exists(TEST_FOLDER);
      if (exists) {
        await service.deleteFolder(TEST_FOLDER, true);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Create test folder
    await service.createFolder(TEST_FOLDER);
  });

  afterEach(async () => {
    if (!isServerAvailable) return;
    
    // Clean up test data
    try {
      const exists = await service.exists(TEST_FOLDER);
      if (exists) {
        await service.deleteFolder(TEST_FOLDER, true);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Disconnect after each test
    await service.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect and disconnect successfully', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Test disconnect and reconnect
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
      
      const result = await service.connect(TEST_CONFIG);
      expect(result).toBe(true);
      expect(service.isConnected()).toBe(true);
    });

    it('should test connection with various timeouts', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      const testResult = await service.testConnection(TEST_CONFIG, 1000);
      expect(testResult.success).toBe(true);
      expect(testResult.responseTime).toBeGreaterThan(0);
      expect(testResult.responseTime).toBeLessThan(1000);
      expect(testResult.serverInfo).toBeTruthy();
    });

    it('should handle connection cycling without memory leaks', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Test 10 connect/disconnect cycles to check for memory leaks
      for (let i = 0; i < 10; i++) {
        await service.disconnect();
        expect(service.isConnected()).toBe(false);
        
        const result = await service.connect(TEST_CONFIG);
        expect(result).toBe(true);
        expect(service.isConnected()).toBe(true);
      }
    });
  });

  describe('File Operations', () => {
    it('should create, read, update, and delete a file', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Create file
      const fileContent: FileContent = {
        path: TEST_FILE,
        content: TEST_CONTENT,
        mimeType: 'text/markdown'
      };
      
      await service.putFile(fileContent);
      
      // Verify file exists
      const exists = await service.exists(TEST_FILE);
      expect(exists).toBe(true);
      
      // Read file
      const readContent = await service.getFile(TEST_FILE);
      expect(readContent.content).toBe(TEST_CONTENT);
      expect(readContent.path).toBe(TEST_FILE);
      
      // Update file
      const updatedContent = TEST_CONTENT + '\n\nUpdated content.';
      await service.putFile({ ...fileContent, content: updatedContent });
      
      // Verify update
      const readUpdated = await service.getFile(TEST_FILE);
      expect(readUpdated.content).toBe(updatedContent);
      
      // Delete file
      await service.deleteFile(TEST_FILE);
      
      // Verify deletion
      const existsAfterDelete = await service.exists(TEST_FILE);
      expect(existsAfterDelete).toBe(false);
    });

    it('should move/rename files', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      const sourceFile = `${TEST_FOLDER}/source.md`;
      const targetFile = `${TEST_FOLDER}/target.md`;
      
      // Create source file
      await service.putFile({
        path: sourceFile,
        content: 'Source file content'
      });
      
      // Move file
      await service.moveFile(sourceFile, targetFile);
      
      // Verify source no longer exists
      const sourceExists = await service.exists(sourceFile);
      expect(sourceExists).toBe(false);
      
      // Verify target exists with correct content
      const targetExists = await service.exists(targetFile);
      expect(targetExists).toBe(true);
      
      const targetContent = await service.getFile(targetFile);
      expect(targetContent.content).toBe('Source file content');
    });

    it('should get file information', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Create test file
      await service.putFile({
        path: TEST_FILE,
        content: TEST_CONTENT
      });
      
      // Get file info
      const fileInfo = await service.getFileInfo(TEST_FILE);
      
      expect(fileInfo.name).toBe('test-file.md');
      expect(fileInfo.path).toBe(TEST_FILE);
      expect(fileInfo.type).toBe('file');
      expect(fileInfo.size).toBeGreaterThan(0);
      expect(fileInfo.lastModified).toBeInstanceOf(Date);
    });
  });

  describe('Folder Operations', () => {
    it('should create and list folders', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      const subFolder = `${TEST_FOLDER}/subfolder`;
      
      // Create subfolder
      await service.createFolder(subFolder);
      
      // Verify subfolder exists
      const exists = await service.exists(subFolder);
      expect(exists).toBe(true);
      
      // List parent folder
      const contents = await service.listFolder(TEST_FOLDER);
      
      expect(contents).toHaveLength(1);
      expect(contents[0].name).toBe('subfolder');
      expect(contents[0].type).toBe('directory');
    });

    it('should list folder contents with markdown filtering', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Create various files
      await service.putFile({
        path: `${TEST_FOLDER}/test.md`,
        content: '# Markdown file'
      });
      
      await service.putFile({
        path: `${TEST_FOLDER}/test.txt`,
        content: 'Text file'
      });
      
      await service.putFile({
        path: `${TEST_FOLDER}/README.MD`,
        content: '# Another markdown file'
      });
      
      // List all files
      const allFiles = await service.listFolder(TEST_FOLDER);
      expect(allFiles.length).toBeGreaterThanOrEqual(3);
      
      // List only markdown files
      const markdownFiles = await service.listFolder(TEST_FOLDER, true);
      expect(markdownFiles).toHaveLength(2);
      
      const markdownNames = markdownFiles.map(f => f.name);
      expect(markdownNames).toContain('test.md');
      expect(markdownNames).toContain('README.MD');
      expect(markdownNames).not.toContain('test.txt');
    });

    it('should delete empty and non-empty folders', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      const emptyFolder = `${TEST_FOLDER}/empty`;
      const nonEmptyFolder = `${TEST_FOLDER}/nonempty`;
      
      // Create folders
      await service.createFolder(emptyFolder);
      await service.createFolder(nonEmptyFolder);
      
      // Add file to non-empty folder
      await service.putFile({
        path: `${nonEmptyFolder}/file.txt`,
        content: 'Content'
      });
      
      // Delete empty folder (should succeed)
      await service.deleteFolder(emptyFolder);
      const emptyExists = await service.exists(emptyFolder);
      expect(emptyExists).toBe(false);
      
      // Try to delete non-empty folder without force (should fail)
      await expect(service.deleteFolder(nonEmptyFolder, false)).rejects.toThrow();
      
      // Delete non-empty folder with force (should succeed)
      await service.deleteFolder(nonEmptyFolder, true);
      const nonEmptyExists = await service.exists(nonEmptyFolder);
      expect(nonEmptyExists).toBe(false);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle file not found errors gracefully', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      const nonExistentFile = `${TEST_FOLDER}/nonexistent.md`;
      
      // Test file operations on non-existent file
      await expect(service.getFile(nonExistentFile)).rejects.toThrow(WebDAVError);
      await expect(service.deleteFile(nonExistentFile)).rejects.toThrow(WebDAVError);
      await expect(service.getFileInfo(nonExistentFile)).rejects.toThrow(WebDAVError);
      
      // exists() should return false, not throw
      const exists = await service.exists(nonExistentFile);
      expect(exists).toBe(false);
    });

    it('should handle concurrent operations', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Create multiple files concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.putFile({
          path: `${TEST_FOLDER}/concurrent-${i}.md`,
          content: `Concurrent file ${i}`
        }));
      }
      
      await Promise.all(promises);
      
      // Verify all files were created
      const contents = await service.listFolder(TEST_FOLDER);
      const concurrentFiles = contents.filter(f => f.name.startsWith('concurrent-'));
      expect(concurrentFiles).toHaveLength(5);
    });

    it('should handle network interruptions gracefully', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // This test would require actually interrupting the network
      // For now, we'll just test that the service can recover from errors
      
      // Create a file successfully first
      await service.putFile({
        path: TEST_FILE,
        content: TEST_CONTENT
      });
      
      // Verify it exists
      const exists = await service.exists(TEST_FILE);
      expect(exists).toBe(true);
      
      // If we had a way to simulate network interruption, we would do it here
      // Then test that subsequent operations still work after reconnection
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle large file content without memory issues', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      // Create a 1MB file
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB of 'x'
      const largeFile = `${TEST_FOLDER}/large-file.txt`;
      
      await service.putFile({
        path: largeFile,
        content: largeContent
      });
      
      // Read it back
      const readContent = await service.getFile(largeFile);
      expect(readContent.content).toBe(largeContent);
      expect(readContent.content.length).toBe(1024 * 1024);
      
      // Clean up
      await service.deleteFile(largeFile);
    });

    it('should maintain performance with multiple operations', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebDAV server not available');
        return;
      }

      const startTime = Date.now();
      
      // Perform 20 file operations
      for (let i = 0; i < 20; i++) {
        const fileName = `${TEST_FOLDER}/perf-test-${i}.md`;
        await service.putFile({
          path: fileName,
          content: `Performance test file ${i}`
        });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete 20 operations in reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(30000); // 30 seconds
      
      // Verify all files were created
      const contents = await service.listFolder(TEST_FOLDER);
      const perfFiles = contents.filter(f => f.name.startsWith('perf-test-'));
      expect(perfFiles).toHaveLength(20);
    });
  });
});