import type { WebDAVService } from '@webdav/service';
import type { NotificationService } from '../utils/notification';
import type { StorageService } from '../composables/useStorage';
import { ConflictDetector } from './ConflictDetector';
import { BackupManager } from './BackupManager';

export interface SaveOptions {
  retryCount?: number;
  timeout?: number;
  showProgress?: boolean;
  conflictStrategy?: 'overwrite' | 'merge' | 'prompt';
}

export interface SaveResult {
  success: boolean;
  timestamp: Date;
  conflictDetected?: boolean;
  error?: Error;
  bytesWritten?: number;
}

export interface SaveProgress {
  percentage: number;
  bytesWritten: number;
  totalBytes: number;
}

export class SaveManager {
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private saveInProgress = false;
  private retryCount = 0;
  private progressCallback?: (progress: SaveProgress) => void;
  private conflictDetector: ConflictDetector;
  private backupManager: BackupManager;
  
  constructor(
    private webdavService: WebDAVService,
    private notificationService: NotificationService,
    private storageService: StorageService
  ) {
    this.conflictDetector = new ConflictDetector(webdavService);
    this.backupManager = new BackupManager(storageService);
  }
  
  async saveFile(
    filePath: string, 
    content: string, 
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    if (this.saveInProgress) {
      throw new Error('Save already in progress');
    }
    
    this.saveInProgress = true;
    const timeout = options.timeout || 2000; // 2 second default timeout
    
    try {
      // Create backup before saving
      await this.createBackup(filePath, content);
      
      // Check for concurrent modifications
      if (await this.detectConcurrentEdit(filePath)) {
        return await this.handleConflict(filePath, content, options);
      }
      
      // Perform the actual save with timeout
      const startTime = Date.now();
      const savePromise = this.performSave(filePath, content, options.showProgress);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Save operation timed out')), timeout);
      });
      
      await Promise.race([savePromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      
      // Update file metadata after successful save
      await this.updateFileMetadata(filePath);
      
      // Clean up backup on success
      await this.removeBackup(filePath);
      
      return {
        success: true,
        timestamp: new Date(),
        bytesWritten: content.length
      };
      
    } catch (error) {
      return await this.handleSaveError(error as Error, filePath, content, options);
    } finally {
      this.saveInProgress = false;
      this.retryCount = 0;
    }
  }
  
  private async performSave(filePath: string, content: string, showProgress?: boolean): Promise<void> {
    if (showProgress && this.progressCallback) {
      // Simulate progress for now - in real implementation would track actual upload progress
      const totalBytes = content.length;
      let bytesWritten = 0;
      const chunkSize = Math.ceil(totalBytes / 10);
      
      // Report initial progress
      this.progressCallback({
        percentage: 0,
        bytesWritten: 0,
        totalBytes
      });
      
      // Create promise to handle the save with progress
      const savePromise = this.webdavService.putFile(filePath, content);
      
      // Simulate progress updates while saving
      const progressInterval = setInterval(() => {
        bytesWritten = Math.min(bytesWritten + chunkSize, totalBytes);
        this.progressCallback?.({
          percentage: (bytesWritten / totalBytes) * 100,
          bytesWritten,
          totalBytes
        });
        
        if (bytesWritten >= totalBytes) {
          clearInterval(progressInterval);
        }
      }, 10);
      
      // Wait for save to complete and clear interval
      await savePromise;
      clearInterval(progressInterval);
      
      // Report final progress
      this.progressCallback({
        percentage: 100,
        bytesWritten: totalBytes,
        totalBytes
      });
    } else {
      await this.webdavService.putFile(filePath, content);
    }
  }
  
  private async handleSaveError(
    error: Error,
    filePath: string,
    content: string,
    options: SaveOptions
  ): Promise<SaveResult> {
    const maxRetries = options.retryCount || 3;
    
    if (this.retryCount < maxRetries && this.isRetryableError(error)) {
      this.retryCount++;
      // Exponential backoff with max delay of 5 seconds
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 5000);
      
      // Reset saveInProgress flag before retry
      this.saveInProgress = false;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.saveFile(filePath, content, options);
    }
    
    // Store failed content for recovery
    await this.backupManager.createRecoveryFile(filePath, content, error.message);
    
    return {
      success: false,
      timestamp: new Date(),
      error
    };
  }
  
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'network',
      'timeout',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      '503',
      '502',
      '504'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
  }
  
  private async detectConcurrentEdit(filePath: string): Promise<boolean> {
    const conflictInfo = await this.conflictDetector.checkForConflicts(filePath);
    return conflictInfo.detected;
  }
  
  private async handleConflict(
    filePath: string,
    content: string,
    options: SaveOptions
  ): Promise<SaveResult> {
    const conflictInfo = await this.conflictDetector.checkForConflicts(filePath);
    
    if (!conflictInfo.detected) {
      // No conflict, proceed with save
      return this.performSaveWithMetadataUpdate(filePath, content, options);
    }
    
    // Handle conflict based on strategy
    const strategy = options.conflictStrategy || 'prompt';
    
    if (strategy === 'prompt') {
      // In a real app, this would show a UI dialog
      // For now, we'll default to overwrite and mark conflict in result
      return {
        success: false,
        timestamp: new Date(),
        conflictDetected: true,
        error: new Error('Conflict detected. File was modified by another user.')
      };
    }
    
    try {
      // Resolve conflict based on strategy
      const resolvedContent = await this.conflictDetector.resolveConflict(
        filePath,
        content,
        strategy as any
      );
      
      // Save the resolved content
      await this.performSave(filePath, resolvedContent, options.showProgress);
      
      // Update metadata after successful save
      await this.updateFileMetadata(filePath);
      
      return {
        success: true,
        timestamp: new Date(),
        bytesWritten: resolvedContent.length,
        conflictDetected: true
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date(),
        error: error as Error,
        conflictDetected: true
      };
    }
  }
  
  private async performSaveWithMetadataUpdate(
    filePath: string,
    content: string,
    options: SaveOptions
  ): Promise<SaveResult> {
    await this.performSave(filePath, content, options.showProgress);
    await this.updateFileMetadata(filePath);
    
    return {
      success: true,
      timestamp: new Date(),
      bytesWritten: content.length
    };
  }
  
  private async updateFileMetadata(filePath: string): Promise<void> {
    try {
      const fileInfo = await this.webdavService.getFileInfo(filePath);
      this.conflictDetector.updateFileMetadata(filePath, {
        lastModified: fileInfo.lastModified,
        size: fileInfo.size,
        etag: fileInfo.etag
      });
    } catch (error) {
      console.warn(`Could not update file metadata for ${filePath}:`, error);
    }
  }
  
  private async createBackup(filePath: string, content: string): Promise<void> {
    await this.backupManager.createBackup(filePath, content);
  }
  
  private async removeBackup(filePath: string): Promise<void> {
    await this.backupManager.removeBackup(filePath);
  }
  
  async listRecoveryFiles() {
    return this.backupManager.listRecoveryFiles();
  }
  
  async getRecoveryContent(filePath: string) {
    return this.backupManager.getRecoveryContent(filePath);
  }
  
  async removeRecoveryFile(filePath: string) {
    return this.backupManager.removeRecoveryFile(filePath);
  }
  
  setProgressCallback(callback: (progress: SaveProgress) => void) {
    this.progressCallback = callback;
  }
  
  clearProgressCallback() {
    this.progressCallback = undefined;
  }
}