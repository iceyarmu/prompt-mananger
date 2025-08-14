import { ref, computed, Ref } from 'vue'
import type { TreeNode } from '../types/fileTree'

export interface DragState {
  isDragging: boolean
  draggedNode: TreeNode | null
  dragOperation: 'move' | 'copy'
  dropTarget: string | null
  canDrop: boolean
}

const dragState = ref<DragState>({
  isDragging: false,
  draggedNode: null,
  dragOperation: 'move',
  dropTarget: null,
  canDrop: false
})

export function useDragAndDrop() {
  const isDragging = computed(() => dragState.value.isDragging)
  const draggedNode = computed(() => dragState.value.draggedNode)
  const dragOperation = computed(() => dragState.value.dragOperation)
  const dropTarget = computed(() => dragState.value.dropTarget)
  const canDrop = computed(() => dragState.value.canDrop)
  
  function startDrag(node: TreeNode, event: DragEvent) {
    dragState.value.isDragging = true
    dragState.value.draggedNode = node
    dragState.value.dragOperation = (event.ctrlKey || event.metaKey) ? 'copy' : 'move'
    
    // Set drag data
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = dragState.value.dragOperation === 'copy' ? 'copy' : 'move'
      event.dataTransfer.setData('text/plain', node.path)
      
      // Create custom drag image with safe cleanup
      let dragImage: HTMLDivElement | null = null
      try {
        dragImage = document.createElement('div')
        dragImage.textContent = node.name
        dragImage.style.position = 'absolute'
        dragImage.style.top = '-1000px'
        dragImage.style.padding = '4px 8px'
        dragImage.style.background = 'rgba(59, 130, 246, 0.1)'
        dragImage.style.border = '1px solid rgba(59, 130, 246, 0.5)'
        dragImage.style.borderRadius = '4px'
        dragImage.style.fontSize = '14px'
        dragImage.setAttribute('data-drag-image', 'true')
        document.body.appendChild(dragImage)
        event.dataTransfer.setDragImage(dragImage, 0, 0)
        
        // Remove drag image after drag starts with safe cleanup
        const imageToRemove = dragImage
        setTimeout(() => {
          try {
            if (imageToRemove && imageToRemove.parentNode) {
              imageToRemove.parentNode.removeChild(imageToRemove)
            }
          } catch (cleanupError) {
            // Silently ignore cleanup errors
            console.debug('Drag image cleanup error:', cleanupError)
          }
        }, 0)
      } catch (error) {
        // If drag image creation fails, continue without custom image
        console.debug('Failed to create drag image:', error)
        // Attempt cleanup if image was partially created
        if (dragImage && dragImage.parentNode) {
          try {
            dragImage.parentNode.removeChild(dragImage)
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
  }
  
  function handleDragOver(targetNode: TreeNode, event: DragEvent) {
    event.preventDefault()
    
    if (!dragState.value.draggedNode) return
    
    // Check if drop is valid
    const isValidDrop = validateDrop(dragState.value.draggedNode, targetNode)
    
    if (isValidDrop) {
      dragState.value.dropTarget = targetNode.id
      dragState.value.canDrop = true
      
      // Update drag operation based on keys
      dragState.value.dragOperation = (event.ctrlKey || event.metaKey) ? 'copy' : 'move'
      
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = dragState.value.dragOperation === 'copy' ? 'copy' : 'move'
      }
    } else {
      dragState.value.dropTarget = null
      dragState.value.canDrop = false
      
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none'
      }
    }
  }
  
  function handleDragEnter(targetNode: TreeNode, event: DragEvent) {
    event.preventDefault()
    
    if (!dragState.value.draggedNode) return
    
    const isValidDrop = validateDrop(dragState.value.draggedNode, targetNode)
    if (isValidDrop) {
      dragState.value.dropTarget = targetNode.id
      dragState.value.canDrop = true
    }
  }
  
  function handleDragLeave(targetNode: TreeNode, event: DragEvent) {
    // Only clear drop target if we're leaving the actual target, not a child
    const relatedTarget = event.relatedTarget as HTMLElement
    const currentTarget = event.currentTarget as HTMLElement
    
    if (!currentTarget.contains(relatedTarget)) {
      if (dragState.value.dropTarget === targetNode.id) {
        dragState.value.dropTarget = null
        dragState.value.canDrop = false
      }
    }
  }
  
  function handleDrop(targetNode: TreeNode, event: DragEvent): { source: TreeNode; target: TreeNode; operation: 'move' | 'copy' } | null {
    event.preventDefault()
    event.stopPropagation()
    
    const sourceNode = dragState.value.draggedNode
    if (!sourceNode || !validateDrop(sourceNode, targetNode)) {
      endDrag()
      return null
    }
    
    const operation = dragState.value.dragOperation
    
    // Clear drag state
    endDrag()
    
    return {
      source: sourceNode,
      target: targetNode,
      operation
    }
  }
  
  function endDrag() {
    dragState.value.isDragging = false
    dragState.value.draggedNode = null
    dragState.value.dropTarget = null
    dragState.value.canDrop = false
    dragState.value.dragOperation = 'move'
  }
  
  function validateDrop(sourceNode: TreeNode, targetNode: TreeNode): boolean {
    // Can't drop on itself
    if (sourceNode.id === targetNode.id) return false
    
    // Can't drop on non-folders (unless it's the parent folder for reordering)
    if (targetNode.type !== 'folder') return false
    
    // Can't drop a parent into its own child
    if (isDescendant(sourceNode, targetNode)) return false
    
    // Can't drop into the same parent (for move operation)
    if (dragState.value.dragOperation === 'move') {
      const sourcePath = sourceNode.path
      const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/'
      if (sourceParent === targetNode.path) return false
    }
    
    return true
  }
  
  function isDescendant(parentNode: TreeNode, possibleChild: TreeNode): boolean {
    // Check if possibleChild is a descendant of parentNode
    return possibleChild.path.startsWith(parentNode.path + '/')
  }
  
  function isDropTarget(nodeId: string): boolean {
    return dragState.value.dropTarget === nodeId && dragState.value.canDrop
  }
  
  function getDragClass(nodeId: string): string {
    if (!dragState.value.isDragging) return ''
    
    if (dragState.value.draggedNode?.id === nodeId) {
      return 'dragging-source'
    }
    
    if (isDropTarget(nodeId)) {
      return 'drop-target'
    }
    
    return ''
  }
  
  return {
    // State
    isDragging,
    draggedNode,
    dragOperation,
    dropTarget,
    canDrop,
    
    // Methods
    startDrag,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    endDrag,
    isDropTarget,
    getDragClass
  }
}