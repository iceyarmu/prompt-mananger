/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWebDAVStore } from '@/composables/useWebDAVStore'

// Mock the credential manager
const mockCredentialManager = {
  encrypt: vi.fn().mockResolvedValue('encrypted-password'),
  decrypt: vi.fn().mockResolvedValue('decrypted-password'),
  storeCredentials: vi.fn().mockResolvedValue(undefined),
  getCredentials: vi.fn().mockResolvedValue({ password: 'encrypted-password' }),
  removeCredentials: vi.fn().mockResolvedValue(undefined)
}

vi.mock('@/utils/credentialManager', () => ({
  CredentialManager: vi.fn().mockImplementation(() => mockCredentialManager)
}))

// Mock WebDAV service
const mockWebDAVService = {
  testConnection: vi.fn().mockResolvedValue({
    success: true,
    responseTime: 150,
    serverInfo: 'Mock WebDAV Server'
  }),
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(false)
}

vi.mock('@prompt-optimizer/webdav', () => ({
  WebDAVService: vi.fn().mockImplementation(() => mockWebDAVService)
}))

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

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-1234'
  }
})

describe('useWebDAVStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('Store Initialization', () => {
    it('initializes with empty state', () => {
      const store = useWebDAVStore()
      
      expect(store.profiles).toEqual([])
      expect(store.activeProfile).toBeNull()
      expect(store.connectionStatus).toBe('disconnected')
      expect(store.isConnected).toBe(false)
    })

    it('loads profiles from localStorage', async () => {
      const mockProfiles = [
        {
          id: '1',
          name: 'Test Profile',
          url: 'https://test.com/webdav',
          username: 'user',
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      ]
      
      localStorageMock.setItem('webdav:profiles', JSON.stringify(mockProfiles))
      localStorageMock.setItem('webdav:active-profile', '1')
      
      const store = useWebDAVStore()
      await store.initialize()
      
      expect(store.profiles).toHaveLength(1)
      expect(store.profiles[0].name).toBe('Test Profile')
      expect(store.activeProfile?.id).toBe('1')
    })
  })

  describe('Profile Management', () => {
    it('saves a new profile', async () => {
      const store = useWebDAVStore()
      
      const newProfile = {
        name: 'New Profile',
        url: 'https://new.com/webdav',
        username: 'newuser',
        password: 'password123'
      }
      
      const savedProfile = await store.saveProfile(newProfile)
      
      expect(savedProfile.id).toBe('mock-uuid-1234')
      expect(savedProfile.name).toBe('New Profile')
      expect(store.profiles).toHaveLength(1)
      expect(mockCredentialManager.encrypt).toHaveBeenCalledWith('password123')
      expect(mockCredentialManager.storeCredentials).toHaveBeenCalled()
    })

    it('updates an existing profile', async () => {
      const store = useWebDAVStore()
      
      // First create a profile
      await store.saveProfile({
        name: 'Original Profile',
        url: 'https://original.com/webdav'
      })
      
      const profileId = store.profiles[0].id
      
      // Update the profile
      await store.updateProfile(profileId, {
        name: 'Updated Profile',
        url: 'https://updated.com/webdav',
        password: 'newpassword'
      })
      
      const updatedProfile = store.profiles[0]
      expect(updatedProfile.name).toBe('Updated Profile')
      expect(updatedProfile.url).toBe('https://updated.com/webdav')
      expect(mockCredentialManager.encrypt).toHaveBeenCalledWith('newpassword')
    })

    it('deletes a profile', async () => {
      const store = useWebDAVStore()
      
      // Create a profile
      await store.saveProfile({
        name: 'Profile to Delete',
        url: 'https://delete.com/webdav'
      })
      
      const profileId = store.profiles[0].id
      expect(store.profiles).toHaveLength(1)
      
      // Delete the profile
      await store.deleteProfile(profileId)
      
      expect(store.profiles).toHaveLength(0)
      expect(mockCredentialManager.removeCredentials).toHaveBeenCalledWith(`webdav:credentials:${profileId}`)
    })

    it('sets active profile', async () => {
      const store = useWebDAVStore()
      
      // Create a profile
      await store.saveProfile({
        name: 'Test Profile',
        url: 'https://test.com/webdav'
      })
      
      const profileId = store.profiles[0].id
      
      // Set as active
      await store.setActiveProfile(profileId)
      
      expect(store.activeProfile?.id).toBe(profileId)
      expect(store.activeProfile?.lastUsed).toBeInstanceOf(Date)
    })

    it('retrieves profile with decrypted credentials', async () => {
      const store = useWebDAVStore()
      
      // Create a profile with password
      await store.saveProfile({
        name: 'Secure Profile',
        url: 'https://secure.com/webdav',
        password: 'secret123'
      })
      
      const profileId = store.profiles[0].id
      const profileWithCredentials = await store.getProfileWithCredentials(profileId)
      
      expect(profileWithCredentials.password).toBe('decrypted-password')
      expect(mockCredentialManager.decrypt).toHaveBeenCalledWith('encrypted-password')
    })
  })

  describe('Connection Management', () => {
    it('tests connection successfully', async () => {
      const store = useWebDAVStore()
      
      const config = {
        url: 'https://test.com/webdav',
        username: 'user',
        password: 'pass'
      }
      
      const result = await store.testConnection(config)
      
      expect(result.success).toBe(true)
      expect(result.responseTime).toBe(150)
      expect(mockWebDAVService.testConnection).toHaveBeenCalledWith(config, 10000)
    })

    it('connects to WebDAV server with active profile', async () => {
      const store = useWebDAVStore()
      
      // Create and set active profile
      await store.saveProfile({
        name: 'Connect Profile',
        url: 'https://connect.com/webdav',
        username: 'user',
        password: 'pass'
      })
      
      const profileId = store.profiles[0].id
      await store.setActiveProfile(profileId)
      
      const connected = await store.connect()
      
      expect(connected).toBe(true)
      expect(store.connectionStatus).toBe('connected')
      expect(mockWebDAVService.connect).toHaveBeenCalled()
    })

    it('handles connection failure', async () => {
      const store = useWebDAVStore()
      
      // Mock connection failure
      mockWebDAVService.connect.mockResolvedValueOnce(false)
      
      // Create and set active profile
      await store.saveProfile({
        name: 'Fail Profile',
        url: 'https://fail.com/webdav'
      })
      
      const profileId = store.profiles[0].id
      await store.setActiveProfile(profileId)
      
      const connected = await store.connect()
      
      expect(connected).toBe(false)
      expect(store.connectionStatus).toBe('error')
    })

    it('disconnects from WebDAV server', async () => {
      const store = useWebDAVStore()
      
      // Set to connected state
      store.connectionStatus = 'connected'
      
      await store.disconnect()
      
      expect(store.connectionStatus).toBe('disconnected')
      expect(mockWebDAVService.disconnect).toHaveBeenCalled()
    })

    it('updates connection status based on service state', () => {
      const store = useWebDAVStore()
      
      // Mock service as connected
      mockWebDAVService.isConnected.mockReturnValueOnce(true)
      
      store.updateConnectionStatus()
      
      expect(store.connectionStatus).toBe('connected')
    })
  })

  describe('Error Handling', () => {
    it('handles profile save errors', async () => {
      const store = useWebDAVStore()
      
      // Mock localStorage error
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage full')
      })
      
      await expect(store.saveProfile({
        name: 'Error Profile',
        url: 'https://error.com/webdav'
      })).rejects.toThrow('Failed to save WebDAV profiles')
      
      localStorageMock.setItem = originalSetItem
    })

    it('handles profile not found error', async () => {
      const store = useWebDAVStore()
      
      await expect(store.updateProfile('nonexistent', { name: 'Updated' }))
        .rejects.toThrow('Profile with id nonexistent not found')
    })

    it('handles connection without active profile', async () => {
      const store = useWebDAVStore()
      
      await expect(store.connect()).rejects.toThrow('No profile specified for connection')
    })
  })

  describe('Local Storage Integration', () => {
    it('persists profiles to localStorage', async () => {
      const store = useWebDAVStore()
      
      await store.saveProfile({
        name: 'Persist Profile',
        url: 'https://persist.com/webdav'
      })
      
      const stored = JSON.parse(localStorageMock.getItem('webdav:profiles') || '[]')
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('Persist Profile')
    })

    it('persists active profile to localStorage', async () => {
      const store = useWebDAVStore()
      
      await store.saveProfile({
        name: 'Active Profile',
        url: 'https://active.com/webdav'
      })
      
      const profileId = store.profiles[0].id
      await store.setActiveProfile(profileId)
      
      expect(localStorageMock.getItem('webdav:active-profile')).toBe(profileId)
    })
  })
})