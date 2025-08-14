<template>
  <div class="app-layout" :class="layoutClasses">
    <!-- Navigation Header -->
    <header class="app-layout__header">
      <slot name="header"></slot>
    </header>

    <!-- Main Content Area -->
    <div class="app-layout__body">
      <!-- Left Panel - File Tree -->
      <div 
        ref="leftPanel"
        class="app-layout__panel app-layout__panel--left"
        :style="{ width: leftPanelWidth }"
        :class="{ 'app-layout__panel--collapsed': isLeftCollapsed }"
      >
        <div class="app-layout__panel-header">
          <slot name="left-header"></slot>
          <button
            @click="toggleLeftPanel"
            class="app-layout__collapse-btn"
            :aria-label="isLeftCollapsed ? 'Expand left panel' : 'Collapse left panel'"
          >
            <span class="collapse-icon">{{ isLeftCollapsed ? '›' : '‹' }}</span>
          </button>
        </div>
        <div class="app-layout__panel-content">
          <slot name="left"></slot>
        </div>
      </div>

      <!-- Resize Handle Left -->
      <div
        v-if="!isMobile && !isLeftCollapsed"
        class="app-layout__resize-handle app-layout__resize-handle--left"
        @mousedown="startResize('left', $event)"
      ></div>

      <!-- Center Panel - Editor -->
      <div 
        ref="centerPanel"
        class="app-layout__panel app-layout__panel--center"
        :style="{ flex: centerPanelFlex }"
      >
        <div class="app-layout__panel-header">
          <slot name="center-header"></slot>
        </div>
        <div class="app-layout__panel-content">
          <slot name="center"></slot>
        </div>
      </div>

      <!-- Resize Handle Right -->
      <div
        v-if="!isMobile && !isRightCollapsed"
        class="app-layout__resize-handle app-layout__resize-handle--right"
        @mousedown="startResize('right', $event)"
      ></div>

      <!-- Right Panel - Results -->
      <div 
        ref="rightPanel"
        class="app-layout__panel app-layout__panel--right"
        :style="{ width: rightPanelWidth }"
        :class="{ 'app-layout__panel--collapsed': isRightCollapsed }"
      >
        <div class="app-layout__panel-header">
          <slot name="right-header"></slot>
          <button
            @click="toggleRightPanel"
            class="app-layout__collapse-btn app-layout__collapse-btn--right"
            :aria-label="isRightCollapsed ? 'Expand right panel' : 'Collapse right panel'"
          >
            <span class="collapse-icon">{{ isRightCollapsed ? '‹' : '›' }}</span>
          </button>
        </div>
        <div class="app-layout__panel-content">
          <slot name="right"></slot>
        </div>
      </div>
    </div>

    <!-- Mobile Panel Switcher -->
    <div v-if="isMobile" class="app-layout__mobile-switcher">
      <button 
        v-for="panel in mobilePanels" 
        :key="panel.id"
        @click="setActivePanel(panel.id)"
        :class="{ 'active': activeMobilePanel === panel.id }"
        class="mobile-switcher__btn"
      >
        {{ panel.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { debounce } from '@/utils/debounce'

// Props and Emits
const props = defineProps<{
  minLeftWidth?: number
  maxLeftWidth?: number
  minRightWidth?: number
  maxRightWidth?: number
  minCenterWidth?: number
}>()

const emit = defineEmits<{
  'panel-resize': [panel: string, width: number]
  'panel-toggle': [panel: string, collapsed: boolean]
  'panel-focus': [panel: string]
}>()

// Store
const preferencesStore = usePreferencesStore()

// Constants
const MIN_LEFT_WIDTH = props.minLeftWidth ?? 200
const MAX_LEFT_WIDTH = props.maxLeftWidth ?? 600
const MIN_RIGHT_WIDTH = props.minRightWidth ?? 300
const MAX_RIGHT_WIDTH = props.maxRightWidth ?? 800
const MIN_CENTER_WIDTH = props.minCenterWidth ?? 400
const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

// Refs
const leftPanel = ref<HTMLElement>()
const centerPanel = ref<HTMLElement>()
const rightPanel = ref<HTMLElement>()

// State
const leftWidth = ref(250)
const rightWidth = ref(350)
const isLeftCollapsed = ref(false)
const isRightCollapsed = ref(false)
const isResizing = ref<'left' | 'right' | null>(null)
const startX = ref(0)
const startWidth = ref(0)
const isMobile = ref(false)
const isTablet = ref(false)
const activeMobilePanel = ref<'left' | 'center' | 'right'>('center')
const focusedPanel = ref<'left' | 'center' | 'right'>('center')

// Mobile panels configuration
const mobilePanels = [
  { id: 'left' as const, label: 'Files' },
  { id: 'center' as const, label: 'Editor' },
  { id: 'right' as const, label: 'Results' }
]

// Computed
const layoutClasses = computed(() => ({
  'app-layout--mobile': isMobile.value,
  'app-layout--tablet': isTablet.value && !isMobile.value,
  'app-layout--desktop': !isMobile.value && !isTablet.value,
  [`app-layout--mobile-${activeMobilePanel.value}`]: isMobile.value,
  [`app-layout--focused-${focusedPanel.value}`]: !isMobile.value
}))

const leftPanelWidth = computed(() => {
  if (isMobile.value || isLeftCollapsed.value) return '0px'
  return `${leftWidth.value}px`
})

const rightPanelWidth = computed(() => {
  if (isMobile.value || isRightCollapsed.value) return '0px'
  return `${rightWidth.value}px`
})

const centerPanelFlex = computed(() => {
  if (isMobile.value) return '1'
  return '1 1 auto'
})

// Methods
const startResize = (panel: 'left' | 'right', event: MouseEvent) => {
  isResizing.value = panel
  startX.value = event.clientX
  startWidth.value = panel === 'left' ? leftWidth.value : rightWidth.value
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isResizing.value) return
  
  const diff = event.clientX - startX.value
  
  if (isResizing.value === 'left') {
    const newWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, startWidth.value + diff))
    leftWidth.value = newWidth
    emit('panel-resize', 'left', newWidth)
  } else {
    const newWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, startWidth.value - diff))
    rightWidth.value = newWidth
    emit('panel-resize', 'right', newWidth)
  }
}

const stopResize = () => {
  isResizing.value = null
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  
  // Save to preferences
  saveLayoutPreferences()
}

const toggleLeftPanel = () => {
  isLeftCollapsed.value = !isLeftCollapsed.value
  emit('panel-toggle', 'left', isLeftCollapsed.value)
  saveLayoutPreferences()
}

const toggleRightPanel = () => {
  isRightCollapsed.value = !isRightCollapsed.value
  emit('panel-toggle', 'right', isRightCollapsed.value)
  saveLayoutPreferences()
}

const setActivePanel = (panel: 'left' | 'center' | 'right') => {
  activeMobilePanel.value = panel
  focusedPanel.value = panel
  emit('panel-focus', panel)
}

const focusPanel = (panel: 'left' | 'center' | 'right') => {
  if (isMobile.value) {
    setActivePanel(panel)
  } else {
    focusedPanel.value = panel
    emit('panel-focus', panel)
    
    // Focus the first focusable element in the panel
    nextTick(() => {
      const panelEl = panel === 'left' ? leftPanel.value 
                    : panel === 'center' ? centerPanel.value 
                    : rightPanel.value
      
      const focusable = panelEl?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    })
  }
}

// Keyboard navigation
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl/Cmd + 1/2/3 for panel focus
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
    switch (event.key) {
      case '1':
        event.preventDefault()
        focusPanel('left')
        break
      case '2':
        event.preventDefault()
        focusPanel('center')
        break
      case '3':
        event.preventDefault()
        focusPanel('right')
        break
    }
  }
}

// Responsive handling
const checkBreakpoint = () => {
  const width = window.innerWidth
  isMobile.value = width < MOBILE_BREAKPOINT
  isTablet.value = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT
}

// Preferences handling
const saveLayoutPreferences = debounce(() => {
  preferencesStore.updatePreference('layout', {
    leftWidth: leftWidth.value,
    rightWidth: rightWidth.value,
    isLeftCollapsed: isLeftCollapsed.value,
    isRightCollapsed: isRightCollapsed.value,
    activeMobilePanel: activeMobilePanel.value,
    focusedPanel: focusedPanel.value
  })
}, 100)

const loadLayoutPreferences = () => {
  const layout = preferencesStore.preferences.layout
  if (layout) {
    leftWidth.value = layout.leftWidth ?? 250
    rightWidth.value = layout.rightWidth ?? 350
    isLeftCollapsed.value = layout.isLeftCollapsed ?? false
    isRightCollapsed.value = layout.isRightCollapsed ?? false
    activeMobilePanel.value = layout.activeMobilePanel ?? 'center'
    focusedPanel.value = layout.focusedPanel ?? 'center'
  }
}

// Lifecycle
onMounted(() => {
  checkBreakpoint()
  loadLayoutPreferences()
  window.addEventListener('resize', checkBreakpoint)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkBreakpoint)
  window.removeEventListener('keydown', handleKeyDown)
})

// Watch for preference changes from other sources
watch(() => preferencesStore.preferences.layout, (newLayout) => {
  if (newLayout && !isResizing.value) {
    leftWidth.value = newLayout.leftWidth ?? leftWidth.value
    rightWidth.value = newLayout.rightWidth ?? rightWidth.value
    isLeftCollapsed.value = newLayout.isLeftCollapsed ?? isLeftCollapsed.value
    isRightCollapsed.value = newLayout.isRightCollapsed ?? isRightCollapsed.value
  }
})
</script>

<style scoped>
.app-layout {
  @apply flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900;
}

.app-layout__header {
  @apply flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800;
}

.app-layout__body {
  @apply flex flex-1 overflow-hidden relative;
}

/* Panels */
.app-layout__panel {
  @apply flex flex-col bg-white dark:bg-gray-800 overflow-hidden;
  transition: width 0.3s ease;
}

.app-layout__panel--left {
  @apply border-r border-gray-200 dark:border-gray-700;
}

.app-layout__panel--center {
  @apply flex-1;
  min-width: 400px;
}

.app-layout__panel--right {
  @apply border-l border-gray-200 dark:border-gray-700;
}

.app-layout__panel--collapsed {
  @apply w-0 overflow-hidden;
}

.app-layout__panel-header {
  @apply flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700;
  @apply bg-gray-50 dark:bg-gray-800;
}

.app-layout__panel-content {
  @apply flex-1 overflow-auto;
}

/* Collapse buttons */
.app-layout__collapse-btn {
  @apply p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors;
  @apply text-gray-500 dark:text-gray-400;
}

.collapse-icon {
  @apply block text-xs font-mono;
}

/* Resize handles */
.app-layout__resize-handle {
  @apply w-1 bg-gray-300 dark:bg-gray-600 cursor-col-resize hover:bg-blue-500;
  @apply transition-colors duration-200;
}

/* Focus indicators */
.app-layout--focused-left .app-layout__panel--left {
  @apply ring-2 ring-inset ring-blue-500;
}

.app-layout--focused-center .app-layout__panel--center {
  @apply ring-2 ring-inset ring-blue-500;
}

.app-layout--focused-right .app-layout__panel--right {
  @apply ring-2 ring-inset ring-blue-500;
}

/* Mobile styles */
.app-layout--mobile .app-layout__body {
  @apply flex-col;
}

.app-layout--mobile .app-layout__panel {
  @apply absolute inset-0 w-full;
  transform: translateX(100%);
}

.app-layout--mobile .app-layout__panel--center {
  min-width: unset;
}

.app-layout--mobile-left .app-layout__panel--left,
.app-layout--mobile-center .app-layout__panel--center,
.app-layout--mobile-right .app-layout__panel--right {
  transform: translateX(0);
}

.app-layout__mobile-switcher {
  @apply flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800;
}

.mobile-switcher__btn {
  @apply flex-1 py-3 text-sm font-medium text-gray-600 dark:text-gray-400;
  @apply hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors;
}

.mobile-switcher__btn.active {
  @apply bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400;
  @apply border-t-2 border-blue-500;
}

/* Tablet adjustments */
.app-layout--tablet .app-layout__panel--left {
  max-width: 300px;
}

.app-layout--tablet .app-layout__panel--right {
  max-width: 400px;
}
</style>