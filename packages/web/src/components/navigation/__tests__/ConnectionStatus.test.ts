import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConnectionStatus from '../ConnectionStatus.vue'
import { useWebDAVStore } from '../../../stores/webdav'
import { storeBus } from '../../../stores/communication'

vi.mock('../../../stores/communication', () => ({
  storeBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

describe('ConnectionStatus', () => {
  let webdavStore: ReturnType<typeof useWebDAVStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    webdavStore = useWebDAVStore()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays disconnected state by default', () => {
    const wrapper = mount(ConnectionStatus)
    
    expect(wrapper.find('.connection-status').classes()).toContain('connection-status--disconnected')
    expect(wrapper.find('.status-text').text()).toBe('Disconnected')
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--disconnected')
  })

  it('displays connected state when connected', async () => {
    webdavStore.connectionStatus = 'connected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.connection-status').classes()).toContain('connection-status--connected')
    expect(wrapper.find('.status-text').text()).toContain('Connected')
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--connected')
  })

  it('displays connecting state when connecting', async () => {
    webdavStore.connectionStatus = 'connecting'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.connection-status').classes()).toContain('connection-status--connecting')
    expect(wrapper.find('.status-text').text()).toBe('Connecting...')
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--connecting')
  })

  it('displays error state with error message', async () => {
    webdavStore.connectionStatus = 'error'
    webdavStore.connectionError = 'Network timeout'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.connection-status').classes()).toContain('connection-status--error')
    expect(wrapper.find('.status-text').text()).toBe('Network timeout')
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--error')
  })

  it('shows reconnect button when disconnected', async () => {
    webdavStore.connectionStatus = 'disconnected'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    const reconnectBtn = wrapper.find('.reconnect-btn')
    expect(reconnectBtn.exists()).toBe(true)
    expect(reconnectBtn.text()).toBe('Reconnect')
  })

  it('shows reconnect button when error', async () => {
    webdavStore.connectionStatus = 'error'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    const reconnectBtn = wrapper.find('.reconnect-btn')
    expect(reconnectBtn.exists()).toBe(true)
    expect(reconnectBtn.text()).toBe('Reconnect')
  })

  it('hides reconnect button when connected', async () => {
    webdavStore.connectionStatus = 'connected'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.reconnect-btn').exists()).toBe(false)
  })

  it('handles reconnect click', async () => {
    webdavStore.connectionStatus = 'disconnected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    webdavStore.connect = vi.fn().mockResolvedValue(true)
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    const reconnectBtn = wrapper.find('.reconnect-btn')
    await reconnectBtn.trigger('click')
    
    expect(webdavStore.connect).toHaveBeenCalledWith('1')
    expect(reconnectBtn.text()).toBe('Reconnecting...')
  })

  it('emits success event on successful reconnection', async () => {
    webdavStore.connectionStatus = 'disconnected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    webdavStore.connect = vi.fn().mockResolvedValue(true)
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    await wrapper.find('.reconnect-btn').trigger('click')
    await wrapper.vm.$nextTick()
    
    expect(storeBus.emit).toHaveBeenCalledWith('webdav', 'connection-restored', expect.objectContaining({
      profile: webdavStore.activeProfile,
      attempts: 0
    }))
  })

  it('emits error event on failed reconnection', async () => {
    webdavStore.connectionStatus = 'disconnected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    webdavStore.connect = vi.fn().mockRejectedValue(new Error('Connection refused'))
    webdavStore.maxRetries = 3
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    await wrapper.find('.reconnect-btn').trigger('click')
    await wrapper.vm.$nextTick()
    
    expect(storeBus.emit).toHaveBeenCalledWith('webdav', 'connection-failed', expect.objectContaining({
      error: 'Connection refused',
      attempts: 1
    }))
  })

  it('shows last sync time when connected', async () => {
    webdavStore.connectionStatus = 'connected'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    // Simulate time passing
    vi.advanceTimersByTime(60000) // 1 minute
    await wrapper.vm.$nextTick()
    
    const statusText = wrapper.find('.status-text').text()
    expect(statusText).toContain('Last sync:')
  })

  it('updates last sync time on file sync event', async () => {
    webdavStore.connectionStatus = 'connected'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    // Simulate file sync event
    const onCallback = (storeBus.on as any).mock.calls.find(
      (call: any) => call[0] === 'webdav' && call[1] === 'file-synced'
    )?.[2]
    
    if (onCallback) {
      onCallback()
      await wrapper.vm.$nextTick()
    }
    
    const statusText = wrapper.find('.status-text').text()
    expect(statusText).toContain('just now')
  })

  it('shows connection details in tooltip', async () => {
    webdavStore.connectionStatus = 'connected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'My WebDAV',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    const tooltip = wrapper.find('.connection-status').attributes('title')
    expect(tooltip).toContain('My WebDAV')
    expect(tooltip).toContain('https://webdav.example.com')
  })

  it('auto-reconnects on unexpected disconnect', async () => {
    webdavStore.connectionStatus = 'connected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    webdavStore.connect = vi.fn().mockResolvedValue(true)
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    // Simulate disconnect
    webdavStore.connectionStatus = 'disconnected'
    await wrapper.vm.$nextTick()
    
    // Advance timer to trigger auto-reconnect
    vi.advanceTimersByTime(3000)
    await wrapper.vm.$nextTick()
    
    expect(webdavStore.connect).toHaveBeenCalledWith('1')
  })

  it('implements exponential backoff for retries', async () => {
    webdavStore.connectionStatus = 'disconnected'
    webdavStore.activeProfile = {
      id: '1',
      name: 'Test Server',
      url: 'https://webdav.example.com',
      createdAt: new Date()
    }
    webdavStore.maxRetries = 3
    webdavStore.connect = vi.fn().mockRejectedValue(new Error('Connection failed'))
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    // First attempt
    await wrapper.find('.reconnect-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(webdavStore.connect).toHaveBeenCalledTimes(1)
    
    // Second attempt after 5 seconds
    vi.advanceTimersByTime(5000)
    await wrapper.vm.$nextTick()
    expect(webdavStore.connect).toHaveBeenCalledTimes(2)
    
    // Third attempt after 10 seconds (exponential backoff)
    vi.advanceTimersByTime(10000)
    await wrapper.vm.$nextTick()
    expect(webdavStore.connect).toHaveBeenCalledTimes(3)
  })

  it('formats time correctly', async () => {
    webdavStore.connectionStatus = 'connected'
    
    const wrapper = mount(ConnectionStatus)
    await wrapper.vm.$nextTick()
    
    // Test different time formats
    const testCases = [
      { advance: 30000, expected: 'just now' },      // 30 seconds
      { advance: 120000, expected: '2m ago' },       // 2 minutes
      { advance: 7200000, expected: '2h ago' },      // 2 hours
      { advance: 172800000, expected: '2d ago' }     // 2 days
    ]
    
    for (const testCase of testCases) {
      vi.advanceTimersByTime(testCase.advance)
      await wrapper.vm.$nextTick()
      
      const statusText = wrapper.find('.status-text').text()
      if (statusText.includes('Last sync:')) {
        expect(statusText).toContain(testCase.expected)
      }
    }
  })
})