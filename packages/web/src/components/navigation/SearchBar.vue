<template>
  <div class="search-bar" :class="{ disabled: isDisabled }">
    <div class="search-container">
      <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      
      <input
        type="text"
        class="search-input"
        :placeholder="placeholder"
        :disabled="isDisabled"
        :value="searchQuery"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter="handleSearch"
        @keydown.escape="handleEscape"
      />
      
      <div v-if="searchQuery && !isDisabled" class="search-clear">
        <button
          @click="clearSearch"
          class="clear-button"
          aria-label="Clear search"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <kbd v-if="showShortcut" class="search-shortcut">
        {{ isMac ? '⌘' : 'Ctrl' }} K
      </kbd>
    </div>
    
    <!-- Coming Soon Tooltip -->
    <Transition name="tooltip">
      <div v-if="showTooltip" class="coming-soon-tooltip">
        <div class="tooltip-content">
          <svg class="tooltip-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="tooltip-text">
            <p class="tooltip-title">Search Coming Soon!</p>
            <p class="tooltip-description">
              Full-text search across all your markdown files will be available in the next update.
            </p>
          </div>
        </div>
        <div class="tooltip-arrow"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeBus } from '../../stores/communication'
import shortcutRegistry from '../../utils/KeyboardShortcuts'

const props = withDefaults(defineProps<{
  placeholder?: string
  disabled?: boolean
  showShortcut?: boolean
}>(), {
  placeholder: 'Search files... (Coming Soon)',
  disabled: true,
  showShortcut: true
})

const emit = defineEmits<{
  search: [query: string]
  focus: []
  blur: []
  clear: []
}>()

const searchQuery = ref('')
const isFocused = ref(false)
const showTooltip = ref(false)
const tooltipTimer = ref<number | null>(null)

const isDisabled = computed(() => props.disabled)
const isMac = computed(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  searchQuery.value = target.value
  
  if (!isDisabled.value) {
    emit('search', searchQuery.value)
  }
}

const handleFocus = () => {
  isFocused.value = true
  emit('focus')
  
  if (isDisabled.value) {
    showTooltip.value = true
    
    // Hide tooltip after 5 seconds
    tooltipTimer.value = window.setTimeout(() => {
      showTooltip.value = false
    }, 5000)
  }
}

const handleBlur = () => {
  isFocused.value = false
  emit('blur')
  
  // Hide tooltip on blur
  if (tooltipTimer.value) {
    clearTimeout(tooltipTimer.value)
    tooltipTimer.value = null
  }
  showTooltip.value = false
}

const handleSearch = () => {
  if (!isDisabled.value && searchQuery.value) {
    emit('search', searchQuery.value)
    storeBus.emit('search', 'execute', { query: searchQuery.value })
  }
}

const handleEscape = () => {
  clearSearch()
  const input = document.querySelector('.search-input') as HTMLInputElement
  input?.blur()
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('clear')
  
  if (!isDisabled.value) {
    storeBus.emit('search', 'clear', {})
  }
}

const focusSearch = () => {
  const input = document.querySelector('.search-input') as HTMLInputElement
  input?.focus()
  input?.select()
}

// Register keyboard shortcut for search
const registerSearchShortcut = () => {
  shortcutRegistry.register({
    id: 'focus-search',
    keys: { key: 'k', ctrl: true },
    description: 'Focus search bar',
    context: 'global',
    priority: 90,
    handler: () => {
      focusSearch()
    }
  })
}

// Document search API requirements for future implementation
const searchAPIRequirements = {
  endpoints: {
    search: '/api/search',
    index: '/api/search/index',
    suggest: '/api/search/suggest'
  },
  features: {
    fullText: 'Search within file contents',
    fuzzy: 'Fuzzy matching for typos',
    regex: 'Regular expression support',
    filters: 'Filter by file type, date, size',
    highlighting: 'Highlight search results',
    preview: 'Show context around matches',
    history: 'Search history and suggestions'
  },
  indexing: {
    realtime: 'Index files as they change',
    background: 'Background indexing for performance',
    incremental: 'Incremental updates to index',
    metadata: 'Index file metadata (tags, frontmatter)'
  },
  performance: {
    debounce: 300, // ms to debounce search input
    maxResults: 50, // Maximum results to display
    cacheTime: 60000, // Cache results for 1 minute
    indexSize: '10MB' // Maximum index size
  }
}

onMounted(() => {
  registerSearchShortcut()
  
  // Log API requirements for documentation
  console.info('Search API Requirements:', searchAPIRequirements)
})

onUnmounted(() => {
  shortcutRegistry.unregister('focus-search')
  
  if (tooltipTimer.value) {
    clearTimeout(tooltipTimer.value)
  }
})
</script>

<style scoped>
.search-bar {
  @apply relative flex-1 max-w-md;
}

.search-bar.disabled {
  @apply opacity-75;
}

.search-container {
  @apply relative flex items-center;
}

.search-icon {
  @apply absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none;
}

.search-input {
  @apply w-full pl-10 pr-20 py-2 rounded-lg;
  @apply bg-gray-100 dark:bg-gray-800 border border-transparent;
  @apply text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  @apply disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900;
  @apply transition-all duration-200;
}

.search-input:hover:not(:disabled) {
  @apply bg-gray-200 dark:bg-gray-700;
}

.search-clear {
  @apply absolute right-12 flex items-center;
}

.clear-button {
  @apply p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors;
  @apply text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
}

.search-shortcut {
  @apply absolute right-3 px-2 py-0.5;
  @apply bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600;
  @apply rounded text-xs text-gray-500 dark:text-gray-400;
  @apply pointer-events-none;
}

/* Coming Soon Tooltip */
.coming-soon-tooltip {
  @apply absolute top-full mt-2 left-0 right-0 z-50;
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg;
  @apply border border-gray-200 dark:border-gray-700;
  @apply p-4;
}

.tooltip-content {
  @apply flex gap-3;
}

.tooltip-icon {
  @apply w-6 h-6 text-blue-500 dark:text-blue-400 flex-shrink-0;
}

.tooltip-text {
  @apply space-y-1;
}

.tooltip-title {
  @apply font-medium text-gray-900 dark:text-white;
}

.tooltip-description {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.tooltip-arrow {
  @apply absolute -top-2 left-8 w-4 h-4;
  @apply bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700;
  @apply transform rotate-45;
}

/* Tooltip transition */
.tooltip-enter-active,
.tooltip-leave-active {
  @apply transition-all duration-200 ease-out;
}

.tooltip-enter-from,
.tooltip-leave-to {
  @apply opacity-0 transform -translate-y-2;
}

.tooltip-enter-to,
.tooltip-leave-from {
  @apply opacity-100 transform translate-y-0;
}
</style>