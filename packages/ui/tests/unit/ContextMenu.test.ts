import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextMenu from '../../src/components/ContextMenu.vue'
import type { ContextMenuItem } from '../../src/components/ContextMenu.vue'

describe('ContextMenu', () => {
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
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      action: vi.fn(),
      shortcut: 'Del',
      danger: true
    }
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
  })
  
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('renders when visible', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Check if menu is rendered in teleport target
      const menu = document.querySelector('.context-menu')
      expect(menu).toBeTruthy()
    })

    it('does not render when not visible', () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: false,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      const menu = document.querySelector('.context-menu')
      expect(menu).toBeFalsy()
    })

    it('renders menu items correctly', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      // Should have 3 items (excluding divider)
      expect(menuItems.length).toBe(3)
    })

    it('renders dividers correctly', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const dividers = document.querySelectorAll('.border-t')
      expect(dividers.length).toBe(1)
    })

    it('shows danger styling for danger items', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      const deleteItem = menuItems[2]
      expect(deleteItem.classList.contains('text-red-600')).toBe(true)
    })

    it('shows shortcuts when provided', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const shortcuts = document.querySelectorAll('kbd')
      expect(shortcuts.length).toBe(3)
      expect(shortcuts[0].textContent).toBe('Enter')
      expect(shortcuts[1].textContent).toBe('F2')
      expect(shortcuts[2].textContent).toBe('Del')
    })
  })

  describe('Interactions', () => {
    it('calls action when item is clicked', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      const openItem = menuItems[0] as HTMLElement
      openItem.click()
      
      expect(mockItems[0].action).toHaveBeenCalled()
    })

    it('emits close event when item is clicked', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      const openItem = menuItems[0] as HTMLElement
      openItem.click()
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits item-click event when item is clicked', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      const openItem = menuItems[0] as HTMLElement
      openItem.click()
      
      expect(wrapper.emitted('item-click')).toBeTruthy()
      expect(wrapper.emitted('item-click')[0]).toEqual([mockItems[0]])
    })

    it('does not call action for disabled items', async () => {
      const itemsWithDisabled = [
        { ...mockItems[0], disabled: true }
      ]
      
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: itemsWithDisabled
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItem = document.querySelector('.context-menu-item') as HTMLElement
      menuItem.click()
      
      expect(itemsWithDisabled[0].action).not.toHaveBeenCalled()
    })
  })

  describe('Click Outside', () => {
    it('emits close when clicking outside', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Wait for click listener to be attached
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Click outside
      document.body.click()
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Keyboard Handling', () => {
    it('emits close on Escape key', async () => {
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: mockItems
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Wait for event listener to be attached
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(escapeEvent)
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })
    
    it('navigates down with ArrowDown key', async () => {
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
      
      // Press ArrowDown
      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      document.dispatchEvent(arrowDownEvent)
      
      await nextTick()
      
      // Check that highlightedIndex is updated (first non-divider item index is 0)
      expect(wrapper.vm.highlightedIndex).toBe(0)
    })
    
    it('navigates up with ArrowUp key', async () => {
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
      
      // Press ArrowUp (should wrap to last item)
      const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      document.dispatchEvent(arrowUpEvent)
      
      await nextTick()
      
      // Last non-divider item index is 3 (Delete item)
      expect(wrapper.vm.highlightedIndex).toBe(3)
    })
    
    it('jumps to first item with Home key', async () => {
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
      
      // Press Home
      const homeEvent = new KeyboardEvent('keydown', { key: 'Home' })
      document.dispatchEvent(homeEvent)
      
      await nextTick()
      
      // First item index is 0
      expect(wrapper.vm.highlightedIndex).toBe(0)
    })
    
    it('jumps to last item with End key', async () => {
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
      
      // Press End
      const endEvent = new KeyboardEvent('keydown', { key: 'End' })
      document.dispatchEvent(endEvent)
      
      await nextTick()
      
      // Last non-divider item index is 3 (Delete item)
      expect(wrapper.vm.highlightedIndex).toBe(3)
    })
    
    it('activates item with Enter key', async () => {
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
      
      // Navigate to first item
      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      document.dispatchEvent(arrowDownEvent)
      
      await nextTick()
      
      // Press Enter
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(enterEvent)
      
      expect(mockItems[0].action).toHaveBeenCalled()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
    
    it('cycles through items with Tab key', async () => {
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
      
      // Press Tab
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      document.dispatchEvent(tabEvent)
      
      await nextTick()
      
      expect(wrapper.vm.highlightedIndex).toBe(0)
      
      // Press Tab again
      const tabEvent2 = new KeyboardEvent('keydown', { key: 'Tab' })
      document.dispatchEvent(tabEvent2)
      
      await nextTick()
      
      expect(wrapper.vm.highlightedIndex).toBe(1)
    })
    
    it('cycles backwards with Shift+Tab', async () => {
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
      
      // Press Shift+Tab (should wrap to last item)
      const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
      document.dispatchEvent(shiftTabEvent)
      
      await nextTick()
      
      // Last non-divider item index is 3
      expect(wrapper.vm.highlightedIndex).toBe(3)
    })
  })

  describe('Hidden Items', () => {
    it('filters out hidden items', async () => {
      const itemsWithHidden = [
        ...mockItems,
        { id: 'hidden', label: 'Hidden', hidden: true }
      ]
      
      wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          x: 100,
          y: 200,
          items: itemsWithHidden
        }
      })
      
      await wrapper.vm.$nextTick()
      
      const menuItems = document.querySelectorAll('.context-menu-item')
      // Should still have 3 items (hidden one filtered out)
      expect(menuItems.length).toBe(3)
    })
  })
})