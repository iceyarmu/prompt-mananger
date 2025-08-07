/**
 * WebDAV Service Implementation
 * Following the service pattern from packages/core/src/services/prompt/service.ts
 */

import { createClient, WebDAVClient, FileStat } from 'webdav';
import { 
  IWebDAVService, 
  WebDAVConfig, 
  FileInfo, 
  FileContent, 
  ConnectionTestResult,
  WebDAVOperation 
} from './types';
import { 
  WebDAVError, 
  WebDAVErrorCode, 
  WebDAVConnectionError,
  WebDAVAuthenticationError,
  WebDAVFileError,
  WebDAVFolderError,
  WebDAVConfigError,
  WebDAVServiceDependencyError,
  createWebDAVErrorFromStatus
} from './errors';

/**
 * WebDAV Service Implementation
 * Provides WebDAV connectivity with connection management, file operations, and error handling
 */
export class WebDAVService implements IWebDAVService {
  private client: WebDAVClient | null = null;
  private config: WebDAVConfig | null = null;
  private connected: boolean = false;
  private connectionPool: Map<string, WebDAVClient> = new Map();

  constructor() {
    this.checkDependencies();
  }

  /**
   * Check dependencies as per service pattern
   * @private
   */
  private checkDependencies(): void {
    // WebDAV service has no external dependencies to validate
    // This method follows the pattern from existing services
    if (typeof createClient !== 'function') {
      throw new WebDAVServiceDependencyError(
        'WebDAV client library not available',
        'webdav'
      );
    }
  }

  /**
   * Validate WebDAV configuration
   * @private
   * @param config - Configuration to validate
   */
  private validateConfig(config: WebDAVConfig): void {
    if (!config) {
      throw new WebDAVConfigError('Configuration is required');
    }

    if (!config.url || typeof config.url !== 'string') {
      throw new WebDAVConfigError('Valid URL is required', 'url');
    }

    if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      throw new WebDAVConfigError('URL must start with http:// or https://', 'url');
    }

    // Validate authentication settings
    if (config.authType === 'basic' || config.authType === 'digest') {
      if (!config.username) {
        throw new WebDAVConfigError('Username is required for authentication', 'username');
      }
      if (!config.password) {
        throw new WebDAVConfigError('Password is required for authentication', 'password');
      }
    }

    // Validate numeric settings
    if (config.timeout && (config.timeout < 1000 || config.timeout > 120000)) {
      throw new WebDAVConfigError('Timeout must be between 1000 and 120000 milliseconds', 'timeout');
    }

    if (config.maxConnections && (config.maxConnections < 1 || config.maxConnections > 20)) {
      throw new WebDAVConfigError('Maximum connections must be between 1 and 20', 'maxConnections');
    }

    if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
      throw new WebDAVConfigError('Maximum retries must be between 0 and 10', 'maxRetries');
    }
  }

  /**
   * Validate file path to prevent directory traversal and other security issues
   * @private
   * @param path - Path to validate
   * @param operation - Operation being performed for error context
   */
  private validatePath(path: string, operation: string): void {
    if (!path || typeof path !== 'string') {
      throw new WebDAVError(
        'Path is required and must be a string',
        WebDAVErrorCode.INVALID_PATH,
        { path },
        operation,
        path
      );
    }

    // Prevent directory traversal attacks
    if (path.includes('..') || path.includes('\\')) {
      throw new WebDAVError(
        'Path contains invalid characters',
        WebDAVErrorCode.INVALID_PATH,
        { path },
        operation,
        path
      );
    }

    // Ensure path starts with forward slash
    if (!path.startsWith('/')) {
      throw new WebDAVError(
        'Path must start with forward slash',
        WebDAVErrorCode.INVALID_PATH,
        { path },
        operation,
        path
      );
    }
  }

  /**
   * Create WebDAV client with configuration
   * @private
   * @param config - WebDAV configuration
   * @returns WebDAVClient
   */
  private createWebDAVClient(config: WebDAVConfig): WebDAVClient {
    const clientOptions: any = {
      timeout: config.timeout || 30000,
    };

    // Add authentication if specified
    if (config.authType && config.authType !== 'none') {
      clientOptions.username = config.username;
      clientOptions.password = config.password;
      clientOptions.authType = config.authType;
    }

    return createClient(config.url, clientOptions);
  }

  /**
   * Handle WebDAV operation errors and convert to appropriate WebDAVError
   * @private
   * @param error - Original error
   * @param operation - Operation that failed
   * @param path - Path involved in operation
   */
  private handleError(error: any, operation: WebDAVOperation, path?: string): never {
    console.error(`WebDAV ${operation} error:`, error);

    // Handle HTTP status errors
    if (error.status || error.response?.status) {
      const status = error.status || error.response.status;
      const message = error.message || error.response?.statusText || 'WebDAV operation failed';
      throw createWebDAVErrorFromStatus(status, message, operation, path);
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new WebDAVConnectionError(
        `Cannot connect to WebDAV server: ${error.message}`,
        this.config?.url || 'Unknown URL',
        { originalError: error }
      );
    }

    // Handle timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      throw new WebDAVError(
        'Operation timed out',
        WebDAVErrorCode.CONNECTION_TIMEOUT,
        { originalError: error },
        operation,
        path
      );
    }

    // Handle authentication errors
    if (error.message?.toLowerCase().includes('auth') || error.code === 'ENOTFOUND' && this.config?.username) {
      throw new WebDAVAuthenticationError(
        'Authentication failed. Please check your username and password.',
        this.config?.url || 'Unknown URL',
        this.config?.username
      );
    }

    // Generic error handling
    throw new WebDAVError(
      error.message || 'WebDAV operation failed',
      WebDAVErrorCode.OPERATION_FAILED,
      { originalError: error },
      operation,
      path
    );
  }

  /**
   * Log WebDAV operations (similar to console logging in existing services)
   * @private
   * @param operation - Operation being performed
   * @param details - Operation details
   */
  private logOperation(operation: WebDAVOperation, details?: any): void {
    console.log(`WebDAV ${operation}:`, details || '');
  }

  // === Connection Management ===

  /**
   * Connect to WebDAV server with configuration validation
   */
  async connect(config: WebDAVConfig): Promise<boolean> {
    try {
      this.validateConfig(config);
      
      this.logOperation('connect', { url: config.url, authType: config.authType });

      // Create and test client connection
      const client = this.createWebDAVClient(config);
      
      // Test connection by trying to get root directory info
      await client.stat('/');
      
      // Store successful configuration and client
      this.config = config;
      this.client = client;
      this.connected = true;

      this.logOperation('connect', 'Connected successfully');
      return true;

    } catch (error) {
      this.connected = false;
      this.client = null;
      this.config = null;
      
      // Don't re-wrap validation errors
      if (error instanceof WebDAVError) {
        throw error;
      }
      this.handleError(error, 'connect', config?.url);
    }
  }

  /**
   * Disconnect from WebDAV server and cleanup resources
   */
  async disconnect(): Promise<void> {
    try {
      this.logOperation('disconnect', 'Cleaning up connections');

      // Clear connection pool
      this.connectionPool.clear();

      // Reset state
      this.client = null;
      this.config = null;
      this.connected = false;

      this.logOperation('disconnect', 'Disconnected successfully');

    } catch (error) {
      // Ensure state is cleaned up even if cleanup fails
      this.client = null;
      this.config = null;
      this.connected = false;
      this.connectionPool.clear();
      
      this.handleError(error, 'disconnect');
    }
  }

  /**
   * Test connection to WebDAV server with timeout
   */
  async testConnection(config: WebDAVConfig, timeoutMs: number = 10000): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      this.validateConfig(config);
      
      this.logOperation('testConnection', { url: config.url, timeout: timeoutMs });

      // Create temporary client for testing
      const testClient = this.createWebDAVClient({ ...config, timeout: timeoutMs });
      
      // Test connection with root directory stat
      const stat = await testClient.stat('/');
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        serverInfo: `WebDAV server responding (${stat ? 'OK' : 'No response'})`
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Return detailed error information without throwing
      let errorMessage = 'Unknown error';
      if (error instanceof WebDAVError) {
        errorMessage = error.getUserFriendlyMessage();
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      return {
        success: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Check if service is currently connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  // === File Operations ===

  /**
   * Get file content from WebDAV server
   */
  async getFile(path: string): Promise<FileContent> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'getFile',
        path
      );
    }

    try {
      this.validatePath(path, 'getFile');
      this.logOperation('getFile', { path });

      const content = await this.client!.getFileContents(path, { format: 'text' }) as string;
      
      // Get file info for additional metadata
      const stat = await this.client!.stat(path) as FileStat;
      
      return {
        path,
        content,
        encoding: 'utf8',
        mimeType: stat.mime || 'text/plain'
      };

    } catch (error) {
      this.handleError(error, 'getFile', path);
    }
  }

  /**
   * Get partial file content from WebDAV server using range headers
   * @param path - File path on server
   * @param start - Start byte position
   * @param end - End byte position (inclusive)
   * @returns Partial file content as string
   */
  async getFileRange(path: string, start: number, end: number): Promise<string> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'getFileRange',
        path
      );
    }

    try {
      this.validatePath(path, 'getFileRange');
      this.logOperation('getFileRange', { path, start, end });

      // Validate range parameters
      if (start < 0 || end < 0) {
        throw new WebDAVError(
          'Invalid range: start and end must be non-negative',
          WebDAVErrorCode.INVALID_REQUEST,
          null,
          'getFileRange',
          path
        );
      }

      if (start > end) {
        throw new WebDAVError(
          'Invalid range: start must be less than or equal to end',
          WebDAVErrorCode.INVALID_REQUEST,
          null,
          'getFileRange',
          path
        );
      }

      // Use the getFileContents method with range headers
      const headers = {
        'Range': `bytes=${start}-${end}`
      };

      const content = await this.client!.getFileContents(path, { 
        format: 'text',
        headers 
      }) as string;
      
      return content;

    } catch (error) {
      this.handleError(error, 'getFileRange', path);
    }
  }

  /**
   * Upload file to WebDAV server
   */
  async putFile(fileContent: FileContent): Promise<void> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'putFile',
        fileContent.path
      );
    }

    try {
      this.validatePath(fileContent.path, 'putFile');
      
      if (!fileContent.content) {
        throw new WebDAVError(
          'File content is required',
          WebDAVErrorCode.INVALID_CONTENT,
          { fileContent },
          'putFile',
          fileContent.path
        );
      }

      this.logOperation('putFile', { path: fileContent.path, size: fileContent.content.length });

      const options: any = {};
      if (fileContent.mimeType) {
        options.headers = { 'Content-Type': fileContent.mimeType };
      }

      await this.client!.putFileContents(fileContent.path, fileContent.content, options);

    } catch (error) {
      this.handleError(error, 'putFile', fileContent.path);
    }
  }

  /**
   * Delete file from WebDAV server
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'deleteFile',
        path
      );
    }

    try {
      this.validatePath(path, 'deleteFile');
      
      // Check if file exists first
      const exists = await this.exists(path);
      if (!exists) {
        throw new WebDAVFileError(
          `File not found: ${path}`,
          WebDAVErrorCode.FILE_NOT_FOUND,
          path,
          'deleteFile'
        );
      }

      // Verify it's a file, not a directory
      const stat = await this.client!.stat(path) as FileStat;
      if (stat.type === 'directory') {
        throw new WebDAVError(
          `Path is a directory, not a file: ${path}`,
          WebDAVErrorCode.INVALID_PATH,
          { stat },
          'deleteFile',
          path
        );
      }

      this.logOperation('deleteFile', { path });
      await this.client!.deleteFile(path);

    } catch (error) {
      // Don't re-wrap already wrapped errors
      if (error instanceof WebDAVError) {
        throw error;
      }
      this.handleError(error, 'deleteFile', path);
    }
  }

  /**
   * Move/rename file on WebDAV server
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'moveFile',
        sourcePath
      );
    }

    try {
      this.validatePath(sourcePath, 'moveFile');
      this.validatePath(destinationPath, 'moveFile');
      
      // Check if source file exists
      const sourceExists = await this.exists(sourcePath);
      if (!sourceExists) {
        throw new WebDAVFileError(
          `Source file not found: ${sourcePath}`,
          WebDAVErrorCode.FILE_NOT_FOUND,
          sourcePath,
          'moveFile'
        );
      }

      // Check if destination already exists
      const destExists = await this.exists(destinationPath);
      if (destExists) {
        throw new WebDAVFileError(
          `Destination file already exists: ${destinationPath}`,
          WebDAVErrorCode.FILE_ALREADY_EXISTS,
          destinationPath,
          'moveFile'
        );
      }

      this.logOperation('moveFile', { from: sourcePath, to: destinationPath });
      await this.client!.moveFile(sourcePath, destinationPath);

    } catch (error) {
      // Don't re-wrap already wrapped errors
      if (error instanceof WebDAVError) {
        throw error;
      }
      this.handleError(error, 'moveFile', sourcePath);
    }
  }

  // === Folder Operations ===

  /**
   * List folder contents with optional .md file filtering
   */
  async listFolder(path: string, filterMarkdown: boolean = false): Promise<FileInfo[]> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'listFolder',
        path
      );
    }

    try {
      this.validatePath(path, 'listFolder');
      this.logOperation('listFolder', { path, filterMarkdown });

      const contents = await this.client!.getDirectoryContents(path) as FileStat[];
      
      let fileInfos: FileInfo[] = contents.map(stat => {
        return {
          name: stat.basename,
          path: stat.filename,
          size: stat.size || 0,
          type: stat.type === 'directory' ? 'directory' : 'file',
          lastModified: new Date(stat.lastmod || Date.now()),
          etag: stat.etag || undefined,
          mimeType: stat.mime,
          readable: true, // WebDAV typically allows reading
          writable: true  // WebDAV typically allows writing
        };
      });

      // Filter for .md files if requested
      if (filterMarkdown) {
        fileInfos = fileInfos.filter(info => 
          info.type === 'file' && info.name.toLowerCase().endsWith('.md')
        );
      }

      return fileInfos;

    } catch (error) {
      this.handleError(error, 'listFolder', path);
    }
  }

  /**
   * Create folder on WebDAV server
   */
  async createFolder(path: string, recursive: boolean = true): Promise<void> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'createFolder',
        path
      );
    }

    try {
      this.validatePath(path, 'createFolder');
      
      // Check if folder already exists
      const exists = await this.exists(path);
      if (exists) {
        const stat = await this.client!.stat(path) as FileStat;
        if (stat.type === 'directory') {
          // Folder already exists, this is not an error
          return;
        } else {
          throw new WebDAVFolderError(
            `Path exists but is a file, not a folder: ${path}`,
            WebDAVErrorCode.FILE_ALREADY_EXISTS,
            path,
            'createFolder'
          );
        }
      }

      this.logOperation('createFolder', { path, recursive });

      if (recursive) {
        // Create parent directories if they don't exist
        await this.client!.createDirectory(path, { recursive: true });
      } else {
        await this.client!.createDirectory(path);
      }

    } catch (error) {
      // Don't re-wrap already wrapped errors
      if (error instanceof WebDAVError) {
        throw error;
      }
      this.handleError(error, 'createFolder', path);
    }
  }

  /**
   * Delete folder from WebDAV server
   */
  async deleteFolder(path: string, force: boolean = false): Promise<void> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'deleteFolder',
        path
      );
    }

    try {
      this.validatePath(path, 'deleteFolder');
      
      // Check if folder exists
      const exists = await this.exists(path);
      if (!exists) {
        throw new WebDAVFolderError(
          `Folder not found: ${path}`,
          WebDAVErrorCode.FOLDER_NOT_FOUND,
          path,
          'deleteFolder'
        );
      }

      // Verify it's a directory, not a file
      const stat = await this.client!.stat(path) as FileStat;
      if (stat.type !== 'directory') {
        throw new WebDAVError(
          `Path is a file, not a directory: ${path}`,
          WebDAVErrorCode.INVALID_PATH,
          { stat },
          'deleteFolder',
          path
        );
      }

      // Check if folder is empty (unless force is true)
      if (!force) {
        const contents = await this.client!.getDirectoryContents(path) as FileStat[];
        if (contents.length > 0) {
          throw new WebDAVFolderError(
            `Folder is not empty: ${path}. Use force=true to delete non-empty folders.`,
            WebDAVErrorCode.FOLDER_NOT_EMPTY,
            path,
            'deleteFolder'
          );
        }
      }

      this.logOperation('deleteFolder', { path, force });
      await this.client!.deleteFile(path); // WebDAV uses same method for files and directories

    } catch (error) {
      // Don't re-wrap already wrapped errors
      if (error instanceof WebDAVError) {
        throw error;
      }
      this.handleError(error, 'deleteFolder', path);
    }
  }

  // === Utility Methods ===

  /**
   * Check if file or folder exists on WebDAV server
   */
  async exists(path: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'exists',
        path
      );
    }

    try {
      this.validatePath(path, 'exists');
      
      await this.client!.stat(path);
      return true;

    } catch (error: any) {
      // 404 status means the file/folder doesn't exist
      if (error.status === 404 || error.response?.status === 404) {
        return false;
      }
      
      // Other errors should be propagated
      this.handleError(error, 'exists', path);
    }
  }

  /**
   * Get file or folder information
   */
  async getFileInfo(path: string): Promise<FileInfo> {
    if (!this.isConnected()) {
      throw new WebDAVError(
        'Service not connected',
        WebDAVErrorCode.SERVICE_NOT_CONNECTED,
        null,
        'getFileInfo',
        path
      );
    }

    try {
      this.validatePath(path, 'getFileInfo');
      this.logOperation('getFileInfo', { path });

      const stat = await this.client!.stat(path) as FileStat;
      
      return {
        name: stat.basename,
        path: stat.filename,
        size: stat.size || 0,
        type: stat.type === 'directory' ? 'directory' : 'file',
        lastModified: new Date(stat.lastmod || Date.now()),
        etag: stat.etag || undefined,
        mimeType: stat.mime,
        readable: true, // WebDAV typically allows reading
        writable: true  // WebDAV typically allows writing
      };

    } catch (error) {
      this.handleError(error, 'getFileInfo', path);
    }
  }
}