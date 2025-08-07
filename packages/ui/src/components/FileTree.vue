<template>
  <div class="file-tree-container theme-card">
    <!-- Header with search -->
    <div class="file-tree-header theme-header p-3 border-b">
      <div class="flex items-center justify-between">
        <h3 class="font-medium text-sm theme-title">{{ t('fileTree.title') }}</h3>
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="text-xs theme-text-secondary hover:theme-text"
          :title="t('fileTree.clearSearch')"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mt-2">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('fileTree.searchPlaceholder')"
          class="w-full px-2 py-1 text-sm rounded border theme-input"
          @input="onSearchInput"
        />
      </div>
    </div>

    <!-- Tree content -->
    <div
      ref="treeContainer"
      class="file-tree-content flex-1 overflow-auto"
      :class="{ 'loading': loading }"
      @keydown="handleKeyDown"
    >
      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center p-4">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="p-4 text-sm text-red-500">
        <p>{{ t('fileTree.error') }}: {{ error }}</p>
        <button
          @click="loadTree"
          class="mt-2 text-xs px-2 py-1 rounded theme-button-secondary"
        >
          {{ t('fileTree.retry') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="!filteredTree || !filteredTree.length" class="p-4 text-sm theme-text-secondary text-center">
        {{ searchQuery ? t('fileTree.noResults') : t('fileTree.empty') }}
      </div>

      <!-- Tree nodes -->
      <div v-else class="py-1">
        <template v-if="shouldUseVirtualScroll">
          <!-- Virtual scrolling for large trees -->
          <div
            ref="virtualList"
            class="virtual-scroll-container"
            :style="{ height: virtualScrollHeight + 'px' }"
          >
            <TreeNode
              v-for="node in visibleNodes"
              :key="node.id"
              :node="node"
              :level="0"
              :selected-id="selectedNodeId"
              :expanded-paths="expandedPaths"
              :search-query="searchQuery"
              @select="selectNode"
              @toggle="toggleNode"
              @open="openFile"
            />
          </div>
        </template>
        <template v-else>
          <!-- Regular rendering for small trees -->
          <TreeNode
            v-for="node in filteredTree"
            :key="node.id"
            :node="node"
            :level="0"
            :selected-id="selectedNodeId"
            :expanded-paths="expandedPaths"
            :search-query="searchQuery"
            @select="selectNode"
            @toggle="toggleNode"
            @open="openFile"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileTreeStore } from '../composables/useFileTreeStore'
import { useToast } from '../composables/useToast'
import { useWebDAVStore } from '../composables/useWebDAVStore'
import { debounce } from '../utils/debounce'
import TreeNode from './TreeNode.vue'
import type { TreeNode as TreeNodeType } from '../types/fileTree'

// Props
const props = defineProps<{
  onFileOpen?: (path: string) => void
}>()

// Emits
const emit = defineEmits<{
  'file-selected': [path: string]
  'file-opened': [path: string]
}>()

// Composables
const { t } = useI18n()
const fileTreeStore = useFileTreeStore()
const webdavStore = useWebDAVStore()
const toast = useToast()

// Refs
const treeContainer = ref<HTMLElement>()
const virtualList = ref<HTMLElement>()
const searchQuery = ref('')
const error = ref<string | null>(null)
const selectedNodeId = ref<string | null>(null)
const expandedPaths = ref<Set<string>>(new Set())

// Use loading from store
const loading = computed(() => fileTreeStore.loading)

// Virtual scrolling
const virtualScrollHeight = ref(0)
const visibleNodes = ref<TreeNodeType[]>([])
const VIRTUAL_SCROLL_THRESHOLD = 100
const NODE_HEIGHT = 28 // Height of each tree node in pixels

// Computed
const filteredTree = computed(() => {
  if (!fileTreeStore.tree.value) {
    return []
  }
  return fileTreeStore.filterTree(fileTreeStore.tree.value, searchQuery.value)
})

const shouldUseVirtualScroll = computed(() => {
  return getTotalNodeCount(filteredTree.value) > VIRTUAL_SCROLL_THRESHOLD
})

// Debounced search
const onSearchInput = debounce((event: Event) => {
  const target = event.target as HTMLInputElement
  searchQuery.value = target.value
}, 300)

// Methods
function getTotalNodeCount(nodes: TreeNodeType[]): number {
  let count = 0
  const traverse = (nodeList: TreeNodeType[]) => {
    for (const node of nodeList) {
      count++
      if (node.children && expandedPaths.value.has(node.path)) {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return count
}

async function loadTree() {
  if (!webdavStore.isConnected) {
    error.value = t('fileTree.notConnected')
    return
  }

  error.value = null

  try {
    await fileTreeStore.loadTree()
    // Restore expanded paths from localStorage
    const stored = localStorage.getItem('fileTree:expandedPaths')
    if (stored) {
      expandedPaths.value = new Set(JSON.parse(stored))
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    toast.error(t('fileTree.loadError'))
  }
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId
  const node = findNodeById(filteredTree.value, nodeId)
  if (node) {
    emit('file-selected', node.path)
  }
}

function toggleNode(nodeId: string) {
  const node = findNodeById(filteredTree.value, nodeId)
  if (node && node.type === 'folder') {
    if (expandedPaths.value.has(node.path)) {
      expandedPaths.value.delete(node.path)
    } else {
      expandedPaths.value.add(node.path)
    }
    // Persist expanded paths
    localStorage.setItem('fileTree:expandedPaths', JSON.stringify(Array.from(expandedPaths.value)))
  }
}

function openFile(nodeId: string) {
  const node = findNodeById(filteredTree.value, nodeId)
  if (node && node.type === 'file') {
    emit('file-opened', node.path)
    if (props.onFileOpen) {
      props.onFileOpen(node.path)
    }
  }
}

function findNodeById(nodes: TreeNodeType[], id: string): TreeNodeType | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

function clearSearch() {
  searchQuery.value = ''
}

// Keyboard navigation
function handleKeyDown(event: KeyboardEvent) {
  if (!selectedNodeId.value) return

  const node = findNodeById(filteredTree.value, selectedNodeId.value)
  if (!node) return

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      navigateUp()
      break
    case 'ArrowDown':
      event.preventDefault()
      navigateDown()
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (node.type === 'folder' && expandedPaths.value.has(node.path)) {
        toggleNode(node.id)
      }
      break
    case 'ArrowRight':
      event.preventDefault()
      if (node.type === 'folder' && !expandedPaths.value.has(node.path)) {
        toggleNode(node.id)
      }
      break
    case 'Enter':
      event.preventDefault()
      if (node.type === 'file') {
        openFile(node.id)
      } else {
        toggleNode(node.id)
      }
      break
    case ' ':
      event.preventDefault()
      toggleNode(node.id)
      break
  }
}

function navigateUp() {
  // Implementation for keyboard navigation up
  if (!selectedNodeId.value) return
  
  const allVisibleNodes = getFlattenedVisibleNodes(filteredTree.value)
  const currentIndex = allVisibleNodes.findIndex(node => node.id === selectedNodeId.value)
  
  if (currentIndex > 0) {
    const previousNode = allVisibleNodes[currentIndex - 1]
    selectNode(previousNode.id)
    
    // Ensure the selected node is visible
    const element = document.querySelector(`[data-node-id="${previousNode.id}"]`)
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

function navigateDown() {
  // Implementation for keyboard navigation down
  if (!selectedNodeId.value) {
    // Select first node if nothing selected
    const allVisibleNodes = getFlattenedVisibleNodes(filteredTree.value)
    if (allVisibleNodes.length > 0) {
      selectNode(allVisibleNodes[0].id)
    }
    return
  }
  
  const allVisibleNodes = getFlattenedVisibleNodes(filteredTree.value)
  const currentIndex = allVisibleNodes.findIndex(node => node.id === selectedNodeId.value)
  
  if (currentIndex < allVisibleNodes.length - 1) {
    const nextNode = allVisibleNodes[currentIndex + 1]
    selectNode(nextNode.id)
    
    // Ensure the selected node is visible
    const element = document.querySelector(`[data-node-id="${nextNode.id}"]`)
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

function getFlattenedVisibleNodes(nodes: TreeNodeType[]): TreeNodeType[] {
  const result: TreeNodeType[] = []
  
  const traverse = (nodeList: TreeNodeType[]) => {
    for (const node of nodeList) {
      result.push(node)
      if (node.type === 'folder' && node.children && expandedPaths.value.has(node.path)) {
        traverse(node.children)
      }
    }
  }
  
  traverse(nodes)
  return result
}

// Watch for WebDAV connection changes
watch(() => webdavStore.connectionStatus, (newStatus) => {
  if (newStatus === 'connected') {
    loadTree()
  }
})

// Lifecycle
onMounted(() => {
  if (webdavStore.isConnected) {
    loadTree()
  }
})

onUnmounted(() => {
  // Clean up any event listeners if needed
})
</script>

<style scoped>
.file-tree-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.file-tree-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.file-tree-content.loading {
  opacity: 0.6;
  pointer-events: none;
}

.virtual-scroll-container {
  position: relative;
  overflow-y: auto;
}

/* Smooth animations */
.file-tree-content :deep(.tree-node-expand) {
  transition: transform 0.2s ease;
}

.file-tree-content :deep(.tree-node-expand.expanded) {
  transform: rotate(90deg);
}

/* Scrollbar styling */
.file-tree-content::-webkit-scrollbar {
  width: 6px;
}

.file-tree-content::-webkit-scrollbar-track {
  background: transparent;
}

.file-tree-content::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 3px;
}

.file-tree-content::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}
</style>