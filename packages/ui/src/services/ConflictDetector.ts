import type { WebDAVService } from '@webdav/service';

export interface FileMetadata {
  lastModified: Date;
  size: number;
  etag?: string;
}

export interface ConflictInfo {
  detected: boolean;
  localModified: Date;
  remoteModified: Date;
  strategy?: 'overwrite' | 'merge' | 'reload';
}

export interface ConflictResolution {
  action: 'overwrite' | 'merge' | 'reload' | 'cancel';
  content?: string;
}

export class ConflictDetector {
  private fileMetadata = new Map<string, FileMetadata>();
  
  constructor(private webdavService: WebDAVService) {}
  
  async checkForConflicts(filePath: string): Promise<ConflictInfo> {
    const localMetadata = this.fileMetadata.get(filePath);
    if (!localMetadata) {
      // No local metadata means this is the first save
      return { 
        detected: false, 
        localModified: new Date(), 
        remoteModified: new Date() 
      };
    }
    
    try {
      const remoteMetadata = await this.webdavService.getFileInfo(filePath);
      
      // Check if remote file was modified after our last known modification
      const conflict = remoteMetadata.lastModified > localMetadata.lastModified;
      
      return {
        detected: conflict,
        localModified: localMetadata.lastModified,
        remoteModified: remoteMetadata.lastModified
      };
    } catch (error) {
      // If we can't get remote info, assume no conflict
      // This could happen if the file doesn't exist yet or network issues
      console.warn(`Could not check for conflicts on ${filePath}:`, error);
      return { 
        detected: false, 
        localModified: localMetadata.lastModified, 
        remoteModified: new Date() 
      };
    }
  }
  
  updateFileMetadata(filePath: string, metadata: FileMetadata) {
    this.fileMetadata.set(filePath, metadata);
  }
  
  async resolveConflict(
    filePath: string,
    localContent: string,
    strategy: ConflictInfo['strategy']
  ): Promise<string> {
    switch (strategy) {
      case 'overwrite':
        // User chooses to overwrite remote with local changes
        return localContent;
        
      case 'reload':
        // User chooses to discard local changes and reload remote
        const remoteContent = await this.webdavService.getFile(filePath);
        // Update metadata after reloading
        const remoteInfo = await this.webdavService.getFileInfo(filePath);
        this.updateFileMetadata(filePath, {
          lastModified: remoteInfo.lastModified,
          size: remoteContent.length,
          etag: remoteInfo.etag
        });
        return remoteContent;
        
      case 'merge':
        // Attempt to merge changes
        const remote = await this.webdavService.getFile(filePath);
        return this.performBasicMerge(localContent, remote);
        
      default:
        throw new Error('Invalid conflict resolution strategy');
    }
  }
  
  private performBasicMerge(local: string, remote: string): string {
    // This is a very basic merge strategy
    // In a real application, you'd want more sophisticated merging
    // possibly using a diff3 algorithm or similar
    
    // For now, we'll create a simple conflict marker format
    const marker = '='.repeat(50);
    const conflictMarker = `
<<<<<<< LOCAL CHANGES ${marker}
${local}
======= REMOTE CHANGES ${marker}
${remote}
>>>>>>> END CONFLICT ${marker}
`;
    
    return conflictMarker;
  }
  
  clearMetadata(filePath?: string) {
    if (filePath) {
      this.fileMetadata.delete(filePath);
    } else {
      this.fileMetadata.clear();
    }
  }
  
  hasMetadata(filePath: string): boolean {
    return this.fileMetadata.has(filePath);
  }
  
  getMetadata(filePath: string): FileMetadata | undefined {
    return this.fileMetadata.get(filePath);
  }
}