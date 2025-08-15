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
  conflict?: {
    local: FileContent
    remote: FileContent
    detectedAt: Date
  }
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
  async write(path: string, content: string, checkConflict: boolean = false): Promise<FileOperationResult> {
    logger.debug('Writing file', { path, contentLength: content.length })
    
    // Check for conflicts if requested
    if (checkConflict) {
      const conflict = await this.detectConflict(path, content)
      if (conflict) {
        return {
          success: false,
          message: 'Conflict detected',
          error: new Error('CONFLICT'),
          conflict
        }
      }
    }
    
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
      // Test local storage - use correct IStorageProvider methods
      const testKey = `${this.storagePrefix}health-check`
      await this.storageService.setItem(testKey, 'test')
      await this.storageService.removeItem(testKey)
      
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
    const dataStr = await this.storageService.getItem(key)
    
    if (!dataStr) {
      throw new Error(`File not found: ${path}`)
    }
    
    const data = JSON.parse(dataStr)
    
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
    
    await this.storageService.setItem(key, JSON.stringify(data))
  }
  
  /**
   * Delete from local storage
   */
  private async deleteFromLocalStorage(path: string): Promise<void> {
    const key = this.storagePrefix + path
    await this.storageService.removeItem(key)
  }
  
  /**
   * List files from local storage
   */
  private async listFromLocalStorage(dirPath: string): Promise<FileMetadata[]> {
    const prefix = this.storagePrefix + dirPath
    // TODO: IStorageProvider doesn't have a keys() method - need to implement this properly
    const allKeys: string[] = [] // await this.storageService.keys()
    
    const files: FileMetadata[] = []
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const path = key.substring(this.storagePrefix.length)
        const dataStr = await this.storageService.getItem(key)
        
        if (dataStr) {
          const data = JSON.parse(dataStr)
          if (data.metadata) {
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
    }
    
    return files
  }
  
  /**
   * Check existence in local storage
   */
  private async existsInLocalStorage(path: string): Promise<boolean> {
    const key = this.storagePrefix + path
    const dataStr = await this.storageService.getItem(key)
    return dataStr !== null && dataStr !== undefined
  }
  
  /**
   * Create a new file
   */
  async createFile(path: string, content: string = ''): Promise<FileOperationResult> {
    logger.debug('Creating file', { path, contentLength: content.length })
    
    // Check if file already exists
    const fileExists = await this.exists(path)
    if (fileExists) {
      return {
        success: false,
        message: 'File already exists',
        error: new Error('File already exists')
      }
    }
    
    // Write the new file
    return this.write(path, content)
  }
  
  /**
   * Create a new folder
   */
  async createFolder(path: string): Promise<FileOperationResult> {
    logger.debug('Creating folder', { path })
    
    const results: FileOperationResult[] = []
    
    // Create folder in WebDAV if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          await this.webDAVService.createDirectory(path)
          logger.info('Folder created in WebDAV', { path })
          results.push({ success: true, message: 'Created in WebDAV' })
        }
      } catch (error) {
        logger.error('WebDAV folder creation failed', { path, error })
        results.push({ 
          success: false, 
          message: 'WebDAV folder creation failed', 
          error: error as Error 
        })
      }
    }
    
    // Create folder marker in local storage
    try {
      const key = this.storagePrefix + path + '/.folder'
      await this.storageService.setItem(key, JSON.stringify({
        isDirectory: true,
        created: Date.now()
      }))
      logger.info('Folder marker created in local storage', { path })
      results.push({ success: true, message: 'Created in local storage' })
    } catch (error) {
      logger.error('Local storage folder creation failed', { path, error })
      results.push({ 
        success: false, 
        message: 'Local storage folder creation failed', 
        error: error as Error 
      })
    }
    
    // Return success if at least one creation succeeded
    const anySuccess = results.some(r => r.success)
    return {
      success: anySuccess,
      message: results.map(r => r.message).join('; '),
      error: anySuccess ? undefined : results.find(r => r.error)?.error
    }
  }
  
  /**
   * Copy file to new location
   */
  async copy(sourcePath: string, destinationPath: string): Promise<FileOperationResult> {
    logger.debug('Copying file', { sourcePath, destinationPath })
    
    // Read source file
    let content: string
    try {
      const fileContent = await this.read(sourcePath)
      content = fileContent.content
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read source file',
        error: error as Error
      }
    }
    
    // Write to destination
    const writeResult = await this.write(destinationPath, content)
    if (writeResult.success) {
      logger.info('File copied successfully', { sourcePath, destinationPath })
    }
    
    return writeResult
  }
  
  /**
   * Duplicate file with auto-generated name
   */
  async duplicate(path: string): Promise<FileOperationResult> {
    logger.debug('Duplicating file', { path })
    
    // Generate duplicate filename
    const pathParts = path.split('/')
    const fileName = pathParts.pop() || ''
    const directory = pathParts.join('/') || '/'
    
    // Extract base name and extension
    const lastDotIndex = fileName.lastIndexOf('.')
    let baseName = fileName
    let extension = ''
    if (lastDotIndex > 0) {
      baseName = fileName.substring(0, lastDotIndex)
      extension = fileName.substring(lastDotIndex)
    }
    
    // Find unique name for duplicate
    let duplicateName = `${baseName}_copy${extension}`
    let duplicatePath = directory === '/' ? `/${duplicateName}` : `${directory}/${duplicateName}`
    let counter = 1
    
    while (await this.exists(duplicatePath)) {
      counter++
      duplicateName = `${baseName}_copy_${counter}${extension}`
      duplicatePath = directory === '/' ? `/${duplicateName}` : `${directory}/${duplicateName}`
    }
    
    // Copy to duplicate path
    const result = await this.copy(path, duplicatePath)
    if (result.success) {
      result.message = `File duplicated as ${duplicateName}`
    }
    
    return result
  }
  
  /**
   * Detect conflicts between local and remote versions
   */
  private async detectConflict(path: string, newContent: string): Promise<FileOperationResult['conflict'] | null> {
    try {
      // Get local version
      let localContent: FileContent | null = null
      try {
        localContent = await this.readFromLocalStorage(path)
      } catch {
        // No local version, no conflict
      }
      
      // Get remote version
      let remoteContent: FileContent | null = null
      if (this.webDAVService) {
        try {
          const connectionStatus = this.webDAVService.getConnectionStatus()
          if (connectionStatus.connected) {
            const content = await this.webDAVService.readFile(path)
            remoteContent = {
              path,
              content,
              metadata: {
                name: path.split('/').pop() || '',
                path,
                size: content.length,
                lastModified: new Date(),
                isDirectory: false
              }
            }
          }
        } catch {
          // No remote version or error reading
        }
      }
      
      // Check for conflict
      if (localContent && remoteContent) {
        // If both exist and are different from new content
        if (localContent.content !== newContent && 
            remoteContent.content !== newContent &&
            localContent.content !== remoteContent.content) {
          return {
            local: localContent,
            remote: remoteContent,
            detectedAt: new Date()
          }
        }
      }
      
      return null
    } catch (error) {
      logger.warn('Error detecting conflict', { path, error })
      return null
    }
  }
  
  /**
   * Resolve a conflict by choosing a version
   */
  async resolveConflict(
    path: string, 
    resolution: 'local' | 'remote' | 'both' | 'custom',
    customContent?: string
  ): Promise<FileOperationResult> {
    logger.info('Resolving conflict', { path, resolution })
    
    let contentToWrite: string
    
    switch (resolution) {
      case 'local':
        const localContent = await this.readFromLocalStorage(path)
        contentToWrite = localContent.content
        break
        
      case 'remote':
        if (!this.webDAVService) {
          return {
            success: false,
            message: 'WebDAV not available',
            error: new Error('WebDAV not available')
          }
        }
        contentToWrite = await this.webDAVService.readFile(path)
        break
        
      case 'both':
        // Keep both versions with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const basePath = path.substring(0, path.lastIndexOf('.'))
        const extension = path.substring(path.lastIndexOf('.'))
        const conflictPath = `${basePath}_conflict_${timestamp}${extension}`
        
        // Save local version with timestamp
        const local = await this.readFromLocalStorage(path)
        await this.write(conflictPath, local.content)
        
        // Use remote version for main file
        if (!this.webDAVService) {
          return {
            success: false,
            message: 'WebDAV not available',
            error: new Error('WebDAV not available')
          }
        }
        contentToWrite = await this.webDAVService.readFile(path)
        break
        
      case 'custom':
        if (!customContent) {
          return {
            success: false,
            message: 'Custom content required',
            error: new Error('Custom content required')
          }
        }
        contentToWrite = customContent
        break
        
      default:
        return {
          success: false,
          message: 'Invalid resolution type',
          error: new Error('Invalid resolution type')
        }
    }
    
    // Write without conflict check to force update
    return this.write(path, contentToWrite, false)
  }
  
  /**
   * Get file metadata
   */
  async getMetadata(path: string): Promise<FileMetadata> {
    logger.debug('Getting file metadata', { path })
    
    // Try WebDAV first if available
    if (this.webDAVService) {
      try {
        const connectionStatus = this.webDAVService.getConnectionStatus()
        if (connectionStatus.connected) {
          const stats = await this.webDAVService.getFileStat(path)
          return {
            name: path.split('/').pop() || '',
            path,
            size: stats.size,
            lastModified: stats.lastModified,
            isDirectory: stats.isDirectory,
            contentType: stats.contentType
          }
        }
      } catch (error) {
        logger.warn('WebDAV metadata fetch failed', { path, error })
      }
    }
    
    // Fallback to local storage
    const key = this.storagePrefix + path
    const dataStr = await this.storageService.getItem(key)
    
    if (!dataStr) {
      throw new Error(`File not found: ${path}`)
    }
    
    const data = JSON.parse(dataStr)
    return data.metadata || {
      name: path.split('/').pop() || '',
      path,
      size: (data.content || '').length,
      lastModified: new Date(data.lastModified || Date.now()),
      isDirectory: false
    }
  }
}