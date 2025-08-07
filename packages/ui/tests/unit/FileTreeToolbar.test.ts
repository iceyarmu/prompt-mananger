import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FileTreeToolbar from '../../src/components/FileTreeToolbar.vue'
import { useWebDAVStore } from '../../src/composables/useWebDAVStore'
import { useFileTreeStore } from '../../src/composables/useFileTreeStore'
import { useToast } from '../../src/composables/useToast'

// Mock the composables
vi.mock('../../src/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn()
  }))
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('FileTreeToolbar', () => {
  let webdavStore: ReturnType<typeof useWebDAVStore>
  let fileTreeStore: ReturnType<typeof useFileTreeStore>
  
  beforeEach(() => {
    setActivePinia(createPinia())
    webdavStore = useWebDAVStore()
    fileTreeStore = useFileTreeStore()
    vi.clearAllMocks()
  })

  it('renders with connection status', () => {
    webdavStore.connectionStatus = 'connected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com',
      createdAt: new Date()
    }
    
    const wrapper = mount(FileTreeToolbar)
    
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('disables refresh button when not connected', () => {
    webdavStore.connectionStatus = 'disconnected'
    
    const wrapper = mount(FileTreeToolbar)
    const refreshButton = wrapper.find('[aria-label="fileTree.toolbar.refresh"]')
    
    expect(refreshButton.attributes('disabled')).toBeDefined()
  })

  it('enables refresh button when connected', () => {
    webdavStore.connectionStatus = 'connected'
    
    const wrapper = mount(FileTreeToolbar)
    const refreshButton = wrapper.find('[aria-label="fileTree.toolbar.refresh"]')
    
    expect(refreshButton.attributes('disabled')).toBeUndefined()
  })

  it('triggers refresh when refresh button is clicked', async () => {
    webdavStore.connectionStatus = 'connected'
    const loadTreeMock = vi.spyOn(fileTreeStore, 'loadTree').mockResolvedValue()
    const toastMock = useToast()
    
    const wrapper = mount(FileTreeToolbar)
    const refreshButton = wrapper.find('[aria-label="fileTree.toolbar.refresh"]')
    
    await refreshButton.trigger('click')
    await flushPromises()
    
    expect(loadTreeMock).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalledWith('fileTree.refresh.success', { duration: 2000 })
  })

  it('shows error message when refresh fails', async () => {
    webdavStore.connectionStatus = 'connected'
    const error = new Error('Network error')
    const loadTreeMock = vi.spyOn(fileTreeStore, 'loadTree').mockRejectedValue(error)
    const toastMock = useToast()
    
    const wrapper = mount(FileTreeToolbar)
    const refreshButton = wrapper.find('[aria-label="fileTree.toolbar.refresh"]')
    
    await refreshButton.trigger('click')
    await flushPromises()
    
    expect(loadTreeMock).toHaveBeenCalled()
    expect(toastMock.error).toHaveBeenCalledWith('webdav.errors.networkError')
  })

  it('shows spinning animation during refresh', async () => {
    webdavStore.connectionStatus = 'connected'
    const loadTreeMock = vi.spyOn(fileTreeStore, 'loadTree').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )
    
    const wrapper = mount(FileTreeToolbar)
    const refreshButton = wrapper.find('[aria-label="fileTree.toolbar.refresh"]')
    
    await refreshButton.trigger('click')
    
    // Check for spinning animation
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    
    await flushPromises()
    
    // Animation should be removed after completion
    expect(wrapper.find('.animate-spin').exists()).toBe(false)
  })

  it('emits open-config event when configure button is clicked', async () => {
    const wrapper = mount(FileTreeToolbar)
    const configButton = wrapper.find('[aria-label="fileTree.toolbar.configure"]')
    
    await configButton.trigger('click')
    
    expect(wrapper.emitted('open-config')).toBeTruthy()
  })

  it('handles refresh timeout correctly', async () => {
    webdavStore.connectionStatus = 'connected'
    const loadTreeMock = vi.spyOn(fileTreeStore, 'loadTree').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)) // Longer than 3s timeout
    )
    const toastMock = useToast()
    
    const wrapper = mount(FileTreeToolbar)
    const refreshButton = wrapper.find('[aria-label="fileTree.toolbar.refresh"]')
    
    await refreshButton.trigger('click')
    
    // Fast-forward time to trigger timeout
    vi.advanceTimersByTime(3100)
    await flushPromises()
    
    expect(toastMock.error).toHaveBeenCalledWith('webdav.errors.connectionTimeout')
  })

  it('has proper ARIA attributes for accessibility', () => {
    const wrapper = mount(FileTreeToolbar)
    
    // Check toolbar ARIA attributes
    const toolbar = wrapper.find('[role="toolbar"]')
    expect(toolbar.attributes('aria-label')).toBe('fileTree.toolbar.ariaLabel')
    
    // Check status region
    const status = wrapper.find('[role="status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    
    // Check button group
    const buttonGroup = wrapper.find('[role="group"]')
    expect(buttonGroup.attributes('aria-label')).toBe('fileTree.toolbar.actions')
    
    // Check screen reader only status
    const srStatus = wrapper.find('#refresh-status')
    expect(srStatus.classes()).toContain('sr-only')
    expect(srStatus.attributes('aria-live')).toBe('polite')
  })

  it('updates connection status indicator based on store state', async () => {
    const wrapper = mount(FileTreeToolbar)
    
    // Initially disconnected
    webdavStore.connectionStatus = 'disconnected'
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toContain('disconnected')
    
    // Change to connecting
    webdavStore.connectionStatus = 'connecting'
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toContain('connecting')
    
    // Change to connected
    webdavStore.connectionStatus = 'connected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com',
      createdAt: new Date()
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toContain('Test Server')
  })
})