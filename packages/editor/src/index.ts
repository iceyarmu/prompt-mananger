/**
 * @prompt-optimizer/editor
 * Enhanced editor package with remote file support
 */

import type { WebDAVClient } from '@prompt-optimizer/webdav';

export interface EditorConfig {
  webdavClient?: WebDAVClient;
  autoSave?: boolean;
  autoSaveInterval?: number;
  theme?: 'light' | 'dark';
}

export interface EditorFile {
  path: string;
  content: string;
  isRemote: boolean;
  isDirty: boolean;
  lastSaved?: Date;
  lastModified?: Date;
}

export class EditorError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EditorError';
  }
}

export interface Editor {
  loadFile(path: string, isRemote?: boolean): Promise<EditorFile>;
  saveFile(file: EditorFile): Promise<void>;
  createNewFile(path: string, content?: string): EditorFile;
  closeFile(file: EditorFile): Promise<void>;
  getOpenFiles(): EditorFile[];
  setContent(file: EditorFile, content: string): void;
  getContent(file: EditorFile): string;
  markAsDirty(file: EditorFile): void;
  markAsClean(file: EditorFile): void;
}

export class EditorService implements Editor {
  private config: EditorConfig;
  private openFiles: Map<string, EditorFile> = new Map();

  constructor(config: EditorConfig = {}) {
    this.config = config;
  }

  async loadFile(path: string, isRemote: boolean = false): Promise<EditorFile> {
    if (this.openFiles.has(path)) {
      return this.openFiles.get(path)!;
    }

    let content = '';
    try {
      if (isRemote) {
        if (!this.config.webdavClient) {
          throw new EditorError('WebDAV client not configured', 'WEBDAV_NOT_CONFIGURED');
        }
        content = await this.config.webdavClient.readFile(path);
      } else {
        // TODO: Load from local file system
        // For now, throw an error to indicate not implemented
        throw new EditorError('Local file system not yet implemented', 'NOT_IMPLEMENTED');
      }
    } catch (error) {
      if (error instanceof EditorError) {
        throw error;
      }
      throw new EditorError(`Failed to load file: ${(error as Error).message}`, 'LOAD_ERROR');
    }

    const file: EditorFile = {
      path,
      content,
      isRemote,
      isDirty: false,
      lastModified: new Date()
    };

    this.openFiles.set(path, file);
    return file;
  }

  async saveFile(file: EditorFile): Promise<void> {
    try {
      if (file.isRemote) {
        if (!this.config.webdavClient) {
          throw new EditorError('WebDAV client not configured', 'WEBDAV_NOT_CONFIGURED');
        }
        await this.config.webdavClient.writeFile(file.path, file.content);
      } else {
        // TODO: Save to local file system
        throw new EditorError('Local file system not yet implemented', 'NOT_IMPLEMENTED');
      }
      
      file.isDirty = false;
      file.lastSaved = new Date();
    } catch (error) {
      if (error instanceof EditorError) {
        throw error;
      }
      throw new EditorError(`Failed to save file: ${(error as Error).message}`, 'SAVE_ERROR');
    }
  }

  createNewFile(path: string, content: string = ''): EditorFile {
    const file: EditorFile = {
      path,
      content,
      isRemote: false,
      isDirty: true,
      lastModified: new Date()
    };

    this.openFiles.set(path, file);
    return file;
  }

  async closeFile(file: EditorFile): Promise<void> {
    if (file.isDirty && this.config.autoSave) {
      await this.saveFile(file);
    }
    this.openFiles.delete(file.path);
  }

  getOpenFiles(): EditorFile[] {
    return Array.from(this.openFiles.values());
  }

  setContent(file: EditorFile, content: string): void {
    file.content = content;
    file.isDirty = true;
    file.lastModified = new Date();
  }

  getContent(file: EditorFile): string {
    return file.content;
  }

  markAsDirty(file: EditorFile): void {
    file.isDirty = true;
  }

  markAsClean(file: EditorFile): void {
    file.isDirty = false;
  }
}

// Export all types and classes for better module usage
export default EditorService;