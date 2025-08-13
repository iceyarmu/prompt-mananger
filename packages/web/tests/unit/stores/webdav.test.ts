import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWebDAVStore } from '../../../src/stores/webdav'

vi.mock('@prompt-optimizer/webdav', () => ({
  WebDAVService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false),
    testConnection: vi.fn().mockResolvedValue({
      success: true,
      message: 'Connection successful',
      statusCode: 200
    })
  }))
}))

vi.mock('../../../src/utils/credentialManager', () => ({
  CredentialManager: vi.fn().mockImplementation(() => ({
    encrypt: vi.fn().mockImplementation((value) => `encrypted_${value}`),
    decrypt: vi.fn().mockImplementation((value) => value.replace('encrypted_', '')),
    storeCredentials: vi.fn().mockResolvedValue(undefined),
    getCredentials: vi.fn().mockResolvedValue(null),
    removeCredentials: vi.fn().mockResolvedValue(undefined)
  }))
}))

describe('WebDAV Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const store = useWebDAVStore()
    
    expect(store.profiles).toEqual([])
    expect(store.activeProfile).toBe(null)
    expect(store.connectionStatus).toBe('disconnected')
    expect(store.connectionError).toBe(null)
    expect(store.retryCount).toBe(0)
    expect(store.maxRetries).toBe(3)
    expect(store.isConnected).toBe(false)
    expect(store.isConnecting).toBe(false)
    expect(store.hasProfiles).toBe(false)
  })

  it('should save and load profiles', async () => {
    const store = useWebDAVStore()
    
    const profile = await store.saveProfile({
      name: 'Test Profile',
      url: 'http://test.webdav',
      username: 'testuser'
    })
    
    expect(profile.id).toBeDefined()
    expect(profile.name).toBe('Test Profile')
    expect(profile.url).toBe('http://test.webdav')
    expect(profile.username).toBe('testuser')
    expect(store.profiles).toHaveLength(1)
    expect(store.hasProfiles).toBe(true)
    
    // Simulate reload
    const newStore = useWebDAVStore()
    await newStore.initialize()
    
    expect(newStore.profiles).toHaveLength(1)
    expect(newStore.profiles[0].name).toBe('Test Profile')
  })

  it('should update profile', async () => {
    const store = useWebDAVStore()
    
    const profile = await store.saveProfile({
      name: 'Original Name',
      url: 'http://test.webdav',
      username: 'testuser'
    })
    
    await store.updateProfile(profile.id, {
      name: 'Updated Name',
      url: 'http://updated.webdav'
    })
    
    expect(store.profiles[0].name).toBe('Updated Name')
    expect(store.profiles[0].url).toBe('http://updated.webdav')
    expect(store.profiles[0].lastUsed).toBeDefined()
  })

  it('should delete profile', async () => {
    const store = useWebDAVStore()
    
    const profile1 = await store.saveProfile({ name: 'Profile 1', url: 'http://test1.webdav' })
    const profile2 = await store.saveProfile({ name: 'Profile 2', url: 'http://test2.webdav' })
    
    expect(store.profiles).toHaveLength(2)
    
    await store.deleteProfile(profile1.id)
    
    expect(store.profiles).toHaveLength(1)
    expect(store.profiles[0].name).toBe('Profile 2')
  })

  it('should set active profile', async () => {
    const store = useWebDAVStore()
    
    const profile = await store.saveProfile({
      name: 'Test Profile',
      url: 'http://test.webdav'
    })
    
    await store.setActiveProfile(profile.id)
    
    expect(store.activeProfile).toBeDefined()
    expect(store.activeProfile?.id).toBe(profile.id)
    expect(store.activeProfile?.lastUsed).toBeDefined()
  })

  it('should connect to WebDAV', async () => {
    const store = useWebDAVStore()
    
    const profile = await store.saveProfile({
      name: 'Test Profile',
      url: 'http://test.webdav',
      username: 'testuser',
      password: 'testpass'
    })
    
    await store.setActiveProfile(profile.id)
    const connected = await store.connect()
    
    expect(connected).toBe(true)
    expect(store.connectionStatus).toBe('connected')
    expect(store.isConnected).toBe(true)
    expect(store.connectionError).toBe(null)
  })

  it('should handle connection errors', async () => {
    const store = useWebDAVStore()
    
    const profile = await store.saveProfile({
      name: 'Test Profile',
      url: 'http://test.webdav'
    })
    
    await store.setActiveProfile(profile.id)
    
    // Mock connection failure
    const { WebDAVService } = await import('@prompt-optimizer/webdav')
    const mockService = new (WebDAVService as any)()
    mockService.connect.mockResolvedValueOnce(false)
    
    const connected = await store.connect()
    
    expect(connected).toBe(false)
    expect(store.connectionStatus).toBe('error')
    expect(store.isConnected).toBe(false)
    expect(store.connectionError).toBe('Failed to connect to WebDAV server')
  })

  it('should disconnect from WebDAV', async () => {
    const store = useWebDAVStore()
    
    store.connectionStatus = 'connected'
    store.connectionError = 'Some error'
    store.retryCount = 2
    
    await store.disconnect()
    
    expect(store.connectionStatus).toBe('disconnected')
    expect(store.connectionError).toBe(null)
    expect(store.retryCount).toBe(0)
  })

  it('should handle reconnection with retry limit', async () => {
    const store = useWebDAVStore()
    
    const profile = await store.saveProfile({
      name: 'Test Profile',
      url: 'http://test.webdav'
    })
    
    await store.setActiveProfile(profile.id)
    store.setMaxRetries(2)
    
    // First reconnect attempt
    await store.reconnect()
    expect(store.retryCount).toBe(1)
    
    // Second reconnect attempt
    await store.reconnect()
    expect(store.retryCount).toBe(2)
    
    // Third attempt should fail (exceeds max retries)
    const result = await store.reconnect()
    expect(result).toBe(false)
    expect(store.connectionError).toBe('Maximum retry attempts reached')
  })

  it('should test connection', async () => {
    const store = useWebDAVStore()
    
    const result = await store.testConnection({
      url: 'http://test.webdav',
      username: 'testuser',
      password: 'testpass',
      timeout: 5000
    })
    
    expect(result.success).toBe(true)
    expect(result.message).toBe('Connection successful')
    expect(result.statusCode).toBe(200)
  })
})