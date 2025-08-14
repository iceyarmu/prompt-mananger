import { describe, it, expect, beforeEach } from 'vitest'
import { useDragAndDrop } from '../useDragAndDrop'
import type { TreeNode } from '../../types/fileTree'

describe('useDragAndDrop', () => {
  let dragAndDrop: ReturnType<typeof useDragAndDrop>
  
  const createNode = (id: string, name: string, type: 'file' | 'folder', path: string): TreeNode => ({
    id,
    name,
    type,
    path,
    children: type === 'folder' ? [] : undefined
  })

  beforeEach(() => {
    dragAndDrop = useDragAndDrop()
  })

  describe('startDrag', () => {
    it('should set drag state when starting drag', () => {
      const node = createNode('1', 'file.md', 'file', '/file.md')
      const event = new DragEvent('dragstart')
      
      dragAndDrop.startDrag(node, event)
      
      expect(dragAndDrop.isDragging.value).toBe(true)
      expect(dragAndDrop.draggedNode.value).toEqual(node)
      expect(dragAndDrop.dragOperation.value).toBe('move')
    })

    it('should set copy operation when Ctrl/Cmd key is pressed', () => {
      const node = createNode('1', 'file.md', 'file', '/file.md')
      const event = new DragEvent('dragstart', { ctrlKey: true })
      
      dragAndDrop.startDrag(node, event)
      
      expect(dragAndDrop.dragOperation.value).toBe('copy')
    })
  })

  describe('handleDragOver', () => {
    it('should set drop target for valid drop', () => {
      const sourceNode = createNode('1', 'file.md', 'file', '/file.md')
      const targetNode = createNode('2', 'folder', 'folder', '/folder')
      const event = new DragEvent('dragover')
      
      dragAndDrop.startDrag(sourceNode, event)
      dragAndDrop.handleDragOver(targetNode, event)
      
      expect(dragAndDrop.dropTarget.value).toBe('2')
      expect(dragAndDrop.canDrop.value).toBe(true)
    })

    it('should not allow drop on non-folders', () => {
      const sourceNode = createNode('1', 'file1.md', 'file', '/file1.md')
      const targetNode = createNode('2', 'file2.md', 'file', '/file2.md')
      const event = new DragEvent('dragover')
      
      dragAndDrop.startDrag(sourceNode, event)
      dragAndDrop.handleDragOver(targetNode, event)
      
      expect(dragAndDrop.dropTarget.value).toBe(null)
      expect(dragAndDrop.canDrop.value).toBe(false)
    })

    it('should not allow drop on itself', () => {
      const node = createNode('1', 'folder', 'folder', '/folder')
      const event = new DragEvent('dragover')
      
      dragAndDrop.startDrag(node, event)
      dragAndDrop.handleDragOver(node, event)
      
      expect(dragAndDrop.canDrop.value).toBe(false)
    })

    it('should not allow parent to be dropped into child', () => {
      const parentNode = createNode('1', 'parent', 'folder', '/parent')
      const childNode = createNode('2', 'child', 'folder', '/parent/child')
      const event = new DragEvent('dragover')
      
      dragAndDrop.startDrag(parentNode, event)
      dragAndDrop.handleDragOver(childNode, event)
      
      expect(dragAndDrop.canDrop.value).toBe(false)
    })
  })

  describe('handleDrop', () => {
    it('should return drop result for valid drop', () => {
      const sourceNode = createNode('1', 'file.md', 'file', '/file.md')
      const targetNode = createNode('2', 'folder', 'folder', '/folder')
      const dragEvent = new DragEvent('dragstart')
      const dropEvent = new DragEvent('drop')
      
      dragAndDrop.startDrag(sourceNode, dragEvent)
      const result = dragAndDrop.handleDrop(targetNode, dropEvent)
      
      expect(result).toEqual({
        source: sourceNode,
        target: targetNode,
        operation: 'move'
      })
      expect(dragAndDrop.isDragging.value).toBe(false)
    })

    it('should return null for invalid drop', () => {
      const sourceNode = createNode('1', 'file.md', 'file', '/file.md')
      const targetNode = createNode('2', 'file2.md', 'file', '/file2.md')
      const dragEvent = new DragEvent('dragstart')
      const dropEvent = new DragEvent('drop')
      
      dragAndDrop.startDrag(sourceNode, dragEvent)
      const result = dragAndDrop.handleDrop(targetNode, dropEvent)
      
      expect(result).toBe(null)
    })

    it('should handle copy operation', () => {
      const sourceNode = createNode('1', 'file.md', 'file', '/file.md')
      const targetNode = createNode('2', 'folder', 'folder', '/folder')
      const dragEvent = new DragEvent('dragstart', { ctrlKey: true })
      const dropEvent = new DragEvent('drop')
      
      dragAndDrop.startDrag(sourceNode, dragEvent)
      const result = dragAndDrop.handleDrop(targetNode, dropEvent)
      
      expect(result?.operation).toBe('copy')
    })
  })

  describe('endDrag', () => {
    it('should clear all drag state', () => {
      const node = createNode('1', 'file.md', 'file', '/file.md')
      const event = new DragEvent('dragstart')
      
      dragAndDrop.startDrag(node, event)
      dragAndDrop.endDrag()
      
      expect(dragAndDrop.isDragging.value).toBe(false)
      expect(dragAndDrop.draggedNode.value).toBe(null)
      expect(dragAndDrop.dropTarget.value).toBe(null)
      expect(dragAndDrop.canDrop.value).toBe(false)
    })
  })

  describe('isDropTarget', () => {
    it('should return true for current drop target', () => {
      const sourceNode = createNode('1', 'file.md', 'file', '/file.md')
      const targetNode = createNode('2', 'folder', 'folder', '/folder')
      const event = new DragEvent('dragover')
      
      dragAndDrop.startDrag(sourceNode, event)
      dragAndDrop.handleDragOver(targetNode, event)
      
      expect(dragAndDrop.isDropTarget('2')).toBe(true)
      expect(dragAndDrop.isDropTarget('1')).toBe(false)
    })
  })

  describe('getDragClass', () => {
    it('should return dragging-source for dragged node', () => {
      const node = createNode('1', 'file.md', 'file', '/file.md')
      const event = new DragEvent('dragstart')
      
      dragAndDrop.startDrag(node, event)
      
      expect(dragAndDrop.getDragClass('1')).toBe('dragging-source')
    })

    it('should return drop-target for drop target node', () => {
      const sourceNode = createNode('1', 'file.md', 'file', '/file.md')
      const targetNode = createNode('2', 'folder', 'folder', '/folder')
      const event = new DragEvent('dragover')
      
      dragAndDrop.startDrag(sourceNode, event)
      dragAndDrop.handleDragOver(targetNode, event)
      
      expect(dragAndDrop.getDragClass('2')).toBe('drop-target')
    })

    it('should return empty string when not dragging', () => {
      expect(dragAndDrop.getDragClass('1')).toBe('')
    })
  })
})