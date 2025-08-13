import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WebDAVService, type WebDAVConfig, type ConnectionTestResult } from '@prompt-optimizer/webdav'
import { CredentialManager } from '../utils/credentialManager'

export interface WebDAVProfile {
  id: string
  name: string
  url: string
  username?: string
  password?: string
  createdAt: Date
  lastUsed?: Date
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const STORAGE_KEYS = {
  PROFILES: 'webdav:profiles',
  ACTIVE_PROFILE: 'webdav:active-profile',
  CREDENTIALS_PREFIX: 'webdav:credentials:'
} as const

export const useWebDAVStore = defineStore('webdav', () => {
  const profiles = ref<WebDAVProfile[]>([])
  const activeProfile = ref<WebDAVProfile | null>(null)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const connectionError = ref<string | null>(null)
  const retryCount = ref(0)
  const maxRetries = ref(3)
  
  const webdavService = new WebDAVService()
  const credentialManager = new CredentialManager()

  const isConnected = computed(() => connectionStatus.value === 'connected')
  const isConnecting = computed(() => connectionStatus.value === 'connecting')
  const hasProfiles = computed(() => profiles.value.length > 0)
  const currentUrl = computed(() => activeProfile.value?.url || null)
  const currentUsername = computed(() => activeProfile.value?.username || null)

  const loadProfiles = async (): Promise<void> => {
    try {
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES)
      if (storedProfiles) {
        const parsedProfiles = JSON.parse(storedProfiles)
        profiles.value = parsedProfiles.map((profile: any) => ({
          ...profile,
          createdAt: new Date(profile.createdAt),
          lastUsed: profile.lastUsed ? new Date(profile.lastUsed) : undefined
        }))
      }

      const activeProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE)
      if (activeProfileId) {
        activeProfile.value = profiles.value.find(p => p.id === activeProfileId) || null
      }
    } catch (error) {
      console.error('Failed to load WebDAV profiles:', error)
      profiles.value = []
      activeProfile.value = null
    }
  }

  const saveProfiles = async (): Promise<void> => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles.value))
      if (activeProfile.value) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, activeProfile.value.id)
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE)
      }
    } catch (error) {
      console.error('Failed to save WebDAV profiles:', error)
      throw new Error('Failed to save WebDAV profiles')
    }
  }

  const saveProfile = async (profile: Omit<WebDAVProfile, 'id' | 'createdAt' | 'lastUsed'>): Promise<WebDAVProfile> => {
    const newProfile: WebDAVProfile = {
      ...profile,
      id: crypto.randomUUID(),
      createdAt: new Date()
    }

    if (newProfile.password) {
      const encryptedPassword = await credentialManager.encrypt(newProfile.password)
      await credentialManager.storeCredentials(
        `${STORAGE_KEYS.CREDENTIALS_PREFIX}${newProfile.id}`,
        { password: encryptedPassword }
      )
      delete newProfile.password
    }

    profiles.value.push(newProfile)
    await saveProfiles()

    return newProfile
  }

  const updateProfile = async (id: string, updates: Partial<Omit<WebDAVProfile, 'id' | 'createdAt'>>): Promise<void> => {
    const profileIndex = profiles.value.findIndex(p => p.id === id)
    if (profileIndex === -1) {
      throw new Error(`Profile with id ${id} not found`)
    }

    const profile = profiles.value[profileIndex]
    
    if (updates.password) {
      const encryptedPassword = await credentialManager.encrypt(updates.password)
      await credentialManager.storeCredentials(
        `${STORAGE_KEYS.CREDENTIALS_PREFIX}${id}`,
        { password: encryptedPassword }
      )
      delete updates.password
    }

    profiles.value[profileIndex] = {
      ...profile,
      ...updates,
      lastUsed: new Date()
    }

    if (activeProfile.value?.id === id) {
      activeProfile.value = profiles.value[profileIndex]
    }

    await saveProfiles()
  }

  const deleteProfile = async (id: string): Promise<void> => {
    const profileIndex = profiles.value.findIndex(p => p.id === id)
    if (profileIndex === -1) {
      throw new Error(`Profile with id ${id} not found`)
    }

    try {
      await credentialManager.removeCredentials(`${STORAGE_KEYS.CREDENTIALS_PREFIX}${id}`)
    } catch (error) {
      console.warn('Failed to remove credentials for profile:', error)
    }

    profiles.value.splice(profileIndex, 1)

    if (activeProfile.value?.id === id) {
      activeProfile.value = null
      connectionStatus.value = 'disconnected'
    }

    await saveProfiles()
  }

  const setActiveProfile = async (id: string): Promise<void> => {
    const profile = profiles.value.find(p => p.id === id)
    if (!profile) {
      throw new Error(`Profile with id ${id} not found`)
    }

    activeProfile.value = {
      ...profile,
      lastUsed: new Date()
    }

    const profileIndex = profiles.value.findIndex(p => p.id === id)
    if (profileIndex !== -1) {
      profiles.value[profileIndex].lastUsed = new Date()
    }

    await saveProfiles()
  }

  const getProfileWithCredentials = async (id: string): Promise<WebDAVProfile & { password?: string }> => {
    const profile = profiles.value.find(p => p.id === id)
    if (!profile) {
      throw new Error(`Profile with id ${id} not found`)
    }

    try {
      const credentials = await credentialManager.getCredentials(`${STORAGE_KEYS.CREDENTIALS_PREFIX}${id}`)
      let password: string | undefined
      
      if (credentials?.password) {
        password = await credentialManager.decrypt(credentials.password)
      }

      return {
        ...profile,
        password
      }
    } catch (error) {
      console.warn('Failed to decrypt credentials for profile:', error)
      return profile
    }
  }

  const testConnection = async (config: WebDAVConfig): Promise<ConnectionTestResult> => {
    return await webdavService.testConnection(config, 10000)
  }

  const connect = async (profileId?: string): Promise<boolean> => {
    let targetProfile = activeProfile.value

    if (profileId) {
      targetProfile = profiles.value.find(p => p.id === profileId) || null
    }

    if (!targetProfile) {
      throw new Error('No profile specified for connection')
    }

    connectionStatus.value = 'connecting'
    connectionError.value = null
    retryCount.value = 0

    try {
      const profileWithCredentials = await getProfileWithCredentials(targetProfile.id)
      
      const config: WebDAVConfig = {
        url: profileWithCredentials.url,
        username: profileWithCredentials.username,
        password: profileWithCredentials.password,
        timeout: 30000,
        maxRetries: maxRetries.value
      }

      const connected = await webdavService.connect(config)
      
      if (connected) {
        connectionStatus.value = 'connected'
        connectionError.value = null
        if (profileId) {
          await setActiveProfile(profileId)
        }
      } else {
        connectionStatus.value = 'error'
        connectionError.value = 'Failed to connect to WebDAV server'
      }

      return connected
    } catch (error) {
      connectionStatus.value = 'error'
      connectionError.value = error instanceof Error ? error.message : 'Connection failed'
      console.error('Failed to connect to WebDAV server:', error)
      throw error
    }
  }

  const disconnect = async (): Promise<void> => {
    try {
      await webdavService.disconnect()
    } catch (error) {
      console.warn('Error during WebDAV disconnect:', error)
    } finally {
      connectionStatus.value = 'disconnected'
      connectionError.value = null
      retryCount.value = 0
    }
  }

  const reconnect = async (): Promise<boolean> => {
    if (!activeProfile.value) {
      throw new Error('No active profile to reconnect')
    }

    if (retryCount.value >= maxRetries.value) {
      connectionError.value = 'Maximum retry attempts reached'
      return false
    }

    retryCount.value++
    return await connect(activeProfile.value.id)
  }

  const updateConnectionStatus = (): void => {
    if (webdavService.isConnected()) {
      connectionStatus.value = 'connected'
    } else {
      connectionStatus.value = 'disconnected'
    }
  }

  const initialize = async (): Promise<void> => {
    await loadProfiles()
    updateConnectionStatus()
  }

  const clearConnectionError = () => {
    connectionError.value = null
  }

  const setMaxRetries = (count: number) => {
    maxRetries.value = count
  }

  return {
    profiles,
    activeProfile,
    connectionStatus,
    connectionError,
    retryCount,
    maxRetries,
    isConnected,
    isConnecting,
    hasProfiles,
    currentUrl,
    currentUsername,
    initialize,
    saveProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    getProfileWithCredentials,
    testConnection,
    connect,
    disconnect,
    reconnect,
    updateConnectionStatus,
    clearConnectionError,
    setMaxRetries
  }
})

export const webdavStore = useWebDAVStore