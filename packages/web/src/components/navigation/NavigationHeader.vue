<template>
  <nav class="navigation-header" role="navigation" aria-label="Main navigation">
    <!-- Mobile Menu Toggle -->
    <button
      v-if="isMobile"
      @click="toggleMobileMenu"
      class="mobile-menu-toggle"
      aria-label="Toggle mobile menu"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          v-if="!mobileMenuOpen"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
        <path
          v-else
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    <!-- Logo/Brand (optional) -->
    <div class="nav-brand">
      <slot name="brand">
        <span class="brand-text">Markdown Editor</span>
      </slot>
    </div>

    <!-- Breadcrumb Navigation -->
    <div class="nav-breadcrumb">
      <BreadcrumbNav />
    </div>

    <!-- Search Bar -->
    <div class="nav-search">
      <SearchBar />
    </div>

    <!-- Right Side Actions -->
    <div class="nav-actions">
      <!-- Connection Status -->
      <div class="nav-item">
        <ConnectionStatus />
      </div>

      <!-- Theme Toggle -->
      <div class="nav-item">
        <ThemeToggle />
      </div>

      <!-- Settings Button -->
      <button
        @click="openSettings"
        class="nav-button"
        aria-label="Open settings"
        title="Settings (Ctrl+,)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <!-- User Menu -->
      <div class="nav-item">
        <UserMenu
          @openSettings="openSettings"
          @openKeyboardShortcuts="openKeyboardShortcuts"
          @showAbout="showAbout"
          @connect="handleConnect"
          @disconnect="handleDisconnect"
        />
      </div>
    </div>

    <!-- Mobile Menu Dropdown -->
    <Transition name="mobile-menu">
      <div v-if="isMobile && mobileMenuOpen" class="mobile-menu">
        <div class="mobile-menu-content">
          <div class="mobile-menu-section">
            <ConnectionStatus />
          </div>
          <div class="mobile-menu-section">
            <ThemeToggle />
          </div>
          <div class="mobile-menu-section">
            <button @click="openSettings" class="mobile-menu-item">
              Settings
            </button>
            <button @click="openKeyboardShortcuts" class="mobile-menu-item">
              Keyboard Shortcuts
            </button>
            <button @click="showAbout" class="mobile-menu-item">
              About
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modals -->
    <SettingsModal
      :isOpen="settingsModalOpen"
      @close="settingsModalOpen = false"
    />
    
    <KeyboardShortcutModal
      :isOpen="keyboardModalOpen"
      @close="keyboardModalOpen = false"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import BreadcrumbNav from './BreadcrumbNav.vue'
import ConnectionStatus from './ConnectionStatus.vue'
import SearchBar from './SearchBar.vue'
import ThemeToggle from './ThemeToggle.vue'
import UserMenu from './UserMenu.vue'
import SettingsModal from '../modals/SettingsModal.vue'
import KeyboardShortcutModal from '../modals/KeyboardShortcutModal.vue'
import { storeBus } from '../../stores/communication'
import shortcutRegistry from '../../utils/KeyboardShortcuts'

const emit = defineEmits<{
  settingsOpened: []
  keyboardShortcutsOpened: []
  aboutOpened: []
}>()

const settingsModalOpen = ref(false)
const keyboardModalOpen = ref(false)
const mobileMenuOpen = ref(false)

const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const openSettings = () => {
  settingsModalOpen.value = true
  mobileMenuOpen.value = false
  emit('settingsOpened')
  storeBus.emit('ui', 'settings-opened', {})
}

const openKeyboardShortcuts = () => {
  keyboardModalOpen.value = true
  mobileMenuOpen.value = false
  emit('keyboardShortcutsOpened')
  storeBus.emit('ui', 'keyboard-shortcuts-opened', {})
}

const showAbout = () => {
  mobileMenuOpen.value = false
  emit('aboutOpened')
  storeBus.emit('ui', 'about-opened', {})
  // TODO: Implement about modal
  console.log('About dialog not yet implemented')
}

const handleConnect = () => {
  storeBus.emit('webdav', 'connect-requested', {})
}

const handleDisconnect = () => {
  storeBus.emit('webdav', 'disconnect-requested', {})
}

// Register keyboard shortcuts
const registerShortcuts = () => {
  // Settings shortcut
  shortcutRegistry.register({
    id: 'open-settings',
    keys: { key: ',', ctrl: true },
    description: 'Open settings',
    context: 'global',
    priority: 95,
    handler: () => {
      openSettings()
    }
  })
}

// Handle window resize
const handleResize = () => {
  // Close mobile menu on resize to desktop
  if (!isMobile.value && mobileMenuOpen.value) {
    mobileMenuOpen.value = false
  }
}

// Listen for events from other components
const setupEventListeners = () => {
  storeBus.on('ui', 'open-settings', openSettings)
  storeBus.on('ui', 'open-keyboard-shortcuts', openKeyboardShortcuts)
  storeBus.on('ui', 'show-about', showAbout)
}

const removeEventListeners = () => {
  storeBus.off('ui', 'open-settings', openSettings)
  storeBus.off('ui', 'open-keyboard-shortcuts', openKeyboardShortcuts)
  storeBus.off('ui', 'show-about', showAbout)
}

// Keyboard navigation between header elements
const setupKeyboardNavigation = () => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Tab navigation is handled by browser
    // Add custom navigation if needed
  }
  
  document.addEventListener('keydown', handleKeyDown)
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}

onMounted(() => {
  registerShortcuts()
  setupEventListeners()
  const cleanupKeyboard = setupKeyboardNavigation()
  
  window.addEventListener('resize', handleResize)
  
  // Store cleanup function
  onUnmounted(() => {
    cleanupKeyboard()
  })
})

onUnmounted(() => {
  shortcutRegistry.unregister('open-settings')
  removeEventListeners()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.navigation-header {
  @apply flex items-center gap-4 px-4 py-2;
  @apply bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700;
  @apply min-h-[56px];
}

/* Mobile menu toggle */
.mobile-menu-toggle {
  @apply md:hidden p-2 rounded-lg;
  @apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;
}

/* Brand section */
.nav-brand {
  @apply flex-shrink-0;
}

.brand-text {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
  @apply hidden sm:block;
}

/* Breadcrumb section */
.nav-breadcrumb {
  @apply flex-1 min-w-0 hidden md:block;
  @apply overflow-hidden;
}

/* Search section */
.nav-search {
  @apply flex-1 max-w-md hidden sm:block;
}

/* Actions section */
.nav-actions {
  @apply flex items-center gap-2 ml-auto;
}

.nav-item {
  @apply flex items-center;
}

.nav-button {
  @apply p-2 rounded-lg;
  @apply text-gray-600 dark:text-gray-400;
  @apply hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white;
  @apply transition-colors;
}

/* Mobile menu */
.mobile-menu {
  @apply md:hidden absolute top-full left-0 right-0 z-40;
  @apply bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700;
  @apply shadow-lg;
}

.mobile-menu-content {
  @apply p-4 space-y-4;
}

.mobile-menu-section {
  @apply space-y-2;
}

.mobile-menu-item {
  @apply w-full text-left px-4 py-2 rounded-lg;
  @apply text-gray-700 dark:text-gray-300;
  @apply hover:bg-gray-100 dark:hover:bg-gray-800;
  @apply transition-colors;
}

/* Mobile menu transition */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  @apply transition-all duration-200 ease-out;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  @apply opacity-0 transform -translate-y-2;
}

.mobile-menu-enter-to,
.mobile-menu-leave-from {
  @apply opacity-100 transform translate-y-0;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .navigation-header {
    @apply px-2;
  }
  
  .nav-actions {
    @apply gap-1;
  }
}

/* Keyboard focus styles */
.nav-button:focus-visible,
.mobile-menu-toggle:focus-visible {
  @apply outline-none ring-2 ring-blue-500 ring-offset-2;
  @apply ring-offset-white dark:ring-offset-gray-900;
}
</style>