import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppLayout from '@/components/AppLayout.vue'
import { usePreferencesStore } from '@/stores/preferences'

describe('AppLayout.vue', () => {
  let wrapper: VueWrapper<any>
  let preferencesStore: ReturnType<typeof usePreferencesStore>

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia())
    preferencesStore = usePreferencesStore()
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    })
  })

  const createWrapper = (props = {}, slots = {}) => {
    return mount(AppLayout, {
      props,
      slots: {
        header: '<div>Header</div>',
        left: '<div>Left Panel</div>',
        center: '<div>Center Panel</div>',
        right: '<div>Right Panel</div>',
        ...slots
      }
    })
  }

  describe('Layout Structure', () => {
    it('renders three-panel layout structure', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.app-layout').exists()).toBe(true)
      expect(wrapper.find('.app-layout__header').exists()).toBe(true)
      expect(wrapper.find('.app-layout__body').exists()).toBe(true)
      expect(wrapper.findAll('.app-layout__panel').length).toBe(3)
    })

    it('renders correct panel classes', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.app-layout__panel--left').exists()).toBe(true)
      expect(wrapper.find('.app-layout__panel--center').exists()).toBe(true)
      expect(wrapper.find('.app-layout__panel--right').exists()).toBe(true)
    })

    it('renders slot content in correct panels', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.app-layout__header').text()).toContain('Header')
      expect(wrapper.find('.app-layout__panel--left').text()).toContain('Left Panel')
      expect(wrapper.find('.app-layout__panel--center').text()).toContain('Center Panel')
      expect(wrapper.find('.app-layout__panel--right').text()).toContain('Right Panel')
    })

    it('applies min/max width constraints from props', () => {
      wrapper = createWrapper({
        minLeftWidth: 150,
        maxLeftWidth: 500,
        minRightWidth: 250,
        maxRightWidth: 600
      })
      
      const vm = wrapper.vm as any
      expect(vm.MIN_LEFT_WIDTH).toBe(150)
      expect(vm.MAX_LEFT_WIDTH).toBe(500)
      expect(vm.MIN_RIGHT_WIDTH).toBe(250)
      expect(vm.MAX_RIGHT_WIDTH).toBe(600)
    })
  })

  describe('Responsive Design', () => {
    it('detects mobile breakpoint', async () => {
      window.innerWidth = 767
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.app-layout--mobile').exists()).toBe(true)
      expect(wrapper.find('.app-layout__mobile-switcher').exists()).toBe(true)
    })

    it('detects tablet breakpoint', async () => {
      window.innerWidth = 900
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.app-layout--tablet').exists()).toBe(true)
      expect(wrapper.find('.app-layout__mobile-switcher').exists()).toBe(false)
    })

    it('detects desktop breakpoint', async () => {
      window.innerWidth = 1920
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.app-layout--desktop').exists()).toBe(true)
      expect(wrapper.find('.app-layout__mobile-switcher').exists()).toBe(false)
    })

    it('shows resize handles on desktop only', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.app-layout__resize-handle--left').exists()).toBe(true)
      expect(wrapper.find('.app-layout__resize-handle--right').exists()).toBe(true)
    })

    it('hides resize handles on mobile', async () => {
      window.innerWidth = 500
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.app-layout__resize-handle--left').exists()).toBe(false)
      expect(wrapper.find('.app-layout__resize-handle--right').exists()).toBe(false)
    })
  })

  describe('Panel Collapse/Expand', () => {
    it('renders collapse buttons for side panels', () => {
      wrapper = createWrapper()
      
      const buttons = wrapper.findAll('.app-layout__collapse-btn')
      expect(buttons.length).toBe(2)
    })

    it('toggles left panel collapse state', async () => {
      wrapper = createWrapper()
      const leftButton = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      
      expect(wrapper.find('.app-layout__panel--left').classes()).not.toContain('app-layout__panel--collapsed')
      
      await leftButton.trigger('click')
      expect(wrapper.find('.app-layout__panel--left').classes()).toContain('app-layout__panel--collapsed')
      
      await leftButton.trigger('click')
      expect(wrapper.find('.app-layout__panel--left').classes()).not.toContain('app-layout__panel--collapsed')
    })

    it('toggles right panel collapse state', async () => {
      wrapper = createWrapper()
      const rightButton = wrapper.find('.app-layout__panel--right .app-layout__collapse-btn')
      
      expect(wrapper.find('.app-layout__panel--right').classes()).not.toContain('app-layout__panel--collapsed')
      
      await rightButton.trigger('click')
      expect(wrapper.find('.app-layout__panel--right').classes()).toContain('app-layout__panel--collapsed')
      
      await rightButton.trigger('click')
      expect(wrapper.find('.app-layout__panel--right').classes()).not.toContain('app-layout__panel--collapsed')
    })

    it('emits panel-toggle event on collapse/expand', async () => {
      wrapper = createWrapper()
      const leftButton = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      
      await leftButton.trigger('click')
      expect(wrapper.emitted('panel-toggle')).toBeTruthy()
      expect(wrapper.emitted('panel-toggle')![0]).toEqual(['left', true])
      
      await leftButton.trigger('click')
      expect(wrapper.emitted('panel-toggle')![1]).toEqual(['left', false])
    })

    it('hides resize handle when panel is collapsed', async () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.app-layout__resize-handle--left').exists()).toBe(true)
      
      const leftButton = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      await leftButton.trigger('click')
      
      expect(wrapper.find('.app-layout__resize-handle--left').exists()).toBe(false)
    })
  })

  describe('Panel Resize', () => {
    it('starts resize on mousedown on resize handle', async () => {
      wrapper = createWrapper()
      const handle = wrapper.find('.app-layout__resize-handle--left')
      
      await handle.trigger('mousedown', { clientX: 300 })
      
      const vm = wrapper.vm as any
      expect(vm.isResizing).toBe('left')
      expect(vm.startX).toBe(300)
    })

    it('updates panel width during resize', async () => {
      wrapper = createWrapper()
      const handle = wrapper.find('.app-layout__resize-handle--left')
      const vm = wrapper.vm as any
      
      // Start resize
      await handle.trigger('mousedown', { clientX: 300 })
      
      // Simulate mouse move
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 350 })
      document.dispatchEvent(mouseMoveEvent)
      
      // Check width updated
      expect(vm.leftWidth).toBeGreaterThan(250) // Default is 250
    })

    it('respects minimum width constraint', async () => {
      wrapper = createWrapper({ minLeftWidth: 200 })
      const handle = wrapper.find('.app-layout__resize-handle--left')
      const vm = wrapper.vm as any
      
      vm.leftWidth = 250
      
      // Start resize
      await handle.trigger('mousedown', { clientX: 300 })
      
      // Try to resize below minimum
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 100 })
      document.dispatchEvent(mouseMoveEvent)
      
      expect(vm.leftWidth).toBe(200) // Should be clamped to minimum
    })

    it('respects maximum width constraint', async () => {
      wrapper = createWrapper({ maxLeftWidth: 600 })
      const handle = wrapper.find('.app-layout__resize-handle--left')
      const vm = wrapper.vm as any
      
      vm.leftWidth = 250
      
      // Start resize
      await handle.trigger('mousedown', { clientX: 300 })
      
      // Try to resize above maximum
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 700 })
      document.dispatchEvent(mouseMoveEvent)
      
      expect(vm.leftWidth).toBe(600) // Should be clamped to maximum
    })

    it('emits panel-resize event during resize', async () => {
      wrapper = createWrapper()
      const handle = wrapper.find('.app-layout__resize-handle--left')
      
      await handle.trigger('mousedown', { clientX: 300 })
      
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 350 })
      document.dispatchEvent(mouseMoveEvent)
      
      expect(wrapper.emitted('panel-resize')).toBeTruthy()
      expect(wrapper.emitted('panel-resize')![0][0]).toBe('left')
      expect(wrapper.emitted('panel-resize')![0][1]).toBeGreaterThan(250)
    })

    it('stops resize on mouseup', async () => {
      wrapper = createWrapper()
      const handle = wrapper.find('.app-layout__resize-handle--left')
      const vm = wrapper.vm as any
      
      await handle.trigger('mousedown', { clientX: 300 })
      expect(vm.isResizing).toBe('left')
      
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)
      
      expect(vm.isResizing).toBe(null)
    })
  })

  describe('Mobile Panel Switching', () => {
    beforeEach(() => {
      window.innerWidth = 500
    })

    it('shows mobile panel switcher', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      const switcher = wrapper.find('.app-layout__mobile-switcher')
      expect(switcher.exists()).toBe(true)
      
      const buttons = switcher.findAll('.mobile-switcher__btn')
      expect(buttons.length).toBe(3)
      expect(buttons[0].text()).toBe('Files')
      expect(buttons[1].text()).toBe('Editor')
      expect(buttons[2].text()).toBe('Results')
    })

    it('switches active panel on button click', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      const buttons = wrapper.findAll('.mobile-switcher__btn')
      
      // Initially center panel is active
      expect(buttons[1].classes()).toContain('active')
      
      // Click left panel button
      await buttons[0].trigger('click')
      expect(buttons[0].classes()).toContain('active')
      expect(buttons[1].classes()).not.toContain('active')
      
      // Click right panel button
      await buttons[2].trigger('click')
      expect(buttons[2].classes()).toContain('active')
      expect(buttons[0].classes()).not.toContain('active')
    })

    it('emits panel-focus event on mobile panel switch', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      const buttons = wrapper.findAll('.mobile-switcher__btn')
      
      await buttons[0].trigger('click')
      expect(wrapper.emitted('panel-focus')).toBeTruthy()
      expect(wrapper.emitted('panel-focus')![0]).toEqual(['left'])
      
      await buttons[2].trigger('click')
      expect(wrapper.emitted('panel-focus')![1]).toEqual(['right'])
    })

    it('applies correct mobile layout class based on active panel', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      const buttons = wrapper.findAll('.mobile-switcher__btn')
      
      expect(wrapper.find('.app-layout').classes()).toContain('app-layout--mobile-center')
      
      await buttons[0].trigger('click')
      expect(wrapper.find('.app-layout').classes()).toContain('app-layout--mobile-left')
      
      await buttons[2].trigger('click')
      expect(wrapper.find('.app-layout').classes()).toContain('app-layout--mobile-right')
    })
  })

  describe('Keyboard Navigation', () => {
    it('focuses left panel on Ctrl+1', async () => {
      wrapper = createWrapper()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true
      })
      
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('panel-focus')).toBeTruthy()
      expect(wrapper.emitted('panel-focus')![0]).toEqual(['left'])
    })

    it('focuses center panel on Ctrl+2', async () => {
      wrapper = createWrapper()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true
      })
      
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('panel-focus')).toBeTruthy()
      expect(wrapper.emitted('panel-focus')![0]).toEqual(['center'])
    })

    it('focuses right panel on Ctrl+3', async () => {
      wrapper = createWrapper()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: '3',
        ctrlKey: true
      })
      
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('panel-focus')).toBeTruthy()
      expect(wrapper.emitted('panel-focus')![0]).toEqual(['right'])
    })

    it('works with Cmd key on Mac', async () => {
      wrapper = createWrapper()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true
      })
      
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('panel-focus')).toBeTruthy()
      expect(wrapper.emitted('panel-focus')![0]).toEqual(['left'])
    })

    it('ignores shortcuts with additional modifiers', async () => {
      wrapper = createWrapper()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true,
        shiftKey: true
      })
      
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('panel-focus')).toBeFalsy()
    })

    it('applies focus indicator class', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.focusedPanel = 'left'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.app-layout').classes()).toContain('app-layout--focused-left')
      
      vm.focusedPanel = 'center'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.app-layout').classes()).toContain('app-layout--focused-center')
      
      vm.focusedPanel = 'right'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.app-layout').classes()).toContain('app-layout--focused-right')
    })
  })

  describe('Preference Persistence', () => {
    it('saves layout preferences on resize', async () => {
      const updateSpy = vi.spyOn(preferencesStore, 'updatePreference')
      wrapper = createWrapper()
      
      const handle = wrapper.find('.app-layout__resize-handle--left')
      await handle.trigger('mousedown', { clientX: 300 })
      
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 350 })
      document.dispatchEvent(mouseMoveEvent)
      
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(updateSpy).toHaveBeenCalledWith('layout', expect.objectContaining({
        leftWidth: expect.any(Number),
        rightWidth: expect.any(Number),
        isLeftCollapsed: false,
        isRightCollapsed: false
      }))
    })

    it('saves collapse state to preferences', async () => {
      const updateSpy = vi.spyOn(preferencesStore, 'updatePreference')
      wrapper = createWrapper()
      
      const leftButton = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      await leftButton.trigger('click')
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(updateSpy).toHaveBeenCalledWith('layout', expect.objectContaining({
        isLeftCollapsed: true
      }))
    })

    it('loads layout preferences on mount', async () => {
      preferencesStore.preferences.layout = {
        leftWidth: 300,
        rightWidth: 400,
        isLeftCollapsed: true,
        isRightCollapsed: false,
        activeMobilePanel: 'left',
        focusedPanel: 'right'
      }
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      const vm = wrapper.vm as any
      expect(vm.leftWidth).toBe(300)
      expect(vm.rightWidth).toBe(400)
      expect(vm.isLeftCollapsed).toBe(true)
      expect(vm.isRightCollapsed).toBe(false)
      expect(vm.activeMobilePanel).toBe('left')
      expect(vm.focusedPanel).toBe('right')
    })

    it('responds to preference changes from store', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      expect(vm.leftWidth).toBe(250) // Default
      
      preferencesStore.preferences.layout = {
        leftWidth: 350,
        rightWidth: 450,
        isLeftCollapsed: false,
        isRightCollapsed: true
      }
      
      await wrapper.vm.$nextTick()
      
      expect(vm.leftWidth).toBe(350)
      expect(vm.rightWidth).toBe(450)
      expect(vm.isRightCollapsed).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels on collapse buttons', () => {
      wrapper = createWrapper()
      
      const leftButton = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      const rightButton = wrapper.find('.app-layout__panel--right .app-layout__collapse-btn')
      
      expect(leftButton.attributes('aria-label')).toBe('Collapse left panel')
      expect(rightButton.attributes('aria-label')).toBe('Collapse right panel')
    })

    it('updates ARIA labels when panels are collapsed', async () => {
      wrapper = createWrapper()
      
      const leftButton = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      await leftButton.trigger('click')
      
      expect(leftButton.attributes('aria-label')).toBe('Expand left panel')
    })

    it('focuses first focusable element in panel on keyboard navigation', async () => {
      const focusSpy = vi.fn()
      
      // Create wrapper with focusable elements
      wrapper = createWrapper({}, {
        left: '<button id="left-btn">Left Button</button>',
        center: '<input id="center-input" />',
        right: '<a href="#" id="right-link">Right Link</a>'
      })
      
      // Mock querySelector and focus
      const leftPanel = wrapper.find('.app-layout__panel--left').element
      const mockButton = { focus: focusSpy }
      vi.spyOn(leftPanel, 'querySelector').mockReturnValue(mockButton as any)
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true
      })
      
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(focusSpy).toHaveBeenCalled()
    })
  })

  describe('Event Emissions', () => {
    it('emits all expected events with correct payloads', async () => {
      wrapper = createWrapper()
      
      // Test panel-resize
      const handle = wrapper.find('.app-layout__resize-handle--left')
      await handle.trigger('mousedown', { clientX: 300 })
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 350 })
      document.dispatchEvent(mouseMoveEvent)
      
      expect(wrapper.emitted('panel-resize')).toBeTruthy()
      expect(wrapper.emitted('panel-resize')![0]).toEqual(['left', expect.any(Number)])
      
      // Test panel-toggle
      const collapseBtn = wrapper.find('.app-layout__panel--left .app-layout__collapse-btn')
      await collapseBtn.trigger('click')
      
      expect(wrapper.emitted('panel-toggle')).toBeTruthy()
      expect(wrapper.emitted('panel-toggle')![0]).toEqual(['left', true])
      
      // Test panel-focus
      const keyEvent = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true
      })
      window.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('panel-focus')).toBeTruthy()
      expect(wrapper.emitted('panel-focus')![0]).toEqual(['center'])
    })
  })
})