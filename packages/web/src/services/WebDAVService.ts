import { createLogger } from '../utils/logger'
import type { WebDAVConfig } from '../types/application'

const logger = createLogger('WebDAVService')

export interface WebDAVFile {
  filename: string
  path: string
  size: number
  lastModified: Date
  isDirectory: boolean
  contentType?: string
}

export interface WebDAVConnectionStatus {
  connected: boolean
  url: string
  lastChecked: Date
  error?: string
}

export class WebDAVService {
  private config: WebDAVConfig
  private connectionStatus: WebDAVConnectionStatus
  private authHeader: string

  constructor(config: WebDAVConfig) {
    this.config = config
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`)
    this.connectionStatus = {
      connected: false,
      url: config.url,
      lastChecked: new Date()
    }
    logger.info('WebDAVService constructed', { url: config.url })
  }

  /**
   * Initialize WebDAV connection
   */
  async init(): Promise<void> {
    logger.debug('Initializing WebDAV connection', { url: this.config.url })
    
    try {
      // Test connection with OPTIONS request
      const response = await this.makeRequest('/', {
        method: 'OPTIONS'
      })

      if (response.ok) {
        this.connectionStatus = {
          connected: true,
          url: this.config.url,
          lastChecked: new Date()
        }
        logger.info('WebDAV connection established successfully')
      } else {
        throw new Error(`WebDAV server responded with status ${response.status}`)
      }
    } catch (error) {
      const message = `Failed to connect to WebDAV server: ${(error as Error).message}`
      this.connectionStatus = {
        connected: false,
        url: this.config.url,
        lastChecked: new Date(),
        error: message
      }
      logger.error(message, error)
      throw new Error(message)
    }
  }

  /**
   * Check WebDAV connection health
   */
  async checkHealth(): Promise<boolean> {
    logger.debug('Checking WebDAV connection health')
    
    try {
      const response = await this.makeRequest('/', {
        method: 'OPTIONS'
      }, 5000) // 5 second timeout for health check

      const healthy = response.ok
      this.connectionStatus = {
        connected: healthy,
        url: this.config.url,
        lastChecked: new Date(),
        error: healthy ? undefined : `Health check failed with status ${response.status}`
      }

      logger.debug('WebDAV health check completed', { healthy })
      return healthy
    } catch (error) {
      const message = `Health check failed: ${(error as Error).message}`
      this.connectionStatus = {
        connected: false,
        url: this.config.url,
        lastChecked: new Date(),
        error: message
      }
      logger.warn(message)
      return false
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): WebDAVConnectionStatus {
    return { ...this.connectionStatus }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = '/'): Promise<WebDAVFile[]> {
    logger.debug('Listing files', { path })
    
    const response = await this.makeRequest(path, {
      method: 'PROPFIND',
      headers: {
        'Depth': '1',
        'Content-Type': 'application/xml'
      },
      body: `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:">
          <d:prop>
            <d:displayname/>
            <d:getcontentlength/>
            <d:getlastmodified/>
            <d:getcontenttype/>
            <d:resourcetype/>
          </d:prop>
        </d:propfind>`
    })

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    return this.parsePropfindResponse(text, path)
  }

  /**
   * Read file content
   */
  async readFile(path: string): Promise<string> {
    logger.debug('Reading file', { path })
    
    const response = await this.makeRequest(path, {
      method: 'GET'
    })

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status} ${response.statusText}`)
    }

    return response.text()
  }

  /**
   * Write file content
   */
  async writeFile(path: string, content: string): Promise<void> {
    logger.debug('Writing file', { path, contentLength: content.length })
    
    const response = await this.makeRequest(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: content
    })

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to write file: ${response.status} ${response.statusText}`)
    }

    logger.info('File written successfully', { path })
  }

  /**
   * Delete file or directory
   */
  async deleteFile(path: string): Promise<void> {
    logger.debug('Deleting file', { path })
    
    const response = await this.makeRequest(path, {
      method: 'DELETE'
    })

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete file: ${response.status} ${response.statusText}`)
    }

    logger.info('File deleted successfully', { path })
  }

  /**
   * Create directory
   */
  async createDirectory(path: string): Promise<void> {
    logger.debug('Creating directory', { path })
    
    const response = await this.makeRequest(path, {
      method: 'MKCOL'
    })

    if (!response.ok && response.status !== 201) {
      throw new Error(`Failed to create directory: ${response.status} ${response.statusText}`)
    }

    logger.info('Directory created successfully', { path })
  }

  /**
   * Move/rename file or directory
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    logger.debug('Moving file', { sourcePath, destinationPath })
    
    const destinationUrl = new URL(destinationPath, this.config.url).toString()
    
    const response = await this.makeRequest(sourcePath, {
      method: 'MOVE',
      headers: {
        'Destination': destinationUrl,
        'Overwrite': 'F'
      }
    })

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to move file: ${response.status} ${response.statusText}`)
    }

    logger.info('File moved successfully', { sourcePath, destinationPath })
  }

  /**
   * Copy file or directory
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    logger.debug('Copying file', { sourcePath, destinationPath })
    
    const destinationUrl = new URL(destinationPath, this.config.url).toString()
    
    const response = await this.makeRequest(sourcePath, {
      method: 'COPY',
      headers: {
        'Destination': destinationUrl,
        'Overwrite': 'F'
      }
    })

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`Failed to copy file: ${response.status} ${response.statusText}`)
    }

    logger.info('File copied successfully', { sourcePath, destinationPath })
  }

  /**
   * Check if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    logger.debug('Checking file existence', { path })
    
    try {
      const response = await this.makeRequest(path, {
        method: 'HEAD'
      })

      return response.ok
    } catch (error) {
      logger.debug('File does not exist', { path })
      return false
    }
  }

  /**
   * Make WebDAV request with authentication
   */
  private async makeRequest(
    path: string, 
    options: RequestInit, 
    timeout: number = 30000
  ): Promise<Response> {
    const url = new URL(path, this.config.url).toString()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': this.authHeader,
          ...options.headers
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw error
    }
  }

  /**
   * Parse PROPFIND XML response
   */
  private parsePropfindResponse(xml: string, basePath: string): WebDAVFile[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    
    // Check for parse errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      logger.error('Failed to parse WebDAV XML response', { error: parseError.textContent })
      throw new Error('Invalid XML response from WebDAV server')
    }
    
    const responses = doc.getElementsByTagNameNS('DAV:', 'response')
    const files: WebDAVFile[] = []

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i]
      const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || ''
      
      // Skip the directory itself (first entry)
      if (i === 0 && href.endsWith(basePath)) {
        continue
      }

      const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0]
      if (!propstat) continue

      const prop = propstat.getElementsByTagNameNS('DAV:', 'prop')[0]
      if (!prop) continue

      const displayName = prop.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent || ''
      const contentLength = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent || '0'
      const lastModified = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || ''
      const contentType = prop.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent
      const resourceType = prop.getElementsByTagNameNS('DAV:', 'resourcetype')[0]
      const isDirectory = !!resourceType?.getElementsByTagNameNS('DAV:', 'collection')[0]
      
      // Validate and parse size safely
      const size = parseInt(contentLength, 10)
      if (isNaN(size) || size < 0) {
        logger.warn('Invalid file size in WebDAV response', { path: href, contentLength })
      }
      
      // Validate date parsing
      let parsedDate = new Date()
      if (lastModified) {
        const tempDate = new Date(lastModified)
        if (!isNaN(tempDate.getTime())) {
          parsedDate = tempDate
        } else {
          logger.warn('Invalid date in WebDAV response', { path: href, lastModified })
        }
      }

      files.push({
        filename: displayName || href.split('/').pop() || '',
        path: href,
        size: isNaN(size) ? 0 : size,
        lastModified: parsedDate,
        isDirectory,
        contentType
      })
    }

    return files
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('WebDAVService cleanup completed')
  }
}