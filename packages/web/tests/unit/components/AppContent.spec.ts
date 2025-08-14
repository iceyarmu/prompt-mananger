import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppContent from '@/AppContent.vue'
import AppLayout from '@/components/AppLayout.vue'
import { usePreferencesStore } from '@/stores/preferences'

// Mock UI components
vi.mock('@prompt-optimizer/ui', () => ({
  FileTree: {
    name: 'FileTree',
    props: ['data'],
    template: '<div class="file-tree-mock">FileTree</div>'
  },
  MarkdownEditor: {
    name: 'MarkdownEditor',
    props: ['modelValue', 'placeholder'],
    template: '<div class="markdown-editor-mock">MarkdownEditor</div>'
  },
  ThemeToggleUI: {
    name: 'ThemeToggleUI',
    template: '<div class="theme-toggle-mock">ThemeToggle</div>'
  }
}))

describe('AppContent.vue', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const createWrapper = () => {
    return mount(AppContent, {
      global: {
        components: {
          AppLayout
        }
      }
    })
  }

  describe('Component Structure', () => {
    it('renders AppLayout component', () => {
      wrapper = createWrapper()
      expect(wrapper.findComponent(AppLayout).exists()).toBe(true)
    })

    it('renders navigation header with breadcrumb and actions', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.app-header').exists()).toBe(true)
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(true)
      expect(wrapper.find('.header-actions').exists()).toBe(true)
    })

    it('renders connection status in header', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.connection-status').exists()).toBe(true)
    })

    it('renders settings button in header', () => {
      wrapper = createWrapper()
      const settingsBtn = wrapper.find('.settings-btn')
      
      expect(settingsBtn.exists()).toBe(true)
      expect(settingsBtn.attributes('aria-label')).toBe('Settings')
    })

    it('renders theme toggle in header', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.theme-toggle-mock').exists()).toBe(true)
    })
  })

  describe('Panel Content', () => {
    it('renders file tree placeholder when no data', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.panel-placeholder').text()).toContain('No files available')
    })

    it('renders markdown editor in center panel', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.markdown-editor-mock').exists()).toBe(true)
    })

    it('renders results placeholder when no results', () => {
      wrapper = createWrapper()
      const placeholders = wrapper.findAll('.panel-placeholder')
      const resultsPlaceholder = placeholders.find(p => p.text().includes('Results will appear here'))
      expect(resultsPlaceholder?.exists()).toBe(true)
    })

    it('displays panel titles correctly', () => {
      wrapper = createWrapper()
      const titles = wrapper.findAll('.panel-title')
      
      expect(titles[0].text()).toBe('Files')
      expect(titles[1].text()).toBe('Editor')
      expect(titles[2].text()).toBe('Results')
    })
  })

  describe('Data Binding', () => {
    it('updates current path in breadcrumb', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.currentPath = '/test/path'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.breadcrumb-item').text()).toBe('/test/path')
    })

    it('updates editor panel title when file is selected', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.currentFileName = 'test.md'
      await wrapper.vm.$nextTick()
      
      const titles = wrapper.findAll('.panel-title')
      expect(titles[1].text()).toBe('test.md')
    })

    it('shows optimization results when available', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.optimizationResults = 'Test optimization results'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.results-content').exists()).toBe(true)
      expect(wrapper.find('.results-content h3').text()).toBe('Optimization Results')
      expect(wrapper.find('.results-content pre').text()).toBe('Test optimization results')
    })

    it('shows execution results when available', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.executionResults = 'Test execution results'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.results-content').exists()).toBe(true)
      expect(wrapper.find('.results-content h3').text()).toBe('Execution Results')
      expect(wrapper.find('.results-content pre').text()).toBe('Test execution results')
    })

    it('prioritizes optimization results over execution results', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.optimizationResults = 'Optimization'
      vm.executionResults = 'Execution'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.results-content h3').text()).toBe('Optimization Results')
    })
  })

  describe('Connection Status', () => {
    it('shows connected status by default', () => {
      wrapper = createWrapper()
      const status = wrapper.find('.connection-status')
      
      expect(status.classes()).toContain('connected')
      expect(status.classes()).not.toContain('disconnected')
      expect(status.text()).toContain('Connected')
    })

    it('updates connection status when disconnected', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.isConnected = false
      await wrapper.vm.$nextTick()
      
      const status = wrapper.find('.connection-status')
      expect(status.classes()).not.toContain('connected')
      expect(status.classes()).toContain('disconnected')
      expect(status.text()).toContain('Disconnected')
    })
  })

  describe('Event Handlers', () => {
    it('handles settings button click', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      wrapper = createWrapper()
      
      const settingsBtn = wrapper.find('.settings-btn')
      await settingsBtn.trigger('click')
      
      expect(consoleSpy).toHaveBeenCalledWith('Settings clicked')
    })

    it('handles file selection', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      const testFile = { name: 'test.md', path: '/files/test.md' }
      vm.handleFileSelect(testFile)
      
      expect(vm.currentFileName).toBe('test.md')
      expect(vm.currentPath).toBe('/files/test.md')
      expect(consoleSpy).toHaveBeenCalledWith('File selected:', testFile)
    })

    it('handles editor content change', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.handleEditorChange('New content')
      
      expect(consoleSpy).toHaveBeenCalledWith('Editor content changed')
    })
  })

  describe('Styling', () => {
    it('applies correct classes to header elements', () => {
      wrapper = createWrapper()
      
      const header = wrapper.find('.app-header')
      expect(header.attributes('style')).toContain('height: 48px')
    })

    it('applies connected status dot color', () => {
      wrapper = createWrapper()
      const statusDot = wrapper.find('.connected .status-dot')
      expect(statusDot.exists()).toBe(true)
    })

    it('applies disconnected status dot color', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.isConnected = false
      await wrapper.vm.$nextTick()
      
      const statusDot = wrapper.find('.disconnected .status-dot')
      expect(statusDot.exists()).toBe(true)
    })
  })

  describe('Integration with AppLayout', () => {
    it('passes correct slot content to AppLayout', () => {
      wrapper = createWrapper()
      const appLayout = wrapper.findComponent(AppLayout)
      
      // Check that slots are being passed
      expect(appLayout.vm.$slots.header).toBeDefined()
      expect(appLayout.vm.$slots.left).toBeDefined()
      expect(appLayout.vm.$slots.center).toBeDefined()
      expect(appLayout.vm.$slots.right).toBeDefined()
    })

    it('renders panel headers through AppLayout slots', () => {
      wrapper = createWrapper()
      const appLayout = wrapper.findComponent(AppLayout)
      
      expect(appLayout.vm.$slots['left-header']).toBeDefined()
      expect(appLayout.vm.$slots['center-header']).toBeDefined()
      expect(appLayout.vm.$slots['right-header']).toBeDefined()
    })
  })
})