/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CredentialManager } from '@/utils/credentialManager'

// Mock crypto.subtle
const mockSubtle = {
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn()
}

const mockCrypto = {
  subtle: mockSubtle,
  getRandomValues: vi.fn()
}

Object.defineProperty(global, 'crypto', {
  value: mockCrypto
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock TextEncoder/TextDecoder
global.TextEncoder = vi.fn().mockImplementation(() => ({
  encode: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4]))
}))

global.TextDecoder = vi.fn().mockImplementation(() => ({
  decode: vi.fn().mockReturnValue('decoded-text')
}))

// Mock btoa/atob
global.btoa = vi.fn().mockImplementation((str) => Buffer.from(str, 'binary').toString('base64'))
global.atob = vi.fn().mockImplementation((str) => Buffer.from(str, 'base64').toString('binary'))

describe('CredentialManager', () => {
  let credentialManager: CredentialManager

  beforeEach(() => {
    credentialManager = new CredentialManager()
    localStorageMock.clear()
    vi.clearAllMocks()

    // Setup default crypto mocks
    mockCrypto.getRandomValues.mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i % 256
      }
      return arr
    })

    mockSubtle.importKey.mockResolvedValue('mock-imported-key')
    mockSubtle.deriveKey.mockResolvedValue('mock-derived-key')
    mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(16))
    mockSubtle.decrypt.mockResolvedValue(new ArrayBuffer(16))
  })

  describe('Static Methods', () => {
    it('checks if Web Crypto API is supported', () => {
      expect(CredentialManager.isSupported()).toBe(true)
    })

    it('returns false when crypto is not available', () => {
      const originalCrypto = global.crypto
      delete (global as any).crypto

      expect(CredentialManager.isSupported()).toBe(false)

      global.crypto = originalCrypto
    })
  })

  describe('Salt Management', () => {
    it('generates new salt when none exists', async () => {
      const manager = credentialManager as any
      const salt = await manager.getUserSalt()

      expect(salt).toBeInstanceOf(Uint8Array)
      expect(salt.length).toBe(16)
      expect(localStorageMock.getItem('webdav:encryption:salt')).toBeTruthy()
    })

    it('retrieves existing salt from localStorage', async () => {
      const existingSalt = '0102030405060708090a0b0c0d0e0f10'
      localStorageMock.setItem('webdav:encryption:salt', existingSalt)

      const manager = credentialManager as any
      const salt = await manager.getUserSalt()

      expect(salt).toBeInstanceOf(Uint8Array)
      expect(salt.length).toBe(16)
    })
  })

  describe('Key Derivation', () => {
    it('derives encryption key from browser data', async () => {
      const manager = credentialManager as any
      const key = await manager.deriveKey()

      expect(key).toBe('mock-derived-key')
      expect(mockSubtle.importKey).toHaveBeenCalled()
      expect(mockSubtle.deriveKey).toHaveBeenCalled()
    })

    it('caches derived key for reuse', async () => {
      const manager = credentialManager as any
      
      const key1 = await manager.deriveKey()
      const key2 = await manager.deriveKey()

      expect(key1).toBe(key2)
      expect(mockSubtle.deriveKey).toHaveBeenCalledTimes(1)
    })

    it('handles key derivation errors', async () => {
      mockSubtle.importKey.mockRejectedValue(new Error('Key import failed'))

      const manager = credentialManager as any
      await expect(manager.deriveKey()).rejects.toThrow('Failed to derive encryption key')
    })
  })

  describe('Encryption', () => {
    it('encrypts a string value', async () => {
      const testValue = 'test-password'
      
      const encrypted = await credentialManager.encrypt(testValue)

      expect(encrypted).toBeTypeOf('string')
      expect(mockSubtle.encrypt).toHaveBeenCalled()
      expect(global.btoa).toHaveBeenCalled()
    })

    it('generates random IV for each encryption', async () => {
      // Clear previous calls to getRandomValues (from salt generation, etc.)
      vi.clearAllMocks()
      
      await credentialManager.encrypt('test1')
      await credentialManager.encrypt('test2')

      // Should be called at least 2 times for the IVs (might be more due to salt generation)
      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array))
      expect(mockCrypto.getRandomValues.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('handles encryption errors', async () => {
      mockSubtle.encrypt.mockRejectedValue(new Error('Encryption failed'))

      await expect(credentialManager.encrypt('test')).rejects.toThrow('Failed to encrypt value')
    })
  })

  describe('Decryption', () => {
    it('decrypts an encrypted value', async () => {
      const encryptedValue = 'mock-encrypted-base64'
      
      const decrypted = await credentialManager.decrypt(encryptedValue)

      expect(decrypted).toBe('decoded-text')
      expect(mockSubtle.decrypt).toHaveBeenCalled()
      expect(global.atob).toHaveBeenCalledWith(encryptedValue)
    })

    it('handles decryption errors', async () => {
      mockSubtle.decrypt.mockRejectedValue(new Error('Decryption failed'))

      await expect(credentialManager.decrypt('invalid')).rejects.toThrow('Failed to decrypt value')
    })
  })

  describe('Credential Storage', () => {
    it('stores credentials in localStorage', async () => {
      const credentials = { password: 'encrypted-password' }
      const key = 'test-key'

      await credentialManager.storeCredentials(key, credentials)

      const stored = localStorageMock.getItem(key)
      expect(stored).toBe(JSON.stringify(credentials))
    })

    it('retrieves credentials from localStorage', async () => {
      const credentials = { password: 'encrypted-password' }
      const key = 'test-key'
      localStorageMock.setItem(key, JSON.stringify(credentials))

      const retrieved = await credentialManager.getCredentials(key)

      expect(retrieved).toEqual(credentials)
    })

    it('returns null for non-existent credentials', async () => {
      const retrieved = await credentialManager.getCredentials('non-existent')

      expect(retrieved).toBeNull()
    })

    it('removes credentials from localStorage', async () => {
      const key = 'test-key'
      localStorageMock.setItem(key, JSON.stringify({ password: 'test' }))

      await credentialManager.removeCredentials(key)

      expect(localStorageMock.getItem(key)).toBeNull()
    })

    it('handles storage errors', async () => {
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      await expect(credentialManager.storeCredentials('key', {}))
        .rejects.toThrow('Failed to store credentials')

      localStorageMock.setItem = originalSetItem
    })

    it('handles retrieval errors', async () => {
      localStorageMock.setItem('test-key', 'invalid-json')

      const result = await credentialManager.getCredentials('test-key')

      expect(result).toBeNull()
    })
  })

  describe('Key Management', () => {
    it('clears encryption keys', () => {
      const manager = credentialManager as any
      manager.encryptionKey = 'some-key'

      credentialManager.clearKeys()

      expect(manager.encryptionKey).toBeNull()
    })

    it('re-derives key after clearing', async () => {
      const manager = credentialManager as any
      
      // First derivation
      await manager.deriveKey()
      expect(mockSubtle.deriveKey).toHaveBeenCalledTimes(1)

      // Clear keys
      credentialManager.clearKeys()

      // Second derivation (should call deriveKey again)
      await manager.deriveKey()
      expect(mockSubtle.deriveKey).toHaveBeenCalledTimes(2)
    })
  })

  describe('Integration Tests', () => {
    it('performs full encrypt-decrypt cycle', async () => {
      // Setup realistic crypto mocks
      const mockEncrypted = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
      const mockDecrypted = new Uint8Array([116, 101, 115, 116]) // "test" in bytes

      mockSubtle.encrypt.mockResolvedValue(mockEncrypted.buffer)
      mockSubtle.decrypt.mockResolvedValue(mockDecrypted.buffer)

      // Mock TextEncoder/Decoder for realistic behavior
      const mockEncoder = { encode: vi.fn().mockReturnValue(mockDecrypted) }
      const mockDecoder = { decode: vi.fn().mockReturnValue('test') }
      
      global.TextEncoder = vi.fn().mockImplementation(() => mockEncoder)
      global.TextDecoder = vi.fn().mockImplementation(() => mockDecoder)

      const originalValue = 'test'
      
      // Encrypt
      const encrypted = await credentialManager.encrypt(originalValue)
      expect(encrypted).toBeTypeOf('string')
      
      // Decrypt
      const decrypted = await credentialManager.decrypt(encrypted)
      expect(decrypted).toBe('test')
    })
  })
})