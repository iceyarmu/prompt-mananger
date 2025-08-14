import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { PreferenceService } from '../services/ServiceRegistry'

export interface PreferenceState {
  // UI Settings
  theme: 'light' | 'dark' | 'auto'
  language: string
  showStatusBar: boolean
  showSidebar: boolean
  
  // Editor Settings
  fontSize: number
  wordWrap: boolean
  lineNumbers: boolean
  tabSize: number
  insertSpaces: boolean
  highlightActiveLine: boolean
  showInvisibles: boolean
  vimMode: boolean
  emmet: boolean
  minimap: boolean
  
  // System Settings
  autoSave: boolean
  autoSaveInterval: number
  enableTelemetry: boolean
  checkForUpdates: boolean
  defaultFileExtension: string
  
  // Legacy aliases for compatibility
  editorFontSize?: number
  editorWordWrap?: boolean
  showLineNumbers?: boolean
  enableVim?: boolean
  enableEmmet?: boolean
}

const DEFAULT_PREFERENCES: PreferenceState = {
  // UI Settings
  theme: 'auto',
  language: 'en',
  showStatusBar: true,
  showSidebar: true,
  
  // Editor Settings
  fontSize: 14,
  wordWrap: false,
  lineNumbers: true,
  tabSize: 2,
  insertSpaces: true,
  highlightActiveLine: true,
  showInvisibles: false,
  vimMode: false,
  emmet: true,
  minimap: true,
  
  // System Settings
  autoSave: false,
  autoSaveInterval: 30,
  enableTelemetry: false,
  checkForUpdates: true,
  defaultFileExtension: '.md'
}

export const usePreferenceStore = defineStore('preferences', () => {
  const preferences = ref<PreferenceState>({ ...DEFAULT_PREFERENCES })
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastSyncTime = ref<Date | null>(null)
  
  const editorPreferences = computed(() => ({
    fontSize: preferences.value.fontSize,
    wordWrap: preferences.value.wordWrap,
    lineNumbers: preferences.value.lineNumbers,
    tabSize: preferences.value.tabSize,
    insertSpaces: preferences.value.insertSpaces,
    highlightActiveLine: preferences.value.highlightActiveLine,
    showInvisibles: preferences.value.showInvisibles,
    vimMode: preferences.value.vimMode,
    emmet: preferences.value.emmet,
    minimap: preferences.value.minimap
  }))
  
  const uiPreferences = computed(() => ({
    theme: preferences.value.theme,
    language: preferences.value.language,
    showStatusBar: preferences.value.showStatusBar,
    showSidebar: preferences.value.showSidebar
  }))
  
  const systemPreferences = computed(() => ({
    autoSave: preferences.value.autoSave,
    autoSaveInterval: preferences.value.autoSaveInterval,
    enableTelemetry: preferences.value.enableTelemetry,
    checkForUpdates: preferences.value.checkForUpdates,
    defaultFileExtension: preferences.value.defaultFileExtension
  }))
  
  async function loadPreferences(preferenceService?: PreferenceService) {
    if (!preferenceService) {
      error.value = 'Preference service not available'
      return false
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      const allPrefs = await preferenceService.getAll()
      
      if (allPrefs) {
        Object.keys(DEFAULT_PREFERENCES).forEach(key => {
          if (key in allPrefs) {
            (preferences.value as any)[key] = allPrefs[key]
          }
        })
      }
      
      lastSyncTime.value = new Date()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load preferences'
      console.error('Failed to load preferences:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  async function savePreference<K extends keyof PreferenceState>(
    key: K,
    value: PreferenceState[K],
    preferenceService?: PreferenceService
  ) {
    if (!preferenceService) {
      error.value = 'Preference service not available'
      return false
    }
    
    const oldValue = preferences.value[key]
    preferences.value[key] = value
    
    try {
      await preferenceService.set(key, value)
      lastSyncTime.value = new Date()
      return true
    } catch (err) {
      preferences.value[key] = oldValue
      error.value = err instanceof Error ? err.message : 'Failed to save preference'
      console.error(`Failed to save preference ${key}:`, err)
      return false
    }
  }
  
  async function saveAllPreferences(preferenceService?: PreferenceService) {
    if (!preferenceService) {
      error.value = 'Preference service not available'
      return false
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      for (const [key, value] of Object.entries(preferences.value)) {
        await preferenceService.set(key, value)
      }
      lastSyncTime.value = new Date()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save preferences'
      console.error('Failed to save preferences:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  function updatePreference<K extends keyof PreferenceState>(key: K, value: PreferenceState[K]) {
    preferences.value[key] = value
  }
  
  function setPreference(key: string, value: any) {
    if (key in preferences.value) {
      (preferences.value as any)[key] = value
    }
  }
  
  function updateMultiplePreferences(updates: Partial<PreferenceState>) {
    Object.assign(preferences.value, updates)
  }
  
  function resetPreferences() {
    preferences.value = { ...DEFAULT_PREFERENCES }
  }
  
  function resetPreference<K extends keyof PreferenceState>(key: K) {
    preferences.value[key] = DEFAULT_PREFERENCES[key]
  }
  
  function getPreference<K extends keyof PreferenceState>(key: K): PreferenceState[K] {
    return preferences.value[key]
  }
  
  function getAllPreferences(): PreferenceState {
    return { ...preferences.value }
  }
  
  function setTheme(theme: PreferenceState['theme']) {
    updatePreference('theme', theme)
    applyTheme(theme)
  }
  
  function setLanguage(language: string) {
    updatePreference('language', language)
  }
  
  function toggleAutoSave() {
    updatePreference('autoSave', !preferences.value.autoSave)
  }
  
  function applyTheme(theme: PreferenceState['theme']) {
    const root = document.documentElement
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }
  
  function exportPreferences(): string {
    return JSON.stringify(preferences.value, null, 2)
  }
  
  function importPreferences(json: string): boolean {
    try {
      const imported = JSON.parse(json)
      const validatedPrefs: Partial<PreferenceState> = {}
      
      Object.keys(DEFAULT_PREFERENCES).forEach(key => {
        if (key in imported) {
          validatedPrefs[key as keyof PreferenceState] = imported[key]
        }
      })
      
      updateMultiplePreferences(validatedPrefs)
      return true
    } catch (err) {
      error.value = 'Invalid preferences format'
      console.error('Failed to import preferences:', err)
      return false
    }
  }
  
  watch(() => preferences.value.theme, (newTheme) => {
    applyTheme(newTheme)
  })
  
  return {
    preferences,
    isLoading,
    error,
    lastSyncTime,
    editorPreferences,
    uiPreferences,
    systemPreferences,
    loadPreferences,
    savePreference,
    saveAllPreferences,
    updatePreference,
    setPreference,
    updateMultiplePreferences,
    resetPreferences,
    resetPreference,
    getPreference,
    getAllPreferences,
    setTheme,
    setLanguage,
    toggleAutoSave,
    exportPreferences,
    importPreferences
  }
})