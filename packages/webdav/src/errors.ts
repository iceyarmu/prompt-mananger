/**
 * WebDAV Service Error Classes
 * Following the error pattern from packages/core/src/services/prompt/errors.ts
 */

/**
 * WebDAV error codes for different scenarios
 */
export enum WebDAVErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  INVALID_URL = 'INVALID_URL',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  
  // File operation errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INVALID_PATH = 'INVALID_PATH',
  
  // Folder operation errors
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  FOLDER_NOT_EMPTY = 'FOLDER_NOT_EMPTY',
  FOLDER_ALREADY_EXISTS = 'FOLDER_ALREADY_EXISTS',
  
  // Content errors
  INVALID_CONTENT = 'INVALID_CONTENT',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  ENCODING_ERROR = 'ENCODING_ERROR',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  
  // Service errors
  SERVICE_NOT_CONNECTED = 'SERVICE_NOT_CONNECTED',
  SERVICE_DEPENDENCY_ERROR = 'SERVICE_DEPENDENCY_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  
  // Request errors
  INVALID_REQUEST = 'INVALID_REQUEST'
}

/**
 * Base WebDAV error class extending Error
 */
export class WebDAVError extends Error {
  constructor(
    message: string,
    public code: WebDAVErrorCode,
    public details?: any,
    public operation?: string,
    public path?: string
  ) {
    super(message);
    this.name = 'WebDAVError';
  }

  /**
   * Get user-friendly error message
   * @returns string - User-friendly error message
   */
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case WebDAVErrorCode.CONNECTION_FAILED:
        return 'Unable to connect to the WebDAV server. Please check the server URL and network connection.';
      
      case WebDAVErrorCode.CONNECTION_TIMEOUT:
        return 'Connection to the WebDAV server timed out. Please check your network connection and try again.';
      
      case WebDAVErrorCode.AUTHENTICATION_FAILED:
        return 'Authentication failed. Please check your username and password.';
      
      case WebDAVErrorCode.INVALID_CONFIG:
        return 'WebDAV configuration is invalid. Please check the server URL and settings.';
      
      case WebDAVErrorCode.FILE_NOT_FOUND:
        return `File not found: ${this.path || 'Unknown path'}`;
      
      case WebDAVErrorCode.FILE_ALREADY_EXISTS:
        return `File already exists: ${this.path || 'Unknown path'}`;
      
      case WebDAVErrorCode.FOLDER_NOT_FOUND:
        return `Folder not found: ${this.path || 'Unknown path'}`;
      
      case WebDAVErrorCode.FOLDER_NOT_EMPTY:
        return `Cannot delete non-empty folder: ${this.path || 'Unknown path'}`;
      
      case WebDAVErrorCode.INSUFFICIENT_PERMISSIONS:
        return 'Insufficient permissions to perform this operation.';
      
      case WebDAVErrorCode.INVALID_PATH:
        return `Invalid file path: ${this.path || 'Unknown path'}`;
      
      case WebDAVErrorCode.QUOTA_EXCEEDED:
        return 'Server storage quota exceeded. Please free up space or contact your administrator.';
      
      case WebDAVErrorCode.SERVICE_NOT_CONNECTED:
        return 'WebDAV service is not connected. Please connect to the server first.';
      
      default:
        return this.message;
    }
  }
}

/**
 * Connection-specific WebDAV error
 */
export class WebDAVConnectionError extends WebDAVError {
  constructor(
    message: string,
    public serverUrl: string,
    details?: any
  ) {
    super(
      message,
      WebDAVErrorCode.CONNECTION_FAILED,
      details,
      'connect',
      serverUrl
    );
    this.name = 'WebDAVConnectionError';
  }
}

/**
 * Authentication-specific WebDAV error
 */
export class WebDAVAuthenticationError extends WebDAVError {
  constructor(
    message: string,
    public serverUrl: string,
    public username?: string
  ) {
    super(
      message,
      WebDAVErrorCode.AUTHENTICATION_FAILED,
      { serverUrl, username },
      'authenticate',
      serverUrl
    );
    this.name = 'WebDAVAuthenticationError';
  }
}

/**
 * File operation-specific WebDAV error
 */
export class WebDAVFileError extends WebDAVError {
  constructor(
    message: string,
    code: WebDAVErrorCode,
    public filePath: string,
    public operation: string,
    details?: any
  ) {
    super(message, code, details, operation, filePath);
    this.name = 'WebDAVFileError';
  }
}

/**
 * Folder operation-specific WebDAV error
 */
export class WebDAVFolderError extends WebDAVError {
  constructor(
    message: string,
    code: WebDAVErrorCode,
    public folderPath: string,
    public operation: string,
    details?: any
  ) {
    super(message, code, details, operation, folderPath);
    this.name = 'WebDAVFolderError';
  }
}

/**
 * Configuration-specific WebDAV error
 */
export class WebDAVConfigError extends WebDAVError {
  constructor(
    message: string,
    public configField?: string,
    details?: any
  ) {
    super(
      message,
      WebDAVErrorCode.INVALID_CONFIG,
      details,
      'configure'
    );
    this.name = 'WebDAVConfigError';
  }
}

/**
 * Service dependency error for WebDAV service
 */
export class WebDAVServiceDependencyError extends WebDAVError {
  constructor(
    message: string,
    public serviceName: string
  ) {
    super(
      message,
      WebDAVErrorCode.SERVICE_DEPENDENCY_ERROR,
      { serviceName },
      'checkDependencies'
    );
    this.name = 'WebDAVServiceDependencyError';
  }
}

/**
 * Helper function to create appropriate WebDAV error from HTTP status
 * @param status HTTP status code
 * @param message Error message
 * @param operation Operation being performed
 * @param path File/folder path
 * @returns WebDAVError - Appropriate error type
 */
export function createWebDAVErrorFromStatus(
  status: number,
  message: string,
  operation: string,
  path?: string
): WebDAVError {
  switch (status) {
    case 401:
      return new WebDAVAuthenticationError(message, path || '');
    case 403:
      return new WebDAVError(message, WebDAVErrorCode.INSUFFICIENT_PERMISSIONS, { status }, operation, path);
    case 404:
      const code = operation.includes('folder') || operation.includes('directory') 
        ? WebDAVErrorCode.FOLDER_NOT_FOUND 
        : WebDAVErrorCode.FILE_NOT_FOUND;
      return new WebDAVError(message, code, { status }, operation, path);
    case 405:
      return new WebDAVError(message, WebDAVErrorCode.METHOD_NOT_ALLOWED, { status }, operation, path);
    case 409:
      return new WebDAVError(message, WebDAVErrorCode.FILE_ALREADY_EXISTS, { status }, operation, path);
    case 413:
      return new WebDAVError(message, WebDAVErrorCode.CONTENT_TOO_LARGE, { status }, operation, path);
    case 507:
      return new WebDAVError(message, WebDAVErrorCode.QUOTA_EXCEEDED, { status }, operation, path);
    case 500:
    case 502:
    case 503:
    case 504:
      return new WebDAVError(message, WebDAVErrorCode.SERVER_ERROR, { status }, operation, path);
    default:
      return new WebDAVError(message, WebDAVErrorCode.OPERATION_FAILED, { status }, operation, path);
  }
}