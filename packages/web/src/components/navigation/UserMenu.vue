<template>
  <div class="user-menu" ref="menuRef">
    <button
      @click="toggleMenu"
      class="user-menu-trigger"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
    >
      <svg class="user-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span class="user-name">{{ userName }}</span>
      <svg class="chevron-icon" :class="{ 'rotate-180': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Transition name="menu">
      <div
        v-if="isOpen"
        class="user-menu-dropdown"
        role="menu"
        @click="handleMenuClick"
      >
        <!-- User Profile Section (Future Ready) -->
        <div class="menu-section user-profile">
          <div class="profile-info">
            <div class="profile-avatar">
              <svg class="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="profile-details">
              <div class="profile-name">{{ userName }}</div>
              <div class="profile-email">{{ userEmail || 'Not configured' }}</div>
            </div>
          </div>
        </div>

        <div class="menu-divider"></div>

        <!-- Quick Preferences -->
        <div class="menu-section">
          <h3 class="menu-section-title">Quick Settings</h3>
          
          <button class="menu-item" @click="toggleAutoSave">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
            </svg>
            <span>Auto-Save</span>
            <span class="menu-item-status" :class="{ active: autoSave }">
              {{ autoSave ? 'On' : 'Off' }}
            </span>
          </button>

          <button class="menu-item" @click="toggleVimMode">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>Vim Mode</span>
            <span class="menu-item-status" :class="{ active: vimMode }">
              {{ vimMode ? 'On' : 'Off' }}
            </span>
          </button>

          <button class="menu-item" @click="toggleMinimap">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Minimap</span>
            <span class="menu-item-status" :class="{ active: minimap }">
              {{ minimap ? 'On' : 'Off' }}
            </span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <!-- Actions -->
        <div class="menu-section">
          <button class="menu-item" @click="openSettings">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>All Settings</span>
          </button>

          <button class="menu-item" @click="openKeyboardShortcuts">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Keyboard Shortcuts</span>
            <span class="menu-item-shortcut">Ctrl+?</span>
          </button>

          <button class="menu-item" @click="showAbout">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>About</span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <!-- WebDAV Actions -->
        <div class="menu-section">
          <button 
            v-if="isConnected"
            class="menu-item menu-item--danger" 
            @click="handleDisconnect"
          >
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Disconnect WebDAV</span>
          </button>

          <button 
            v-else
            class="menu-item menu-item--primary" 
            @click="handleConnect"
          >
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Connect WebDAV</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePreferenceStore } from '../../stores/preferences'
import { useWebDAVStore } from '../../stores/webdav'
import { storeBus } from '../../stores/communication'

const emit = defineEmits<{
  openSettings: []
  openKeyboardShortcuts: []
  showAbout: []
  connect: []
  disconnect: []
}>()

const preferenceStore = usePreferenceStore()
const webdavStore = useWebDAVStore()

const menuRef = ref<HTMLElement>()
const isOpen = ref(false)

// User profile placeholders
const userName = computed(() => webdavStore.activeProfile?.name || 'Guest User')
const userEmail = computed(() => webdavStore.activeProfile?.username || '')

// Preference states
const autoSave = computed(() => preferenceStore.preferences.autoSave)
const vimMode = computed(() => preferenceStore.preferences.vimMode)
const minimap = computed(() => preferenceStore.preferences.minimap)
const isConnected = computed(() => webdavStore.isConnected)

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const closeMenu = () => {
  isOpen.value = false
}

const handleMenuClick = (event: MouseEvent) => {
  // Prevent menu from closing when clicking inside
  event.stopPropagation()
}

const toggleAutoSave = () => {
  preferenceStore.setPreference('autoSave', !autoSave.value)
  storeBus.emit('preferences', 'settings-changed', { autoSave: !autoSave.value })
}

const toggleVimMode = () => {
  preferenceStore.setPreference('vimMode', !vimMode.value)
  storeBus.emit('preferences', 'settings-changed', { vimMode: !vimMode.value })
}

const toggleMinimap = () => {
  preferenceStore.setPreference('minimap', !minimap.value)
  storeBus.emit('preferences', 'settings-changed', { minimap: !minimap.value })
}

const openSettings = () => {
  closeMenu()
  emit('openSettings')
  storeBus.emit('ui', 'open-settings', {})
}

const openKeyboardShortcuts = () => {
  closeMenu()
  emit('openKeyboardShortcuts')
  storeBus.emit('ui', 'open-keyboard-shortcuts', {})
}

const showAbout = () => {
  closeMenu()
  emit('showAbout')
  storeBus.emit('ui', 'show-about', {})
}

const handleConnect = () => {
  closeMenu()
  emit('connect')
  storeBus.emit('webdav', 'request-connect', {})
}

const handleDisconnect = async () => {
  closeMenu()
  try {
    await webdavStore.disconnect()
    emit('disconnect')
    storeBus.emit('webdav', 'disconnected', {})
  } catch (error) {
    console.error('Failed to disconnect:', error)
  }
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

// Escape key handler
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    closeMenu()
  }
}

// Positioning logic to prevent menu from going off-screen
const updateMenuPosition = () => {
  if (!menuRef.value || !isOpen.value) return
  
  const dropdown = menuRef.value.querySelector('.user-menu-dropdown') as HTMLElement
  if (!dropdown) return
  
  const rect = dropdown.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  
  // Reset positioning
  dropdown.style.right = ''
  dropdown.style.left = ''
  dropdown.style.top = ''
  dropdown.style.bottom = ''
  
  // Check if menu goes off bottom
  if (rect.bottom > viewportHeight) {
    dropdown.style.bottom = '100%'
    dropdown.style.top = 'auto'
  }
  
  // Check if menu goes off right
  if (rect.right > viewportWidth) {
    dropdown.style.right = '0'
    dropdown.style.left = 'auto'
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  window.addEventListener('resize', updateMenuPosition)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
  window.removeEventListener('resize', updateMenuPosition)
})
</script>

<style scoped>
.user-menu {
  @apply relative;
}

.user-menu-trigger {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700;
  @apply text-gray-700 dark:text-gray-300 transition-colors;
}

.user-icon {
  @apply w-5 h-5;
}

.user-name {
  @apply text-sm font-medium;
}

.chevron-icon {
  @apply w-4 h-4 transition-transform duration-200;
}

.user-menu-dropdown {
  @apply absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg;
  @apply border border-gray-200 dark:border-gray-700 z-50;
  @apply py-2 max-h-[80vh] overflow-y-auto;
}

.menu-section {
  @apply px-2 py-1;
}

.menu-section-title {
  @apply px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider;
}

.user-profile {
  @apply px-4 py-3;
}

.profile-info {
  @apply flex items-center gap-3;
}

.profile-avatar {
  @apply w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center;
}

.avatar-icon {
  @apply w-6 h-6 text-gray-500 dark:text-gray-400;
}

.profile-details {
  @apply flex-1;
}

.profile-name {
  @apply text-sm font-medium text-gray-900 dark:text-white;
}

.profile-email {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.menu-divider {
  @apply my-1 h-px bg-gray-200 dark:bg-gray-700;
}

.menu-item {
  @apply w-full flex items-center gap-3 px-3 py-2 rounded-md text-left;
  @apply hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors;
  @apply text-gray-700 dark:text-gray-300 text-sm;
}

.menu-item--primary {
  @apply text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20;
}

.menu-item--danger {
  @apply text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20;
}

.menu-icon {
  @apply w-4 h-4 flex-shrink-0;
}

.menu-item-status {
  @apply ml-auto text-xs px-2 py-0.5 rounded-full;
  @apply bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400;
}

.menu-item-status.active {
  @apply bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400;
}

.menu-item-shortcut {
  @apply ml-auto text-xs text-gray-500 dark:text-gray-400;
  @apply bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded;
}

/* Transition */
.menu-enter-active,
.menu-leave-active {
  @apply transition-all duration-200 ease-out;
}

.menu-enter-from,
.menu-leave-to {
  @apply opacity-0 transform scale-95;
}

.menu-enter-to,
.menu-leave-from {
  @apply opacity-100 transform scale-100;
}
</style>