/**
 * WebDAV Service Types and Interfaces
 * Following the service pattern from packages/core/src/services/prompt/types.ts
 */

/**
 * WebDAV connection configuration interface
 */
export interface WebDAVConfig {
  /** WebDAV server URL (required) */
  url: string;
  /** Username for authentication (optional for anonymous access) */
  username?: string;
  /** Password for authentication (optional for anonymous access) */
  password?: string;
  /** Authentication type */
  authType?: 'none' | 'basic' | 'digest';
  /** Connection timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of concurrent connections (default: 5) */
  maxConnections?: number;
  /** Enable retry logic (default: true) */
  enableRetry?: boolean;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * File information interface
 */
export interface FileInfo {
  /** File name */
  name: string;
  /** Full file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Resource type */
  type: 'file' | 'directory';
  /** Last modified date */
  lastModified: Date;
  /** ETag for caching */
  etag?: string;
  /** MIME type */
  mimeType?: string;
  /** Whether the file is readable */
  readable?: boolean;
  /** Whether the file is writable */
  writable?: boolean;
}

/**
 * File content interface for file operations
 */
export interface FileContent {
  /** File path */
  path: string;
  /** File content as string */
  content: string;
  /** Content encoding (default: 'utf8') */
  encoding?: string;
  /** MIME type override */
  mimeType?: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  /** Whether connection was successful */
  success: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Server information if available */
  serverInfo?: string;
  /** Error message if connection failed */
  error?: string;
}

/**
 * WebDAV service interface following the service pattern
 */
export interface IWebDAVService {
  // Connection management
  /**
   * Connect to WebDAV server with configuration validation
   * @param config Connection configuration
   * @returns Promise<boolean> - true if connected successfully
   */
  connect(config: WebDAVConfig): Promise<boolean>;

  /**
   * Disconnect from WebDAV server and cleanup resources
   * @returns Promise<void>
   */
  disconnect(): Promise<void>;

  /**
   * Test connection to WebDAV server with timeout
   * @param config Connection configuration
   * @param timeoutMs Timeout in milliseconds (default: 10000)
   * @returns Promise<ConnectionTestResult>
   */
  testConnection(config: WebDAVConfig, timeoutMs?: number): Promise<ConnectionTestResult>;

  // File operations
  /**
   * Get file content from WebDAV server
   * @param path File path on server
   * @returns Promise<FileContent>
   */
  getFile(path: string): Promise<FileContent>;
  /**
   * Get partial file content from WebDAV server using range headers
   * @param path File path on server
   * @param start Start byte position
   * @param end End byte position (inclusive)
   * @returns Promise<string> - Partial file content
   */
  getFileRange?(path: string, start: number, end: number): Promise<string>;

  /**
   * Upload file to WebDAV server
   * @param fileContent File content to upload
   * @returns Promise<void>
   */
  putFile(fileContent: FileContent): Promise<void>;

  /**
   * Delete file from WebDAV server
   * @param path File path on server
   * @returns Promise<void>
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Move/rename file on WebDAV server
   * @param sourcePath Current file path
   * @param destinationPath New file path
   * @returns Promise<void>
   */
  moveFile(sourcePath: string, destinationPath: string): Promise<void>;

  // Folder operations
  /**
   * List folder contents with optional .md file filtering
   * @param path Folder path on server
   * @param filterMarkdown Only return .md files (default: false)
   * @returns Promise<FileInfo[]>
   */
  listFolder(path: string, filterMarkdown?: boolean): Promise<FileInfo[]>;

  /**
   * Create folder on WebDAV server
   * @param path Folder path on server
   * @param recursive Create parent folders if needed (default: true)
   * @returns Promise<void>
   */
  createFolder(path: string, recursive?: boolean): Promise<void>;

  /**
   * Delete folder from WebDAV server
   * @param path Folder path on server
   * @param force Delete non-empty folders (default: false)
   * @returns Promise<void>
   */
  deleteFolder(path: string, force?: boolean): Promise<void>;

  // Utility methods
  /**
   * Check if file or folder exists on WebDAV server
   * @param path Path to check
   * @returns Promise<boolean>
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file or folder information
   * @param path Path to check
   * @returns Promise<FileInfo>
   */
  getFileInfo(path: string): Promise<FileInfo>;

  /**
   * Check if service is currently connected
   * @returns boolean
   */
  isConnected(): boolean;
}

/**
 * WebDAV operation types for logging and error handling
 */
export type WebDAVOperation = 
  | 'connect'
  | 'disconnect'
  | 'testConnection'
  | 'getFile'
  | 'getFileRange'
  | 'putFile'
  | 'deleteFile'
  | 'moveFile'
  | 'listFolder'
  | 'createFolder'
  | 'deleteFolder'
  | 'exists'
  | 'getFileInfo';