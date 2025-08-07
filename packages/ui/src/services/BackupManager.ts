export interface BackupData {
  content: string;
  timestamp: Date;
  originalPath: string;
  size: number;
}

export interface RecoveryFile {
  path: string;
  timestamp: Date;
  size: number;
  error?: string;
}

export class BackupManager {
  private readonly BACKUP_PREFIX = 'file_backup_';
  private readonly RECOVERY_PREFIX = 'recovery_';
  private readonly MAX_BACKUP_SIZE = 5 * 1024 * 1024; // 5MB limit for localStorage
  
  constructor(private storageService: any) {}
  
  async createBackup(filePath: string, content: string): Promise<void> {
    // Don't backup files that are too large for localStorage
    if (content.length > this.MAX_BACKUP_SIZE) {
      console.warn(`File ${filePath} is too large for backup (${content.length} bytes)`);
      return;
    }
    
    const backupKey = `${this.BACKUP_PREFIX}${this.encodeFilePath(filePath)}`;
    const backup: BackupData = {
      content,
      timestamp: new Date(),
      originalPath: filePath,
      size: content.length
    };
    
    try {
      await this.storageService.setItem(backupKey, JSON.stringify(backup));
    } catch (error) {
      // Handle quota exceeded error
      if (this.isQuotaError(error)) {
        await this.cleanupOldBackups();
        // Try once more after cleanup
        try {
          await this.storageService.setItem(backupKey, JSON.stringify(backup));
        } catch (retryError) {
          console.error('Failed to create backup after cleanup:', retryError);
        }
      } else {
        console.error('Failed to create backup:', error);
      }
    }
  }
  
  async getBackup(filePath: string): Promise<BackupData | null> {
    const backupKey = `${this.BACKUP_PREFIX}${this.encodeFilePath(filePath)}`;
    
    try {
      const backupData = await this.storageService.getItem(backupKey);
      if (!backupData) return null;
      
      const parsed = JSON.parse(backupData);
      // Convert timestamp string back to Date
      parsed.timestamp = new Date(parsed.timestamp);
      return parsed;
    } catch (error) {
      console.error('Failed to retrieve backup:', error);
      return null;
    }
  }
  
  async removeBackup(filePath: string): Promise<void> {
    const backupKey = `${this.BACKUP_PREFIX}${this.encodeFilePath(filePath)}`;
    
    try {
      await this.storageService.removeItem(backupKey);
    } catch (error) {
      console.warn('Failed to remove backup:', error);
    }
  }
  
  async createRecoveryFile(filePath: string, content: string, error: string): Promise<void> {
    const recoveryKey = `${this.RECOVERY_PREFIX}${this.encodeFilePath(filePath)}`;
    const recovery: BackupData & { error: string } = {
      content,
      timestamp: new Date(),
      originalPath: filePath,
      size: content.length,
      error
    };
    
    try {
      await this.storageService.setItem(recoveryKey, JSON.stringify(recovery));
    } catch (storageError) {
      console.error('Failed to create recovery file:', storageError);
      // As a last resort, offer to download the file
      this.offerDownload(filePath, content);
    }
  }
  
  async listRecoveryFiles(): Promise<RecoveryFile[]> {
    const allKeys = await this.getAllStorageKeys();
    const recoveryFiles: RecoveryFile[] = [];
    
    for (const key of allKeys) {
      if (key.startsWith(this.RECOVERY_PREFIX)) {
        try {
          const data = await this.storageService.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            recoveryFiles.push({
              path: parsed.originalPath,
              timestamp: new Date(parsed.timestamp),
              size: parsed.size,
              error: parsed.error
            });
          }
        } catch (error) {
          console.warn(`Failed to parse recovery file ${key}:`, error);
        }
      }
    }
    
    // Sort by timestamp, most recent first
    return recoveryFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  async getRecoveryContent(filePath: string): Promise<string | null> {
    const recoveryKey = `${this.RECOVERY_PREFIX}${this.encodeFilePath(filePath)}`;
    
    try {
      const data = await this.storageService.getItem(recoveryKey);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return parsed.content;
    } catch (error) {
      console.error('Failed to retrieve recovery content:', error);
      return null;
    }
  }
  
  async removeRecoveryFile(filePath: string): Promise<void> {
    const recoveryKey = `${this.RECOVERY_PREFIX}${this.encodeFilePath(filePath)}`;
    
    try {
      await this.storageService.removeItem(recoveryKey);
    } catch (error) {
      console.warn('Failed to remove recovery file:', error);
    }
  }
  
  private async cleanupOldBackups(): Promise<void> {
    const allKeys = await this.getAllStorageKeys();
    const backupKeys = allKeys.filter(key => key.startsWith(this.BACKUP_PREFIX));
    
    // Get all backups with their timestamps
    const backups: { key: string; timestamp: Date }[] = [];
    for (const key of backupKeys) {
      try {
        const data = await this.storageService.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          backups.push({
            key,
            timestamp: new Date(parsed.timestamp)
          });
        }
      } catch (error) {
        // If we can't parse it, mark it for deletion
        backups.push({
          key,
          timestamp: new Date(0) // Very old date
        });
      }
    }
    
    // Sort by timestamp, oldest first
    backups.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Remove oldest 25% of backups
    const toRemove = Math.ceil(backups.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      try {
        await this.storageService.removeItem(backups[i].key);
      } catch (error) {
        console.warn(`Failed to remove old backup ${backups[i].key}:`, error);
      }
    }
  }
  
  private async getAllStorageKeys(): Promise<string[]> {
    // This depends on the storage service implementation
    // For localStorage, we'd iterate through all keys
    // For IndexedDB, we'd query the object store
    
    if (this.storageService.getAllKeys) {
      return await this.storageService.getAllKeys();
    }
    
    // Fallback for localStorage-like APIs
    const keys: string[] = [];
    if (typeof this.storageService.length !== 'undefined') {
      for (let i = 0; i < this.storageService.length; i++) {
        const key = this.storageService.key(i);
        if (key) keys.push(key);
      }
    }
    
    return keys;
  }
  
  private encodeFilePath(filePath: string): string {
    // Create a safe key from the file path
    // Replace problematic characters and encode
    return btoa(filePath)
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/=/g, '');
  }
  
  private isQuotaError(error: any): boolean {
    return error && (
      error.name === 'QuotaExceededError' ||
      error.code === 22 || // Legacy code for quota exceeded
      error.message?.includes('quota')
    );
  }
  
  private offerDownload(filePath: string, content: string): void {
    // Create a download link as a last resort backup
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const filename = filePath.split('/').pop() || 'backup.txt';
    
    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${Date.now()}_${filename}`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.warn(`File ${filePath} was downloaded as a backup due to storage issues`);
  }
}