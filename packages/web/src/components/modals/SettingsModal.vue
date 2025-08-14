<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="settings-modal-overlay"
      @click="handleOverlayClick"
      @keydown.escape="handleClose"
    >
      <div class="settings-modal" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Settings</h2>
          <button
            @click="handleClose"
            class="close-button"
            aria-label="Close settings"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="modal-content">
          <!-- Editor Settings Tab -->
          <div v-if="activeTab === 'editor'" class="tab-panel">
            <h3 class="section-title">Editor Settings</h3>
            
            <div class="setting-group">
              <label for="fontSize" class="setting-label">Font Size</label>
              <input
                id="fontSize"
                type="number"
                v-model.number="localSettings.fontSize"
                min="10"
                max="24"
                class="setting-input"
              />
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.lineNumbers"
                  class="setting-checkbox"
                />
                Show Line Numbers
              </label>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.wordWrap"
                  class="setting-checkbox"
                />
                Word Wrap
              </label>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.minimap"
                  class="setting-checkbox"
                />
                Show Minimap
              </label>
            </div>

            <div class="setting-group">
              <label for="tabSize" class="setting-label">Tab Size</label>
              <input
                id="tabSize"
                type="number"
                v-model.number="localSettings.tabSize"
                min="2"
                max="8"
                class="setting-input"
              />
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.vimMode"
                  class="setting-checkbox"
                />
                Enable Vim Mode
              </label>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.emmet"
                  class="setting-checkbox"
                />
                Enable Emmet
              </label>
            </div>
          </div>

          <!-- UI Settings Tab -->
          <div v-if="activeTab === 'ui'" class="tab-panel">
            <h3 class="section-title">UI Settings</h3>
            
            <div class="setting-group">
              <label for="theme" class="setting-label">Theme</label>
              <select
                id="theme"
                v-model="localSettings.theme"
                class="setting-select"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>

            <div class="setting-group">
              <label for="language" class="setting-label">Language</label>
              <select
                id="language"
                v-model="localSettings.language"
                class="setting-select"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.showStatusBar"
                  class="setting-checkbox"
                />
                Show Status Bar
              </label>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.showSidebar"
                  class="setting-checkbox"
                />
                Show Sidebar by Default
              </label>
            </div>
          </div>

          <!-- System Settings Tab -->
          <div v-if="activeTab === 'system'" class="tab-panel">
            <h3 class="section-title">System Settings</h3>
            
            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.autoSave"
                  class="setting-checkbox"
                />
                Enable Auto-Save
              </label>
            </div>

            <div class="setting-group" v-if="localSettings.autoSave">
              <label for="autoSaveInterval" class="setting-label">Auto-Save Interval (seconds)</label>
              <input
                id="autoSaveInterval"
                type="number"
                v-model.number="localSettings.autoSaveInterval"
                min="10"
                max="300"
                class="setting-input"
              />
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.enableTelemetry"
                  class="setting-checkbox"
                />
                Enable Anonymous Usage Statistics
              </label>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="localSettings.checkForUpdates"
                  class="setting-checkbox"
                />
                Automatically Check for Updates
              </label>
            </div>

            <div class="setting-group">
              <label for="defaultFileExtension" class="setting-label">Default File Extension</label>
              <input
                id="defaultFileExtension"
                type="text"
                v-model="localSettings.defaultFileExtension"
                placeholder=".md"
                class="setting-input"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            @click="handleReset"
            class="btn-secondary"
          >
            Reset to Defaults
          </button>
          <div class="footer-buttons">
            <button
              @click="handleClose"
              class="btn-secondary"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              class="btn-primary"
              :disabled="!hasChanges"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePreferenceStore } from '../../stores/preferences'
import { storeBus } from '../../stores/communication'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const preferenceStore = usePreferenceStore()

const tabs = [
  { id: 'editor', label: 'Editor' },
  { id: 'ui', label: 'UI' },
  { id: 'system', label: 'System' }
]

const activeTab = ref('editor')

// Local copy of settings for editing
const localSettings = ref({
  // Editor settings
  fontSize: 14,
  lineNumbers: true,
  wordWrap: false,
  minimap: true,
  tabSize: 2,
  vimMode: false,
  emmet: true,
  
  // UI settings
  theme: 'auto' as 'light' | 'dark' | 'auto',
  language: 'en',
  showStatusBar: true,
  showSidebar: true,
  
  // System settings
  autoSave: false,
  autoSaveInterval: 30,
  enableTelemetry: false,
  checkForUpdates: true,
  defaultFileExtension: '.md'
})

// Original settings for comparison
const originalSettings = ref<typeof localSettings.value>({} as typeof localSettings.value)

const hasChanges = computed(() => {
  return JSON.stringify(localSettings.value) !== JSON.stringify(originalSettings.value)
})

// Load current settings from store
const loadSettings = () => {
  const prefs = preferenceStore.preferences
  
  localSettings.value = {
    fontSize: prefs.fontSize || 14,
    lineNumbers: prefs.lineNumbers !== false,
    wordWrap: prefs.wordWrap || false,
    minimap: prefs.minimap !== false,
    tabSize: prefs.tabSize || 2,
    vimMode: prefs.vimMode || false,
    emmet: prefs.emmet !== false,
    theme: prefs.theme || 'auto',
    language: prefs.language || 'en',
    showStatusBar: prefs.showStatusBar !== false,
    showSidebar: prefs.showSidebar !== false,
    autoSave: prefs.autoSave || false,
    autoSaveInterval: prefs.autoSaveInterval || 30,
    enableTelemetry: prefs.enableTelemetry || false,
    checkForUpdates: prefs.checkForUpdates !== false,
    defaultFileExtension: prefs.defaultFileExtension || '.md'
  }
  
  // Store original for comparison
  originalSettings.value = { ...localSettings.value }
}

const handleSave = () => {
  // Validate settings
  if (localSettings.value.fontSize < 10 || localSettings.value.fontSize > 24) {
    localSettings.value.fontSize = 14
  }
  
  if (localSettings.value.tabSize < 2 || localSettings.value.tabSize > 8) {
    localSettings.value.tabSize = 2
  }
  
  if (localSettings.value.autoSaveInterval < 10 || localSettings.value.autoSaveInterval > 300) {
    localSettings.value.autoSaveInterval = 30
  }
  
  // Apply all settings to store
  Object.entries(localSettings.value).forEach(([key, value]) => {
    preferenceStore.setPreference(key, value)
  })
  
  // Emit settings changed event
  storeBus.emit('preferences', 'settings-changed', localSettings.value)
  
  // Update original settings
  originalSettings.value = { ...localSettings.value }
  
  // Close modal
  handleClose()
}

const handleClose = () => {
  // Reset to original if there were unsaved changes
  if (hasChanges.value) {
    localSettings.value = { ...originalSettings.value }
  }
  emit('close')
}

const handleReset = () => {
  // Reset to default values
  localSettings.value = {
    fontSize: 14,
    lineNumbers: true,
    wordWrap: false,
    minimap: true,
    tabSize: 2,
    vimMode: false,
    emmet: true,
    theme: 'auto',
    language: 'en',
    showStatusBar: true,
    showSidebar: true,
    autoSave: false,
    autoSaveInterval: 30,
    enableTelemetry: false,
    checkForUpdates: true,
    defaultFileExtension: '.md'
  }
}

const handleOverlayClick = (event: MouseEvent) => {
  // Close if clicking outside modal
  if ((event.target as HTMLElement).classList.contains('settings-modal-overlay')) {
    handleClose()
  }
}

// Load settings when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    loadSettings()
    activeTab.value = 'editor'
  }
})

// Keyboard shortcut handler
const handleKeydown = (event: KeyboardEvent) => {
  if (props.isOpen && event.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.settings-modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center;
}

.settings-modal {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.modal-title {
  @apply text-xl font-semibold text-gray-900 dark:text-white;
}

.close-button {
  @apply text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors;
}

.modal-tabs {
  @apply flex border-b border-gray-200 dark:border-gray-700 px-6;
}

.tab-button {
  @apply px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400;
  @apply hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent;
  @apply transition-colors;
}

.tab-button.active {
  @apply text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400;
}

.modal-content {
  @apply flex-1 overflow-y-auto p-6;
}

.tab-panel {
  @apply space-y-4;
}

.section-title {
  @apply text-lg font-medium text-gray-900 dark:text-white mb-4;
}

.setting-group {
  @apply space-y-2;
}

.setting-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.setting-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.setting-select {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.setting-checkbox {
  @apply mr-2 rounded border-gray-300 dark:border-gray-600;
  @apply text-blue-600 focus:ring-blue-500;
}

.modal-footer {
  @apply flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700;
}

.footer-buttons {
  @apply flex gap-3;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md;
  @apply hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed;
  @apply transition-colors;
}

.btn-secondary {
  @apply px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700;
  @apply transition-colors;
}
</style>