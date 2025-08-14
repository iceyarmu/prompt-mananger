<template>
  <div class="theme-toggle">
    <button
      @click="toggleTheme"
      class="theme-toggle-button"
      :aria-label="`Switch to ${nextTheme} theme`"
      :title="`Current theme: ${currentThemeLabel}. Click to switch to ${nextTheme}`"
    >
      <!-- Light mode icon -->
      <svg
        v-if="currentTheme === 'light'"
        class="theme-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>

      <!-- Dark mode icon -->
      <svg
        v-else-if="currentTheme === 'dark'"
        class="theme-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>

      <!-- Auto mode icon -->
      <svg
        v-else
        class="theme-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>

      <span class="theme-label">{{ currentThemeLabel }}</span>
    </button>

    <!-- Optional: Theme selection dropdown -->
    <div
      v-if="showDropdown"
      class="theme-dropdown"
      :class="{ open: dropdownOpen }"
    >
      <button
        v-for="theme in themes"
        :key="theme.value"
        @click="selectTheme(theme.value)"
        class="theme-option"
        :class="{ active: currentTheme === theme.value }"
      >
        <component :is="theme.icon" class="theme-option-icon" />
        <span class="theme-option-label">{{ theme.label }}</span>
        <svg
          v-if="currentTheme === theme.value"
          class="theme-option-check"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { usePreferenceStore } from '../../stores/preferences'
import { storeBus } from '../../stores/communication'

const props = withDefaults(defineProps<{
  showDropdown?: boolean
  dropdownOpen?: boolean
}>(), {
  showDropdown: false,
  dropdownOpen: false
})

const emit = defineEmits<{
  themeChanged: [theme: 'light' | 'dark' | 'auto']
}>()

const preferenceStore = usePreferenceStore()

const themes = [
  { value: 'light', label: 'Light', icon: 'sun-icon' },
  { value: 'dark', label: 'Dark', icon: 'moon-icon' },
  { value: 'auto', label: 'Auto', icon: 'desktop-icon' }
] as const

const currentTheme = computed(() => preferenceStore.preferences.theme)

const currentThemeLabel = computed(() => {
  switch (currentTheme.value) {
    case 'light': return 'Light'
    case 'dark': return 'Dark'
    case 'auto': return 'Auto'
    default: return 'Auto'
  }
})

const nextTheme = computed(() => {
  switch (currentTheme.value) {
    case 'light': return 'dark'
    case 'dark': return 'auto'
    case 'auto': return 'light'
    default: return 'light'
  }
})

const systemPrefersDark = computed(() => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

const effectiveTheme = computed(() => {
  if (currentTheme.value === 'auto') {
    return systemPrefersDark.value ? 'dark' : 'light'
  }
  return currentTheme.value
})

const toggleTheme = () => {
  const newTheme = nextTheme.value as 'light' | 'dark' | 'auto'
  selectTheme(newTheme)
}

const selectTheme = (theme: 'light' | 'dark' | 'auto') => {
  preferenceStore.setTheme(theme)
  applyTheme(theme)
  
  // Emit events
  emit('themeChanged', theme)
  storeBus.emit('preferences', 'theme-changed', theme)
  
  // Store preference
  localStorage.setItem('theme', theme)
}

const applyTheme = (theme: 'light' | 'dark' | 'auto') => {
  const root = document.documentElement
  
  if (theme === 'auto') {
    // Apply system preference
    if (systemPrefersDark.value) {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
  } else if (theme === 'dark') {
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  }
}

// Watch for system theme changes
let mediaQuery: MediaQueryList | null = null

const handleSystemThemeChange = (e: MediaQueryListEvent) => {
  if (currentTheme.value === 'auto') {
    applyTheme('auto')
    storeBus.emit('preferences', 'system-theme-changed', e.matches ? 'dark' : 'light')
  }
}

// Watch for theme changes from store
watch(currentTheme, (newTheme) => {
  applyTheme(newTheme)
})

onMounted(() => {
  // Apply initial theme
  applyTheme(currentTheme.value)
  
  // Listen for system theme changes
  if (window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  }
  
  // Load stored preference
  const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null
  if (storedTheme && storedTheme !== currentTheme.value) {
    selectTheme(storedTheme)
  }
})

onUnmounted(() => {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }
})
</script>

<style scoped>
.theme-toggle {
  @apply relative;
}

.theme-toggle-button {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700;
  @apply text-gray-700 dark:text-gray-300 transition-all duration-200;
  @apply border border-transparent hover:border-gray-300 dark:hover:border-gray-600;
}

.theme-icon {
  @apply w-5 h-5 transition-transform duration-200;
}

.theme-toggle-button:hover .theme-icon {
  @apply transform scale-110;
}

.theme-toggle-button:active .theme-icon {
  @apply transform scale-95;
}

.theme-label {
  @apply text-sm font-medium;
}

/* Dropdown styles */
.theme-dropdown {
  @apply absolute top-full mt-2 right-0;
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg;
  @apply border border-gray-200 dark:border-gray-700;
  @apply py-1 min-w-[150px] z-50;
  @apply opacity-0 invisible transform scale-95;
  @apply transition-all duration-200;
}

.theme-dropdown.open {
  @apply opacity-100 visible transform scale-100;
}

.theme-option {
  @apply w-full flex items-center gap-3 px-3 py-2;
  @apply hover:bg-gray-100 dark:hover:bg-gray-700;
  @apply text-gray-700 dark:text-gray-300 text-sm;
  @apply transition-colors duration-150;
}

.theme-option.active {
  @apply bg-blue-50 dark:bg-blue-900/20;
  @apply text-blue-600 dark:text-blue-400;
}

.theme-option-icon {
  @apply w-4 h-4;
}

.theme-option-label {
  @apply flex-1 text-left;
}

.theme-option-check {
  @apply w-4 h-4 text-blue-600 dark:text-blue-400;
}

/* Animation for theme transition */
@media (prefers-reduced-motion: no-preference) {
  .theme-icon {
    @apply transition-all duration-300 ease-in-out;
  }
  
  .theme-toggle-button:hover .theme-icon {
    animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>