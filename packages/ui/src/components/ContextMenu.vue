<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="visible"
        ref="menuRef"
        class="context-menu fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
        :style="floatingStyles"
        tabindex="-1"
        role="menu"
        @click.stop
      >
        <template v-for="(item, index) in menuItems" :key="item.id || index">
          <!-- Menu divider -->
          <div v-if="item.divider" class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
          
          <!-- Menu item -->
          <button
            v-else
            class="context-menu-item w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm transition-colors"
            :class="{ 
              'text-red-600 dark:text-red-400': item.danger, 
              'text-gray-400 dark:text-gray-500 cursor-not-allowed': item.disabled,
              'bg-blue-50 dark:bg-blue-900/30': index === highlightedIndex
            }"
            :disabled="item.disabled"
            role="menuitem"
            :tabindex="item.disabled ? -1 : 0"
            @click="handleItemClick(item)"
            @mouseenter="!item.disabled && !item.divider ? highlightedIndex = index : null"
          >
            <!-- Icon -->
            <span v-if="item.icon" class="w-4 h-4 flex-shrink-0">
              <component :is="getIcon(item.icon)" />
            </span>
            
            <!-- Label -->
            <span class="flex-1">{{ item.label }}</span>
            
            <!-- Shortcut -->
            <kbd v-if="item.shortcut" class="ml-auto text-xs text-gray-500 dark:text-gray-400">
              {{ item.shortcut }}
            </kbd>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, h, nextTick } from 'vue'
import { useFloating, autoUpdate, offset, flip, shift, autoPlacement } from '@floating-ui/vue'
import type { Placement } from '@floating-ui/vue'

export interface ContextMenuItem {
  id: string
  label?: string
  icon?: string
  action?: () => void
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
  hidden?: boolean
}

// Props
const props = defineProps<{
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  placement?: Placement
}>()

// Emits
const emit = defineEmits<{
  'close': []
  'item-click': [item: ContextMenuItem]
}>()

// Refs
const menuRef = ref<HTMLElement>()
const referenceRef = ref<{ getBoundingClientRect: () => DOMRect }>()
const highlightedIndex = ref<number>(-1)

// Expose for testing
defineExpose({
  highlightedIndex
})

// Virtual reference element for positioning at cursor
referenceRef.value = {
  getBoundingClientRect() {
    return {
      x: props.x,
      y: props.y,
      top: props.y,
      left: props.x,
      bottom: props.y,
      right: props.x,
      width: 0,
      height: 0,
    } as DOMRect
  }
}

// Floating UI setup
const { floatingStyles } = useFloating(referenceRef, menuRef, {
  placement: props.placement || 'bottom-start',
  middleware: [
    offset(4),
    flip({
      fallbackPlacements: ['bottom-end', 'top-start', 'top-end', 'left', 'right']
    }),
    shift({ 
      padding: 8,
      boundary: 'viewport'
    }),
    autoPlacement({
      allowedPlacements: ['bottom-start', 'bottom-end', 'top-start', 'top-end']
    })
  ],
  whileElementsMounted: autoUpdate
})

// Computed
const menuItems = computed(() => props.items.filter(item => !item.hidden))

// Computed for actionable items (non-dividers, non-disabled)
const actionableItems = computed(() => {
  return menuItems.value.map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.divider && !item.disabled)
})

// Methods
function handleItemClick(item: ContextMenuItem) {
  if (item.disabled || item.divider) return
  
  emit('item-click', item)
  
  if (item.action) {
    item.action()
  }
  
  emit('close')
}

// Icon definitions - memoized outside component for performance
const iconDefinitions: Record<string, () => any> = {
  'file-open': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' })
  ),
  'edit': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' })
  ),
  'trash': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
  ),
  'copy': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' })
  ),
  'folder-plus': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z' })
  ),
  'file-plus': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
  ),
  'refresh': () => h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2, d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' })
  )
}

const emptyIcon = () => null

function getIcon(iconName: string) {
  // Memoized icon lookup for better performance
  return iconDefinitions[iconName] || emptyIcon
}

// Click outside handler
function handleClickOutside(event: MouseEvent) {
  if (!menuRef.value || menuRef.value.contains(event.target as Node)) return
  emit('close')
}

// Keyboard navigation handler
function handleKeyDown(event: KeyboardEvent) {
  if (!props.visible) return

  switch (event.key) {
    case 'Escape':
      emit('close')
      break
      
    case 'ArrowDown':
      event.preventDefault()
      moveHighlight(1)
      break
      
    case 'ArrowUp':
      event.preventDefault()
      moveHighlight(-1)
      break
      
    case 'Home':
      event.preventDefault()
      if (actionableItems.value.length > 0) {
        highlightedIndex.value = actionableItems.value[0].index
        scrollToHighlighted()
      }
      break
      
    case 'End':
      event.preventDefault()
      if (actionableItems.value.length > 0) {
        highlightedIndex.value = actionableItems.value[actionableItems.value.length - 1].index
        scrollToHighlighted()
      }
      break
      
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < menuItems.value.length) {
        const item = menuItems.value[highlightedIndex.value]
        if (!item.divider && !item.disabled) {
          handleItemClick(item)
        }
      }
      break
      
    case 'Tab':
      event.preventDefault()
      moveHighlight(event.shiftKey ? -1 : 1)
      break
  }
}

// Move highlight up or down
function moveHighlight(direction: number) {
  if (actionableItems.value.length === 0) return
  
  const currentActionableIndex = actionableItems.value.findIndex(({ index }) => index === highlightedIndex.value)
  
  let nextIndex: number
  if (currentActionableIndex === -1) {
    // No item highlighted, start from first or last
    nextIndex = direction > 0 ? 0 : actionableItems.value.length - 1
  } else {
    // Move to next/previous actionable item, with wrapping
    nextIndex = (currentActionableIndex + direction + actionableItems.value.length) % actionableItems.value.length
  }
  
  highlightedIndex.value = actionableItems.value[nextIndex].index
  scrollToHighlighted()
}

// Scroll highlighted item into view
function scrollToHighlighted() {
  nextTick(() => {
    if (!menuRef.value || highlightedIndex.value < 0) return
    
    const items = menuRef.value.querySelectorAll('.context-menu-item')
    const highlightedItem = items[highlightedIndex.value] as HTMLElement
    
    if (highlightedItem) {
      highlightedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      highlightedItem.focus()
    }
  })
}

// Watch visibility and manage event listeners
let cleanupTimeout: NodeJS.Timeout | null = null

watch(() => props.visible, (visible) => {
  // Clear any pending timeout
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout)
    cleanupTimeout = null
  }
  
  if (visible) {
    // Reset highlight when menu opens
    highlightedIndex.value = -1
    
    cleanupTimeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      
      // Focus the menu for keyboard navigation after a small delay
      nextTick(() => {
        if (menuRef.value) {
          menuRef.value.focus()
        }
      })
      
      cleanupTimeout = null
    }, 10)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleKeyDown)
    highlightedIndex.value = -1
  }
})

// Cleanup on unmount - immediate cleanup to prevent leaks
onUnmounted(() => {
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout)
  }
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.context-menu {
  max-height: 400px;
  overflow-y: auto;
  user-select: none;
}

.context-menu::-webkit-scrollbar {
  width: 4px;
}

.context-menu::-webkit-scrollbar-track {
  background: transparent;
}

.context-menu::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
}

.context-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}

.context-menu-item:focus {
  outline: none;
  background-color: rgba(59, 130, 246, 0.1);
}

.dark .context-menu-item:focus {
  background-color: rgba(59, 130, 246, 0.2);
}
</style>