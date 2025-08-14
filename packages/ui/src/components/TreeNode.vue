<template>
  <div
    class="tree-node"
    :class="{ 
      'selected': isSelected,
      'dragging': isDragging && draggedNode?.id === node.id,
      'drop-target': isDropTarget
    }"
    :style="{ paddingLeft: level * 16 + 'px' }"
    :data-node-id="node.id"
  >
    <div
      class="tree-node-content"
      :draggable="!isEditing"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      @contextmenu.prevent="handleContextMenu"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
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

      <!-- Node name with search highlighting or inline edit -->
      <span v-if="isEditing" class="tree-node-name flex-1">
        <input
          ref="editInput"
          v-model="editValue"
          type="text"
          class="inline-edit-input w-full px-1 py-0 text-sm border border-blue-500 rounded"
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
          @blur="confirmRename"
          @click.stop
        />
      </span>
      <span v-else class="tree-node-name">
        <template v-if="searchQuery && highlightedName">
          <span v-html="highlightedName"></span>
        </template>
        <template v-else>
          {{ escapeHtml(node.name) }}
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
        :editing-node-id="editingNodeId"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
        @open="$emit('open', $event)"
        @contextmenu="$emit('contextmenu', $event)"
        @rename="(nodeId, newName) => $emit('rename', nodeId, newName)"
        @move="(source, target) => $emit('move', source, target)"
        @copy="(source, target) => $emit('copy', source, target)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue'
import { useDragAndDrop } from '../composables/useDragAndDrop'
import type { TreeNode as TreeNodeType } from '../types/fileTree'

// Props
const props = defineProps<{
  node: TreeNodeType
  level: number
  selectedId: string | null
  expandedPaths: Set<string>
  searchQuery: string
  editingNodeId?: string | null
}>()

// Emits
const emit = defineEmits<{
  'select': [nodeId: string]
  'toggle': [nodeId: string]
  'open': [nodeId: string]
  'contextmenu': [event: MouseEvent, node: TreeNodeType]
  'rename': [nodeId: string, newName: string]
  'move': [sourcePath: string, targetPath: string]
  'copy': [sourcePath: string, targetPath: string]
}>()

// Refs
const editInput = ref<HTMLInputElement>()
const editValue = ref('')
const isEditing = ref(false)

// Drag and drop
const dragAndDrop = useDragAndDrop()
const { isDragging, draggedNode, isDropTarget: checkDropTarget } = dragAndDrop

// Computed
const isSelected = computed(() => props.node.id === props.selectedId)
const isExpanded = computed(() => props.expandedPaths.has(props.node.path))
const isDropTarget = computed(() => checkDropTarget(props.node.id))

// Helper function to escape HTML entities
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

const highlightedName = computed(() => {
  if (!props.searchQuery) return null
  
  const query = props.searchQuery.toLowerCase()
  const name = props.node.name
  const lowerName = name.toLowerCase()
  const index = lowerName.indexOf(query)
  
  if (index === -1) return null
  
  // Escape HTML entities to prevent XSS
  const before = escapeHtml(name.substring(0, index))
  const match = escapeHtml(name.substring(index, index + query.length))
  const after = escapeHtml(name.substring(index + query.length))
  
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

// Rename functionality
function startEdit() {
  isEditing.value = true
  editValue.value = props.node.name
  nextTick(() => {
    editInput.value?.focus()
    editInput.value?.select()
  })
}

function confirmRename() {
  if (!isEditing.value) return
  
  const newName = editValue.value.trim()
  if (newName && newName !== props.node.name) {
    // Validate filename
    if (validateFilename(newName)) {
      emit('rename', props.node.id, newName)
    }
  }
  cancelRename()
}

function cancelRename() {
  isEditing.value = false
  editValue.value = ''
}

function validateFilename(name: string): boolean {
  // Basic filename validation
  if (!name || name.length === 0) return false
  if (name.length > 255) return false
  
  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1f]/
  if (invalidChars.test(name)) return false
  
  // Check for reserved names (Windows)
  const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  if (reserved.test(name)) return false
  
  return true
}

// Watch for external editing trigger
watch(() => props.editingNodeId, (newId) => {
  if (newId === props.node.id) {
    startEdit()
  } else if (isEditing.value) {
    cancelRename()
  }
})

// Drag and drop handlers
function handleDragStart(event: DragEvent) {
  if (isEditing.value) {
    event.preventDefault()
    return
  }
  dragAndDrop.startDrag(props.node, event)
}

function handleDragEnd() {
  dragAndDrop.endDrag()
}

function handleDragOver(event: DragEvent) {
  if (props.node.type === 'folder') {
    dragAndDrop.handleDragOver(props.node, event)
  }
}

function handleDragEnter(event: DragEvent) {
  if (props.node.type === 'folder') {
    dragAndDrop.handleDragEnter(props.node, event)
  }
}

function handleDragLeave(event: DragEvent) {
  if (props.node.type === 'folder') {
    dragAndDrop.handleDragLeave(props.node, event)
  }
}

function handleDrop(event: DragEvent) {
  if (props.node.type === 'folder') {
    const result = dragAndDrop.handleDrop(props.node, event)
    if (result) {
      const targetPath = `${props.node.path}/${result.source.name}`
      if (result.operation === 'copy') {
        emit('copy', result.source.path, targetPath)
      } else {
        emit('move', result.source.path, targetPath)
      }
    }
  }
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

/* Inline edit styling */
.inline-edit-input {
  background: white;
  color: black;
  font-size: 0.875rem;
  outline: none;
}

.dark .inline-edit-input {
  background: #1f2937;
  color: white;
  border-color: #3b82f6;
}

.inline-edit-input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Drag and drop styling */
.tree-node-content[draggable="true"] {
  cursor: move;
}

.tree-node.dragging {
  opacity: 0.5;
}

.tree-node.drop-target > .tree-node-content {
  background-color: rgba(59, 130, 246, 0.2);
  border: 1px dashed rgba(59, 130, 246, 0.5);
  border-radius: 4px;
}

.dark .tree-node.drop-target > .tree-node-content {
  background-color: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.6);
}
</style>