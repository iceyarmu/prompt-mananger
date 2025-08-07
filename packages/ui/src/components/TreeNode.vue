<template>
  <div
    class="tree-node"
    :class="{ 'selected': isSelected }"
    :style="{ paddingLeft: level * 16 + 'px' }"
    :data-node-id="node.id"
  >
    <div
      class="tree-node-content"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      @contextmenu.prevent="handleContextMenu"
      :title="node.path"
      :aria-expanded="node.type === 'folder' ? isExpanded : undefined"
      :aria-selected="isSelected"
      role="treeitem"
    >
      <!-- Expand/collapse icon for folders -->
      <span
        v-if="node.type === 'folder'"
        class="tree-node-expand"
        :class="{ 'expanded': isExpanded }"
        @click.stop="toggleExpand"
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </span>
      <span v-else class="tree-node-expand-placeholder"></span>

      <!-- File/folder icon -->
      <span class="tree-node-icon">
        <svg v-if="node.type === 'folder'" class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <svg v-else class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </span>

      <!-- Node name with search highlighting -->
      <span class="tree-node-name">
        <template v-if="searchQuery && highlightedName">
          <span v-html="highlightedName"></span>
        </template>
        <template v-else>
          {{ node.name }}
        </template>
      </span>
    </div>

    <!-- Children nodes (recursive) -->
    <div v-if="node.type === 'folder' && isExpanded && node.children" class="tree-node-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :selected-id="selectedId"
        :expanded-paths="expandedPaths"
        :search-query="searchQuery"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
        @open="$emit('open', $event)"
        @contextmenu="$emit('contextmenu', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TreeNode as TreeNodeType } from '../types/fileTree'

// Props
const props = defineProps<{
  node: TreeNodeType
  level: number
  selectedId: string | null
  expandedPaths: Set<string>
  searchQuery: string
}>()

// Emits
const emit = defineEmits<{
  'select': [nodeId: string]
  'toggle': [nodeId: string]
  'open': [nodeId: string]
  'contextmenu': [event: MouseEvent, node: TreeNodeType]
}>()

// Computed
const isSelected = computed(() => props.node.id === props.selectedId)
const isExpanded = computed(() => props.expandedPaths.has(props.node.path))

const highlightedName = computed(() => {
  if (!props.searchQuery) return null
  
  const query = props.searchQuery.toLowerCase()
  const name = props.node.name
  const lowerName = name.toLowerCase()
  const index = lowerName.indexOf(query)
  
  if (index === -1) return null
  
  const before = name.substring(0, index)
  const match = name.substring(index, index + query.length)
  const after = name.substring(index + query.length)
  
  return `${before}<mark class="bg-yellow-200 text-gray-900">${match}</mark>${after}`
})

// Methods
function handleClick() {
  emit('select', props.node.id)
  if (props.node.type === 'folder') {
    emit('toggle', props.node.id)
  }
}

function handleDoubleClick() {
  if (props.node.type === 'file') {
    emit('open', props.node.id)
  }
}

function toggleExpand() {
  emit('toggle', props.node.id)
}

function handleContextMenu(event: MouseEvent) {
  emit('select', props.node.id)
  emit('contextmenu', event, props.node)
}
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  min-height: 28px;
}

.tree-node-content:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dark .tree-node-content:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.tree-node.selected .tree-node-content {
  background-color: rgba(59, 130, 246, 0.15);
}

.dark .tree-node.selected .tree-node-content {
  background-color: rgba(59, 130, 246, 0.25);
}

.tree-node-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.tree-node-expand.expanded {
  transform: rotate(90deg);
}

.tree-node-expand-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tree-node-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.tree-node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.tree-node-children {
  position: relative;
}

/* Animation for expand/collapse */
.tree-node-children {
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Search highlight */
.tree-node-name :deep(mark) {
  background-color: #fef08a;
  color: #1f2937;
  padding: 0 2px;
  border-radius: 2px;
}

.dark .tree-node-name :deep(mark) {
  background-color: #854d0e;
  color: #fef3c7;
}
</style>