import { createLogger } from '../utils/logger'
import type { WebDAVService } from './WebDAVService'

const logger = createLogger('FileOperationsService')

export interface FileMetadata {
  name: string
  path: string
  size: number
  lastModified: Date
  isDirectory: boolean
  contentType?: string
}

export interface FileOperationResult {
  success: boolean
  message?: string
  error?: Error
}

export interface FileContent {
  path: string
  content: string
  metadata?: FileMetadata
}

export class FileOperationsService {
  private webDAVService?: WebDAVService
  private storageService: any // StorageService from core
  private readonly storagePrefix = 'file:'
  
  constructor(storageService: any, webDAVService?: WebDAVService) {
    this.storageService = storageService
    this.webDAVService = webDAVService
    logger.info('FileOperationsService constructed', { 
      hasWebDAV: !!webDAVService 
    })
  }
  
  /**
   * Read file content from WebDAV or local storage
   */
  async read(path: string): Promise<FileContent> {
    // Path validation
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid file path provided')
    }
    
    // Sanitize path to prevent directory traversal
    const sanitizedPath = path.replace(/\.\./g, '').replace(/\/+/g, '/')
    
    logger.debug('Reading file', { path: sanitizedPath })
    
    // Try WebDAV first if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          // Add timeout for WebDAV operations
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('WebDAV read timeout')), 30000)
          })
          
          const content = await Promise.race([
            this.webDAVService.readFile(sanitizedPath),
            timeoutPromise
          ])
          
          logger.info('File read from WebDAV', { path: sanitizedPath })
          return {
            path: sanitizedPath,
            content,
            metadata: {
              name: sanitizedPath.split('/').pop() || '',
              path: sanitizedPath,
              size: content.length,
              lastModified: new Date(),
              isDirectory: false
            }
          }
        }
      } catch (error) {
        logger.warn('WebDAV read failed, falling back to local storage', { path: sanitizedPath, error })
      }
    }
    
    // Fallback to local storage
    return this.readFromLocalStorage(sanitizedPath)
  }
  
  /**
   * Write file content to WebDAV and local storage
   */
  async write(path: string, content: string): Promise<FileOperationResult> {
    logger.debug('Writing file', { path, contentLength: content.length })
    
    const results: FileOperationResult[] = []
    
    // Write to WebDAV if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          await this.webDAVService.writeFile(path, content)
          logger.info('File written to WebDAV', { path })
          results.push({ success: true, message: 'Written to WebDAV' })
        }
      } catch (error) {
        logger.error('WebDAV write failed', { path, error })
        results.push({ 
          success: false, 
          message: 'WebDAV write failed', 
          error: error as Error 
        })
      }
    }
    
    // Always write to local storage as backup
    try {
      await this.writeToLocalStorage(path, content)
      logger.info('File written to local storage', { path })
      results.push({ success: true, message: 'Written to local storage' })
    } catch (error) {
      logger.error('Local storage write failed', { path, error })
      results.push({ 
        success: false, 
        message: 'Local storage write failed', 
        error: error as Error 
      })
    }
    
    // Return success if at least one write succeeded
    const anySuccess = results.some(r => r.success)
    return {
      success: anySuccess,
      message: results.map(r => r.message).join('; '),
      error: anySuccess ? undefined : results.find(r => r.error)?.error
    }
  }
  
  /**
   * Delete file from WebDAV and local storage
   */
  async delete(path: string): Promise<FileOperationResult> {
    logger.debug('Deleting file', { path })
    
    const results: FileOperationResult[] = []
    
    // Delete from WebDAV if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          await this.webDAVService.deleteFile(path)
          logger.info('File deleted from WebDAV', { path })
          results.push({ success: true, message: 'Deleted from WebDAV' })
        }
      } catch (error) {
        logger.error('WebDAV delete failed', { path, error })
        results.push({ 
          success: false, 
          message: 'WebDAV delete failed', 
          error: error as Error 
        })
      }
    }
    
    // Always delete from local storage
    try {
      await this.deleteFromLocalStorage(path)
      logger.info('File deleted from local storage', { path })
      results.push({ success: true, message: 'Deleted from local storage' })
    } catch (error) {
      logger.error('Local storage delete failed', { path, error })
      results.push({ 
        success: false, 
        message: 'Local storage delete failed', 
        error: error as Error 
      })
    }
    
    // Return success if at least one delete succeeded
    const anySuccess = results.some(r => r.success)
    return {
      success: anySuccess,
      message: results.map(r => r.message).join('; '),
      error: anySuccess ? undefined : results.find(r => r.error)?.error
    }
  }
  
  /**
   * Rename/move file
   */
  async rename(oldPath: string, newPath: string): Promise<FileOperationResult> {
    logger.debug('Renaming file', { oldPath, newPath })
    
    // Read the file content first
    let content: string
    try {
      const fileContent = await this.read(oldPath)
      content = fileContent.content
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read source file',
        error: error as Error
      }
    }
    
    // Write to new location
    const writeResult = await this.write(newPath, content)
    if (!writeResult.success) {
      return writeResult
    }
    
    // Delete old file
    const deleteResult = await this.delete(oldPath)
    if (!deleteResult.success) {
      // Try to rollback by deleting the new file
      await this.delete(newPath)
      return {
        success: false,
        message: 'Failed to delete old file after copy',
        error: deleteResult.error
      }
    }
    
    logger.info('File renamed successfully', { oldPath, newPath })
    return {
      success: true,
      message: `File renamed from ${oldPath} to ${newPath}`
    }
  }
  
  /**
   * Move file (alias for rename)
   */
  async move(sourcePath: string, destinationPath: string): Promise<FileOperationResult> {
    return this.rename(sourcePath, destinationPath)
  }
  
  /**
   * List files in a directory
   */
  async list(dirPath: string = '/'): Promise<FileMetadata[]> {
    logger.debug('Listing files', { dirPath })
    
    // Try WebDAV first if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          const files = await this.webDAVService.listFiles(dirPath)
          logger.info('Files listed from WebDAV', { dirPath, count: files.length })
          return files.map(f => ({
            name: f.filename,
            path: f.path,
            size: f.size,
            lastModified: f.lastModified,
            isDirectory: f.isDirectory,
            contentType: f.contentType
          }))
        }
      } catch (error) {
        logger.warn('WebDAV list failed, falling back to local storage', { dirPath, error })
      }
    }
    
    // Fallback to local storage
    return this.listFromLocalStorage(dirPath)
  }
  
  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    logger.debug('Checking file existence', { path })
    
    // Check WebDAV first if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          const exists = await this.webDAVService.fileExists(path)
          logger.debug('WebDAV file existence check', { path, exists })
          if (exists) return true
        }
      } catch (error) {
        logger.debug('WebDAV existence check failed', { path, error })
      }
    }
    
    // Check local storage
    return this.existsInLocalStorage(path)
  }
  
  /**
   * Get service health status
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Test local storage
      const testKey = `${this.storagePrefix}health-check`
      await this.storageService.set(testKey, 'test')
      await this.storageService.delete(testKey)
      
      // If WebDAV is configured, check its health too
      if (this.webDAVService) {
        const webDAVHealthy = await this.webDAVService.checkHealth()
        logger.debug('Health check completed', { 
          localStorage: true, 
          webDAV: webDAVHealthy 
        })
      }
      
      return true
    } catch (error) {
      logger.error('Health check failed', error)
      return false
    }
  }
  
  /**
   * Read from local storage
   */
  private async readFromLocalStorage(path: string): Promise<FileContent> {
    const key = this.storagePrefix + path
    const data = await this.storageService.get(key)
    
    if (!data) {
      throw new Error(`File not found: ${path}`)
    }
    
    return {
      path,
      content: data.content || '',
      metadata: data.metadata || {
        name: path.split('/').pop() || '',
        path,
        size: (data.content || '').length,
        lastModified: new Date(data.lastModified || Date.now()),
        isDirectory: false
      }
    }
  }
  
  /**
   * Write to local storage
   */
  private async writeToLocalStorage(path: string, content: string): Promise<void> {
    const key = this.storagePrefix + path
    const data = {
      content,
      lastModified: Date.now(),
      metadata: {
        name: path.split('/').pop() || '',
        path,
        size: content.length,
        lastModified: new Date(),
        isDirectory: false
      }
    }
    
    await this.storageService.set(key, data)
  }
  
  /**
   * Delete from local storage
   */
  private async deleteFromLocalStorage(path: string): Promise<void> {
    const key = this.storagePrefix + path
    await this.storageService.delete(key)
  }
  
  /**
   * List files from local storage
   */
  private async listFromLocalStorage(dirPath: string): Promise<FileMetadata[]> {
    const prefix = this.storagePrefix + dirPath
    const allKeys = await this.storageService.keys()
    
    const files: FileMetadata[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const path = key.substring(this.storagePrefix.length)
        const data = await this.storageService.get(key)
        
        if (data && data.metadata) {
          files.push(data.metadata)
        } else {
          // Create basic metadata if missing
          files.push({
            name: path.split('/').pop() || '',
            path,
            size: (data?.content || '').length,
            lastModified: new Date(data?.lastModified || Date.now()),
            isDirectory: false
          })
        }
      }
    }
    
    return files
  }
  
  /**
   * Check existence in local storage
   */
  private async existsInLocalStorage(path: string): Promise<boolean> {
    const key = this.storagePrefix + path
    const data = await this.storageService.get(key)
    return data !== null && data !== undefined
  }
}