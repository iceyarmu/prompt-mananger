import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextMenu from '../../src/components/ContextMenu.vue'
import type { ContextMenuItem } from '../../src/components/ContextMenu.vue'

describe('ContextMenu Integration Tests', () => {
  let wrapper: any
  
  const mockItems: ContextMenuItem[] = [
    {
      id: 'open',
      label: 'Open',
      icon: 'file-open',
      action: vi.fn(),
      shortcut: 'Enter'
    },
    {
      id: 'rename',
      label: 'Rename',
      icon: 'edit',
      action: vi.fn(),
      shortcut: 'F2'
    },
    { id: 'divider1', divider: true },
    {
      id: 'copy',
      label: 'Copy',
      icon: 'copy',
      action: vi.fn()
    },
    {
      id: 'paste',
      label: 'Paste',
      icon: 'paste',
      action: vi.fn(),
      disabled: true
    },
    { id: 'divider2', divider: true },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      action: vi.fn(),
      shortcut: 'Del',
      danger: true
    }
  ]
  
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })
  
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Complete Menu Interaction Flow', () => {
    it('should handle complete keyboard navigation flow', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Navigate down through items
      const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      document.dispatchEvent(arrowDown)
      await nextTick()
      expect(wrapper.vm.highlightedIndex).toBe(0) // Open
      
      document.dispatchEvent(arrowDown)
      await nextTick()
      expect(wrapper.vm.highlightedIndex).toBe(1) // Rename
      
      document.dispatchEvent(arrowDown)
      await nextTick()
      expect(wrapper.vm.highlightedIndex).toBe(3) // Copy (skips divider)
      
      document.dispatchEvent(arrowDown)
      await nextTick()
      expect(wrapper.vm.highlightedIndex).toBe(6) // Delete (skips disabled Paste and divider)
      
      // Navigate back up
      const arrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      document.dispatchEvent(arrowUp)
      await nextTick()
      expect(wrapper.vm.highlightedIndex).toBe(3) // Copy
      
      // Select item with Enter
      const enter = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(enter)
      
      expect(mockItems[3].action).toHaveBeenCalled()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
    
    it('should handle mouse and keyboard interaction combined', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      
      // Mouse hover on item
      const menuItems = document.querySelectorAll('.context-menu-item')
      const copyItem = menuItems[2] as HTMLElement // Copy item (index 3 in items, but 2 in rendered items)
      
      if (copyItem) {
        await copyItem.dispatchEvent(new MouseEvent('mouseenter'))
        await nextTick()
        
        expect(wrapper.vm.highlightedIndex).toBe(3) // Copy item index in original array
        
        // Now use keyboard to navigate
        const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        document.dispatchEvent(arrowDown)
        await nextTick()
        
        expect(wrapper.vm.highlightedIndex).toBe(6) // Delete
        
        // Click to select
        const deleteItem = menuItems[4] as HTMLElement // Delete item
        if (deleteItem) {
          deleteItem.click()
          expect(mockItems[6].action).toHaveBeenCalled()
        }
      }
    })
  })

  describe('Accessibility Features', () => {
    it('should have proper ARIA attributes', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      
      const menu = document.querySelector('.context-menu')
      expect(menu?.getAttribute('role')).toBe('menu')
      expect(menu?.getAttribute('tabindex')).toBe('-1')
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      menuItems.forEach(item => {
        expect(item.getAttribute('role')).toBe('menuitem')
        const isDisabled = item.classList.contains('cursor-not-allowed')
        expect(item.getAttribute('tabindex')).toBe(isDisabled ? '-1' : '0')
      })
    })
    
    it('should focus menu when opened for keyboard navigation', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 50)) // Wait for focus
      
      const menu = document.querySelector('.context-menu') as HTMLElement
      // Menu should be focusable for keyboard navigation
      expect(menu?.tabIndex).toBe(-1)
    })
  })

  describe('Dynamic Menu Updates', () => {
    it('should handle dynamic item changes', async () => {
      const dynamicItems = [...mockItems]
      
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: dynamicItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      
      let menuItems = document.querySelectorAll('.context-menu-item')
      expect(menuItems.length).toBe(5) // 7 items - 2 dividers
      
      // Add new item
      const newItem = {
        id: 'new',
        label: 'New Item',
        action: vi.fn()
      }
      await wrapper.setProps({
        items: [...dynamicItems, newItem]
      })
      
      await nextTick()
      
      menuItems = document.querySelectorAll('.context-menu-item')
      expect(menuItems.length).toBe(6) // Added one item
    })
    
    it('should handle visibility toggling', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: false,
          x: 100,
          y: 200,
          items: mockItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      
      // Menu should not be visible
      let menu = document.querySelector('.context-menu')
      expect(menu).toBeFalsy()
      
      // Show menu
      await wrapper.setProps({ visible: true })
      await nextTick()
      
      menu = document.querySelector('.context-menu')
      expect(menu).toBeTruthy()
      
      // Hide menu
      await wrapper.setProps({ visible: false })
      await nextTick()
      
      menu = document.querySelector('.context-menu')
      expect(menu).toBeFalsy()
    })
  })

  describe('Performance with Large Menus', () => {
    it('should handle menu with many items efficiently', async () => {
      // Create large menu with 100 items
      const largeItems: ContextMenuItem[] = []
      for (let i = 0; i < 100; i++) {
        largeItems.push({
          id: `item-${i}`,
          label: `Item ${i}`,
          action: vi.fn()
        })
      }
      
      const startTime = performance.now()
      
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: largeItems
        },
        attachTo: document.body
      })
      
      await nextTick()
      
      const renderTime = performance.now() - startTime
      
      // Should render within reasonable time (< 100ms)
      expect(renderTime).toBeLessThan(100)
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      expect(menuItems.length).toBe(100)
      
      // Test scrolling performance
      const menu = document.querySelector('.context-menu') as HTMLElement
      if (menu) {
        // Menu should have scrollbar due to max-height
        expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty menu gracefully', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: []
        },
        attachTo: document.body
      })
      
      await nextTick()
      
      const menu = document.querySelector('.context-menu')
      expect(menu).toBeTruthy()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      expect(menuItems.length).toBe(0)
    })
    
    it('should handle all disabled items', async () => {
      const allDisabled = mockItems.map(item => ({
        ...item,
        disabled: !item.divider
      }))
      
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: allDisabled
        },
        attachTo: document.body
      })
      
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Try to navigate - should not highlight any item
      const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      document.dispatchEvent(arrowDown)
      await nextTick()
      
      expect(wrapper.vm.highlightedIndex).toBe(-1) // No item highlighted
      
      // Try to activate with Enter - nothing should happen
      const enter = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(enter)
      
      expect(wrapper.emitted('close')).toBeFalsy()
    })
    
    it('should handle rapid show/hide cycles', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: false,
          x: 100,
          y: 200,
          items: mockItems
        },
        attachTo: document.body
      })
      
      // Rapidly toggle visibility
      for (let i = 0; i < 10; i++) {
        await wrapper.setProps({ visible: true })
        await nextTick()
        await wrapper.setProps({ visible: false })
        await nextTick()
      }
      
      // Final state should be correct
      await wrapper.setProps({ visible: true })
      await nextTick()
      
      const menu = document.querySelector('.context-menu')
      expect(menu).toBeTruthy()
      
      // Should still be functional
      const menuItems = document.querySelectorAll('.context-menu-item')
      expect(menuItems.length).toBe(5)
    })
  })
})