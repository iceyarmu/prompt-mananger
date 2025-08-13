/**
 * CredentialManager - Secure credential encryption and storage utility
 * Uses Web Crypto API for encryption with user-specific key derivation
 */

export interface EncryptedCredentials {
  password?: string
  [key: string]: string | undefined
}

export class CredentialManager {
  private static readonly ALGORITHM = 'AES-GCM'
  private static readonly KEY_LENGTH = 256
  private static readonly IV_LENGTH = 12
  private static readonly SALT_KEY = 'webdav:encryption:salt'
  private static readonly ITERATIONS = 100000

  private encryptionKey: CryptoKey | null = null

  /**
   * Get or generate user-specific salt for key derivation
   */
  private async getUserSalt(): Promise<Uint8Array> {
    let salt = localStorage.getItem(CredentialManager.SALT_KEY)
    
    if (!salt) {
      // Generate new salt
      const saltArray = crypto.getRandomValues(new Uint8Array(16))
      salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(CredentialManager.SALT_KEY, salt)
    }
    
    return new Uint8Array(
      salt.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    )
  }

  /**
   * Derive encryption key from browser-specific data and salt
   */
  private async deriveKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey
    }

    try {
      // Create key material from browser-specific data
      const userAgent = navigator.userAgent
      const language = navigator.language
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const keyMaterial = `${userAgent}:${language}:${timezone}`

      const encoder = new TextEncoder()
      const keyMaterialBuffer = encoder.encode(keyMaterial)

      // Import the key material
      const importedKey = await crypto.subtle.importKey(
        'raw',
        keyMaterialBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )

      // Get user salt
      const salt = await this.getUserSalt()

      // Derive the actual encryption key
      this.encryptionKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: CredentialManager.ITERATIONS,
          hash: 'SHA-256'
        },
        importedKey,
        {
          name: CredentialManager.ALGORITHM,
          length: CredentialManager.KEY_LENGTH
        },
        false,
        ['encrypt', 'decrypt']
      )

      return this.encryptionKey
    } catch (error) {
      console.error('Failed to derive encryption key:', error)
      throw new Error('Failed to derive encryption key')
    }
  }

  /**
   * Encrypt a string value
   */
  async encrypt(value: string): Promise<string> {
    try {
      const key = await this.deriveKey()
      const encoder = new TextEncoder()
      const data = encoder.encode(value)
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(CredentialManager.IV_LENGTH))
      
      // Encrypt the data
      const encrypted = await crypto.subtle.encrypt(
        {
          name: CredentialManager.ALGORITHM,
          iv: iv
        },
        key,
        data
      )
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength)
      combined.set(iv, 0)
      combined.set(new Uint8Array(encrypted), iv.length)
      
      // Convert to base64 - use Array.from to avoid stack overflow with large data
      const combinedArray = Array.from(combined)
      let binary = ''
      for (let i = 0; i < combinedArray.length; i += 8192) {
        const chunk = combinedArray.slice(i, i + 8192)
        binary += String.fromCharCode(...chunk)
      }
      return btoa(binary)
    } catch (error) {
      console.error('Failed to encrypt value:', error)
      throw new Error('Failed to encrypt value')
    }
  }

  /**
   * Decrypt a string value
   */
  async decrypt(encryptedValue: string): Promise<string> {
    try {
      const key = await this.deriveKey()
      
      // Convert from base64 - use chunking to avoid stack overflow
      const binaryString = atob(encryptedValue)
      const combined = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i)
      }
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, CredentialManager.IV_LENGTH)
      const encrypted = combined.slice(CredentialManager.IV_LENGTH)
      
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: CredentialManager.ALGORITHM,
          iv: iv
        },
        key,
        encrypted
      )
      
      // Convert back to string
      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      console.error('Failed to decrypt value:', error)
      throw new Error('Failed to decrypt value')
    }
  }

  /**
   * Store encrypted credentials in localStorage
   */
  async storeCredentials(key: string, credentials: EncryptedCredentials): Promise<void> {
    try {
      // Validate key format
      if (!key || typeof key !== 'string' || key.length > 100) {
        throw new Error('Invalid credential key format')
      }
      
      // Validate credentials object
      if (!credentials || typeof credentials !== 'object') {
        throw new Error('Invalid credentials format')
      }
      
      // Validate individual credential values
      for (const [prop, value] of Object.entries(credentials)) {
        if (value !== undefined && typeof value !== 'string') {
          throw new Error(`Invalid credential value for ${prop}: must be string or undefined`)
        }
        
        // Prevent storing extremely large values
        if (value && value.length > 10000) {
          throw new Error(`Credential value for ${prop} exceeds maximum length`)
        }
      }
      
      localStorage.setItem(key, JSON.stringify(credentials))
    } catch (error) {
      console.error('Failed to store credentials:', error)
      throw error instanceof Error ? error : new Error('Failed to store credentials')
    }
  }

  /**
   * Retrieve encrypted credentials from localStorage
   */
  async getCredentials(key: string): Promise<EncryptedCredentials | null> {
    try {
      const stored = localStorage.getItem(key)
      if (!stored) {
        return null
      }
      return JSON.parse(stored)
    } catch (error) {
      console.error('Failed to retrieve credentials:', error)
      return null
    }
  }

  /**
   * Remove credentials from localStorage
   */
  async removeCredentials(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to remove credentials:', error)
      throw new Error('Failed to remove credentials')
    }
  }

  /**
   * Clear all encryption keys and force re-derivation
   */
  clearKeys(): void {
    this.encryptionKey = null
  }

  /**
   * Check if Web Crypto API is available
   */
  static isSupported(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.getRandomValues === 'function'
    )
  }
}