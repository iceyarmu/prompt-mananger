<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="shortcut-modal-overlay"
      @click="handleOverlayClick"
      @keydown.escape="handleClose"
    >
      <div class="shortcut-modal" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Keyboard Shortcuts</h2>
          <button
            @click="handleClose"
            class="close-button"
            aria-label="Close keyboard shortcuts"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-search">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search shortcuts..."
            class="search-input"
            @input="filterShortcuts"
          />
        </div>

        <div class="modal-content">
          <div
            v-for="category in filteredCategories"
            :key="category.name"
            class="shortcut-category"
          >
            <h3 class="category-title">{{ category.name }}</h3>
            <div class="shortcut-list">
              <div
                v-for="shortcut in category.shortcuts"
                :key="shortcut.id"
                class="shortcut-item"
              >
                <div class="shortcut-description">{{ shortcut.description }}</div>
                <div class="shortcut-keys">
                  <kbd
                    v-for="(key, index) in formatKeys(shortcut.keys)"
                    :key="index"
                    class="key"
                  >
                    {{ key }}
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          <div v-if="filteredCategories.length === 0" class="no-results">
            <svg class="no-results-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="no-results-text">No shortcuts found matching "{{ searchQuery }}"</p>
          </div>
        </div>

        <div class="modal-footer">
          <div class="footer-info">
            <span class="info-text">Press <kbd class="key-inline">Ctrl</kbd> + <kbd class="key-inline">?</kbd> to open this reference</span>
          </div>
          <button
            @click="handleClose"
            class="btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import shortcutRegistry, { type ShortcutHandler, type ShortcutKey } from '../../utils/KeyboardShortcuts'
import { storeBus } from '../../stores/communication'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

interface ShortcutCategory {
  name: string
  shortcuts: ShortcutHandler[]
}

const searchQuery = ref('')
const allShortcuts = ref<ShortcutHandler[]>([])

// Categorize shortcuts
const categories = computed<ShortcutCategory[]>(() => {
  const categoryMap = new Map<string, ShortcutHandler[]>()
  
  // Default categories
  const categoryNames = {
    file: 'File Operations',
    edit: 'Edit',
    view: 'View',
    navigation: 'Navigation',
    panel: 'Panel Management',
    editor: 'Editor',
    search: 'Search',
    help: 'Help',
    global: 'General'
  }
  
  for (const shortcut of allShortcuts.value) {
    // Determine category based on context or description
    let categoryKey = 'global'
    
    if (shortcut.context) {
      categoryKey = shortcut.context
    } else {
      // Try to infer category from description
      const desc = shortcut.description.toLowerCase()
      if (desc.includes('save') || desc.includes('open') || desc.includes('new')) {
        categoryKey = 'file'
      } else if (desc.includes('copy') || desc.includes('paste') || desc.includes('cut') || desc.includes('undo')) {
        categoryKey = 'edit'
      } else if (desc.includes('panel') || desc.includes('focus')) {
        categoryKey = 'panel'
      } else if (desc.includes('search') || desc.includes('find')) {
        categoryKey = 'search'
      } else if (desc.includes('view') || desc.includes('zoom')) {
        categoryKey = 'view'
      } else if (desc.includes('navigate') || desc.includes('go to')) {
        categoryKey = 'navigation'
      }
    }
    
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, [])
    }
    categoryMap.get(categoryKey)!.push(shortcut)
  }
  
  // Convert to array and sort
  const result: ShortcutCategory[] = []
  for (const [key, shortcuts] of categoryMap.entries()) {
    result.push({
      name: categoryNames[key as keyof typeof categoryNames] || key,
      shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description))
    })
  }
  
  return result.sort((a, b) => a.name.localeCompare(b.name))
})

// Filter shortcuts based on search
const filteredCategories = computed<ShortcutCategory[]>(() => {
  if (!searchQuery.value) {
    return categories.value
  }
  
  const query = searchQuery.value.toLowerCase()
  const filtered: ShortcutCategory[] = []
  
  for (const category of categories.value) {
    const matchingShortcuts = category.shortcuts.filter(shortcut => {
      // Check description
      if (shortcut.description.toLowerCase().includes(query)) return true
      
      // Check key combination
      const keyStr = formatKeys(shortcut.keys).join(' ').toLowerCase()
      if (keyStr.includes(query)) return true
      
      // Check category name
      if (category.name.toLowerCase().includes(query)) return true
      
      return false
    })
    
    if (matchingShortcuts.length > 0) {
      filtered.push({
        name: category.name,
        shortcuts: matchingShortcuts
      })
    }
  }
  
  return filtered
})

const formatKeys = (keys: any): string[] => {
  const parts: string[] = []
  
  // Check for Mac vs PC
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  
  if (keys.ctrl) parts.push(isMac ? '⌘' : 'Ctrl')
  if (keys.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (keys.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (keys.meta && !isMac) parts.push('Meta')
  
  // Format the main key
  let mainKey = keys.key
  if (mainKey.length === 1) {
    mainKey = mainKey.toUpperCase()
  } else {
    // Capitalize first letter for special keys
    mainKey = mainKey.charAt(0).toUpperCase() + mainKey.slice(1)
  }
  parts.push(mainKey)
  
  return parts
}

const filterShortcuts = () => {
  // Filtering is handled by computed property
}

const loadShortcuts = () => {
  allShortcuts.value = shortcutRegistry.getShortcuts()
  
  // Add some default shortcuts if none are registered
  if (allShortcuts.value.length === 0) {
    // These would normally be registered by components
    const defaults = [
      { id: 'save', keys: { key: 's', ctrl: true }, description: 'Save current file', context: 'file' },
      { id: 'save-all', keys: { key: 's', ctrl: true, shift: true }, description: 'Save all files', context: 'file' },
      { id: 'new-file', keys: { key: 'n', ctrl: true }, description: 'New file', context: 'file' },
      { id: 'open-file', keys: { key: 'o', ctrl: true }, description: 'Open file', context: 'file' },
      { id: 'copy', keys: { key: 'c', ctrl: true }, description: 'Copy', context: 'edit' },
      { id: 'paste', keys: { key: 'v', ctrl: true }, description: 'Paste', context: 'edit' },
      { id: 'cut', keys: { key: 'x', ctrl: true }, description: 'Cut', context: 'edit' },
      { id: 'undo', keys: { key: 'z', ctrl: true }, description: 'Undo', context: 'edit' },
      { id: 'redo', keys: { key: 'z', ctrl: true, shift: true }, description: 'Redo', context: 'edit' },
      { id: 'find', keys: { key: 'f', ctrl: true }, description: 'Find', context: 'search' },
      { id: 'replace', keys: { key: 'h', ctrl: true }, description: 'Find and replace', context: 'search' },
      { id: 'panel-1', keys: { key: '1', ctrl: true }, description: 'Focus file tree panel', context: 'panel' },
      { id: 'panel-2', keys: { key: '2', ctrl: true }, description: 'Focus editor panel', context: 'panel' },
      { id: 'panel-3', keys: { key: '3', ctrl: true }, description: 'Focus preview panel', context: 'panel' },
      { id: 'settings', keys: { key: ',', ctrl: true }, description: 'Open settings', context: 'global' },
      { id: 'help', keys: { key: '?', ctrl: true }, description: 'Show keyboard shortcuts', context: 'help' }
    ] as ShortcutHandler[]
    
    allShortcuts.value = defaults
  }
}

const handleClose = () => {
  searchQuery.value = ''
  emit('close')
}

const handleOverlayClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).classList.contains('shortcut-modal-overlay')) {
    handleClose()
  }
}

// Register the shortcut to open this modal
const registerHelpShortcut = () => {
  shortcutRegistry.register({
    id: 'open-keyboard-shortcuts',
    keys: { key: '?', ctrl: true },
    description: 'Show keyboard shortcuts',
    context: 'global',
    priority: 100,
    handler: () => {
      storeBus.emit('ui', 'open-keyboard-shortcuts', {})
    }
  })
}

onMounted(() => {
  loadShortcuts()
  registerHelpShortcut()
  
  // Listen for shortcut changes
  shortcutRegistry.on('shortcut-registered', loadShortcuts)
  shortcutRegistry.on('shortcut-unregistered', loadShortcuts)
})

onUnmounted(() => {
  shortcutRegistry.off('shortcut-registered', loadShortcuts)
  shortcutRegistry.off('shortcut-unregistered', loadShortcuts)
  shortcutRegistry.unregister('open-keyboard-shortcuts')
})
</script>

<style scoped>
.shortcut-modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center;
}

.shortcut-modal {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col;
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

.modal-search {
  @apply relative px-6 py-4 border-b border-gray-200 dark:border-gray-700;
}

.search-icon {
  @apply absolute left-9 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400;
}

.search-input {
  @apply w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply placeholder-gray-400 dark:placeholder-gray-500;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.modal-content {
  @apply flex-1 overflow-y-auto p-6 space-y-6;
}

.shortcut-category {
  @apply space-y-3;
}

.category-title {
  @apply text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider;
}

.shortcut-list {
  @apply space-y-2;
}

.shortcut-item {
  @apply flex items-center justify-between px-4 py-3 rounded-lg;
  @apply bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/50;
  @apply transition-colors;
}

.shortcut-description {
  @apply text-sm text-gray-700 dark:text-gray-300;
}

.shortcut-keys {
  @apply flex items-center gap-1;
}

.key {
  @apply inline-block px-2 py-1 min-w-[28px] text-center;
  @apply bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600;
  @apply rounded text-xs font-mono text-gray-700 dark:text-gray-300;
  @apply shadow-sm;
}

.key-inline {
  @apply inline-block px-1.5 py-0.5 min-w-[24px] text-center;
  @apply bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600;
  @apply rounded text-xs font-mono text-gray-700 dark:text-gray-300;
}

.no-results {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.no-results-icon {
  @apply w-16 h-16 text-gray-400 dark:text-gray-600 mb-4;
}

.no-results-text {
  @apply text-gray-500 dark:text-gray-400;
}

.modal-footer {
  @apply flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700;
}

.footer-info {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.info-text {
  @apply flex items-center gap-1;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md;
  @apply hover:bg-blue-700 transition-colors;
}
</style>