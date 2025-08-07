import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FileTreeConnectionStatus from '../../src/components/FileTreeConnectionStatus.vue'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`
      }
      return key
    }
  })
}))

describe('FileTreeConnectionStatus', () => {
  it('renders disconnected state correctly', () => {
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'disconnected',
        profile: null,
        lastSync: null
      }
    })
    
    expect(wrapper.find('.status-dot').classes()).toContain('bg-gray-400')
    expect(wrapper.text()).toContain('webdav.status.disconnected')
  })

  it('renders connecting state with pulsing animation', () => {
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connecting',
        profile: null,
        lastSync: null
      }
    })
    
    expect(wrapper.find('.status-dot').classes()).toContain('bg-yellow-500')
    expect(wrapper.find('.animate-ping').exists()).toBe(true)
    expect(wrapper.text()).toContain('webdav.status.connecting')
  })

  it('renders connected state with profile name', () => {
    const profile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com/webdav',
      createdAt: new Date()
    }
    
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: new Date()
      }
    })
    
    expect(wrapper.find('.status-dot').classes()).toContain('bg-green-500')
    expect(wrapper.text()).toContain('Test Server')
    expect(wrapper.find('.animate-ping').exists()).toBe(false)
  })

  it('renders error state correctly', () => {
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'error',
        profile: null,
        lastSync: null
      }
    })
    
    expect(wrapper.find('.status-dot').classes()).toContain('bg-red-500')
    expect(wrapper.text()).toContain('webdav.status.error')
  })

  it('shows connection quality indicator when connected', () => {
    const profile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com/webdav',
      createdAt: new Date()
    }
    
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: new Date()
      }
    })
    
    // Should show 3 quality bars
    const qualityBars = wrapper.findAll('.w-1.h-2')
    expect(qualityBars.length).toBe(3)
    
    // All bars should be green for recent sync
    expect(qualityBars[0].classes()).toContain('bg-green-400')
    expect(qualityBars[1].classes()).toContain('bg-green-400')
    expect(qualityBars[2].classes()).toContain('bg-green-400')
  })

  it('adjusts connection quality based on last sync time', () => {
    const profile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com/webdav',
      createdAt: new Date()
    }
    
    // Last sync was 6 minutes ago (poor quality)
    const oldSync = new Date(Date.now() - 6 * 60 * 1000)
    
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: oldSync
      }
    })
    
    const qualityBars = wrapper.findAll('.w-1.h-2')
    
    // Only first bar should be green for poor quality
    expect(qualityBars[0].classes()).toContain('bg-green-400')
    expect(qualityBars[1].classes()).toContain('bg-gray-300')
    expect(qualityBars[2].classes()).toContain('bg-gray-300')
  })

  it('displays tooltip text with connection details', () => {
    const profile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com/webdav',
      createdAt: new Date()
    }
    
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: new Date()
      }
    })
    
    const statusText = wrapper.find('.truncate')
    const tooltipText = statusText.attributes('title')
    
    expect(tooltipText).toContain('Test Server')
    expect(tooltipText).toContain('https://test.com/webdav')
    expect(tooltipText).toContain('webdav.status.lastSync')
  })

  it('truncates long profile names', () => {
    const profile = {
      id: '1',
      name: 'Very Long Server Name That Should Be Truncated In The Display',
      url: 'https://test.com/webdav',
      createdAt: new Date()
    }
    
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: new Date()
      }
    })
    
    const statusText = wrapper.find('.truncate')
    expect(statusText.classes()).toContain('truncate')
    expect(statusText.text()).toContain(profile.name)
  })

  it('does not show quality indicator when disconnected', () => {
    const wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'disconnected',
        profile: null,
        lastSync: null
      }
    })
    
    const qualityBars = wrapper.findAll('.w-1.h-2')
    expect(qualityBars.length).toBe(0)
  })

  it('formats relative time correctly', () => {
    const profile = {
      id: '1',
      name: 'Test Server',
      url: 'https://test.com/webdav',
      createdAt: new Date()
    }
    
    // Test just now (< 1 minute)
    const justNow = new Date()
    let wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: justNow
      }
    })
    
    expect(wrapper.find('.truncate').attributes('title')).toContain('time.justNow')
    
    // Test minutes ago
    const minutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: minutesAgo
      }
    })
    
    expect(wrapper.find('.truncate').attributes('title')).toContain('time.minutesAgo')
    
    // Test hours ago
    const hoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    wrapper = mount(FileTreeConnectionStatus, {
      props: {
        status: 'connected',
        profile,
        lastSync: hoursAgo
      }
    })
    
    expect(wrapper.find('.truncate').attributes('title')).toContain('time.hoursAgo')
  })
})