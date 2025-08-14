import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UserMenu from '../UserMenu.vue'
import { usePreferenceStore } from '../../../stores/preferences'
import { useWebDAVStore } from '../../../stores/webdav'
import { storeBus } from '../../../stores/communication'

vi.mock('../../../stores/communication', () => ({
  storeBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

describe('UserMenu', () => {
  let preferenceStore: ReturnType<typeof usePreferenceStore>
  let webdavStore: ReturnType<typeof useWebDAVStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    preferenceStore = usePreferenceStore()
    webdavStore = useWebDAVStore()
    vi.clearAllMocks()
  })

  it('renders menu trigger button', () => {
    const wrapper = mount(UserMenu)
    
    const trigger = wrapper.find('.user-menu-trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.find('.user-icon').exists()).toBe(true)
    expect(trigger.find('.user-name').exists()).toBe(true)
    expect(trigger.find('.chevron-icon').exists()).toBe(true)
  })

  it('displays user name from WebDAV profile', async () => {
    webdavStore.activeProfile = {
      id: '1',
      name: 'My WebDAV Server',
      url: 'https://webdav.example.com',
      username: 'john@example.com',
      createdAt: new Date()
    }
    
    const wrapper = mount(UserMenu)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.user-name').text()).toBe('My WebDAV Server')
  })

  it('displays Guest User when no profile', () => {
    const wrapper = mount(UserMenu)
    
    expect(wrapper.find('.user-name').text()).toBe('Guest User')
  })

  it('toggles menu open/closed on trigger click', async () => {
    const wrapper = mount(UserMenu)
    
    // Initially closed
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(false)
    
    // Click to open
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(true)
    
    // Click to close
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(false)
  })

  it('rotates chevron icon when menu is open', async () => {
    const wrapper = mount(UserMenu)
    
    const chevron = wrapper.find('.chevron-icon')
    expect(chevron.classes()).not.toContain('rotate-180')
    
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(chevron.classes()).toContain('rotate-180')
  })

  it('displays user profile section with email', async () => {
    webdavStore.activeProfile = {
      id: '1',
      name: 'My Server',
      url: 'https://webdav.example.com',
      username: 'john@example.com',
      createdAt: new Date()
    }
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const profile = wrapper.find('.user-profile')
    expect(profile.find('.profile-name').text()).toBe('My Server')
    expect(profile.find('.profile-email').text()).toBe('john@example.com')
  })

  it('shows quick settings with correct states', async () => {
    preferenceStore.preferences.autoSave = true
    preferenceStore.preferences.vimMode = false
    preferenceStore.preferences.minimap = true
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const menuItems = wrapper.findAll('.menu-item')
    
    // Find auto-save item
    const autoSaveItem = menuItems.find(item => item.text().includes('Auto-Save'))
    expect(autoSaveItem?.find('.menu-item-status').text()).toBe('On')
    expect(autoSaveItem?.find('.menu-item-status').classes()).toContain('active')
    
    // Find vim mode item
    const vimItem = menuItems.find(item => item.text().includes('Vim Mode'))
    expect(vimItem?.find('.menu-item-status').text()).toBe('Off')
    expect(vimItem?.find('.menu-item-status').classes()).not.toContain('active')
    
    // Find minimap item
    const minimapItem = menuItems.find(item => item.text().includes('Minimap'))
    expect(minimapItem?.find('.menu-item-status').text()).toBe('On')
    expect(minimapItem?.find('.menu-item-status').classes()).toContain('active')
  })

  it('toggles auto-save preference', async () => {
    preferenceStore.preferences.autoSave = false
    preferenceStore.setPreference = vi.fn()
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const autoSaveItem = wrapper.findAll('.menu-item').find(item => item.text().includes('Auto-Save'))
    await autoSaveItem?.trigger('click')
    
    expect(preferenceStore.setPreference).toHaveBeenCalledWith('autoSave', true)
    expect(storeBus.emit).toHaveBeenCalledWith('preferences', 'settings-changed', { autoSave: true })
  })

  it('toggles vim mode preference', async () => {
    preferenceStore.preferences.vimMode = false
    preferenceStore.setPreference = vi.fn()
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const vimItem = wrapper.findAll('.menu-item').find(item => item.text().includes('Vim Mode'))
    await vimItem?.trigger('click')
    
    expect(preferenceStore.setPreference).toHaveBeenCalledWith('vimMode', true)
    expect(storeBus.emit).toHaveBeenCalledWith('preferences', 'settings-changed', { vimMode: true })
  })

  it('toggles minimap preference', async () => {
    preferenceStore.preferences.minimap = true
    preferenceStore.setPreference = vi.fn()
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const minimapItem = wrapper.findAll('.menu-item').find(item => item.text().includes('Minimap'))
    await minimapItem?.trigger('click')
    
    expect(preferenceStore.setPreference).toHaveBeenCalledWith('minimap', false)
    expect(storeBus.emit).toHaveBeenCalledWith('preferences', 'settings-changed', { minimap: false })
  })

  it('emits openSettings event when All Settings clicked', async () => {
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const settingsItem = wrapper.findAll('.menu-item').find(item => item.text().includes('All Settings'))
    await settingsItem?.trigger('click')
    
    expect(wrapper.emitted('openSettings')).toBeTruthy()
    expect(storeBus.emit).toHaveBeenCalledWith('ui', 'open-settings', {})
    
    // Menu should close
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(false)
  })

  it('emits openKeyboardShortcuts event when Keyboard Shortcuts clicked', async () => {
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const shortcutsItem = wrapper.findAll('.menu-item').find(item => item.text().includes('Keyboard Shortcuts'))
    await shortcutsItem?.trigger('click')
    
    expect(wrapper.emitted('openKeyboardShortcuts')).toBeTruthy()
    expect(storeBus.emit).toHaveBeenCalledWith('ui', 'open-keyboard-shortcuts', {})
  })

  it('shows keyboard shortcut hint for shortcuts menu', async () => {
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const shortcutsItem = wrapper.findAll('.menu-item').find(item => item.text().includes('Keyboard Shortcuts'))
    expect(shortcutsItem?.find('.menu-item-shortcut').text()).toBe('Ctrl+?')
  })

  it('emits showAbout event when About clicked', async () => {
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const aboutItem = wrapper.findAll('.menu-item').find(item => item.text().includes('About'))
    await aboutItem?.trigger('click')
    
    expect(wrapper.emitted('showAbout')).toBeTruthy()
    expect(storeBus.emit).toHaveBeenCalledWith('ui', 'show-about', {})
  })

  it('shows disconnect option when connected', async () => {
    webdavStore.connectionStatus = 'connected'
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const disconnectItem = wrapper.find('.menu-item--danger')
    expect(disconnectItem.exists()).toBe(true)
    expect(disconnectItem.text()).toContain('Disconnect WebDAV')
  })

  it('shows connect option when disconnected', async () => {
    webdavStore.connectionStatus = 'disconnected'
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const connectItem = wrapper.find('.menu-item--primary')
    expect(connectItem.exists()).toBe(true)
    expect(connectItem.text()).toContain('Connect WebDAV')
  })

  it('handles disconnect action', async () => {
    webdavStore.connectionStatus = 'connected'
    webdavStore.disconnect = vi.fn().mockResolvedValue(undefined)
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const disconnectItem = wrapper.find('.menu-item--danger')
    await disconnectItem.trigger('click')
    
    expect(webdavStore.disconnect).toHaveBeenCalled()
    expect(wrapper.emitted('disconnect')).toBeTruthy()
    expect(storeBus.emit).toHaveBeenCalledWith('webdav', 'disconnected', {})
  })

  it('handles connect action', async () => {
    webdavStore.connectionStatus = 'disconnected'
    
    const wrapper = mount(UserMenu)
    await wrapper.find('.user-menu-trigger').trigger('click')
    
    const connectItem = wrapper.find('.menu-item--primary')
    await connectItem.trigger('click')
    
    expect(wrapper.emitted('connect')).toBeTruthy()
    expect(storeBus.emit).toHaveBeenCalledWith('webdav', 'request-connect', {})
  })

  it('closes menu when clicking outside', async () => {
    const wrapper = mount(UserMenu, {
      attachTo: document.body
    })
    
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(true)
    
    // Click outside
    document.body.click()
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(false)
    
    wrapper.unmount()
  })

  it('closes menu on Escape key', async () => {
    const wrapper = mount(UserMenu)
    
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(true)
    
    // Press Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(false)
  })

  it('prevents menu from closing when clicking inside', async () => {
    const wrapper = mount(UserMenu)
    
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(true)
    
    // Click inside menu
    await wrapper.find('.menu-section').trigger('click')
    
    expect(wrapper.find('.user-menu-dropdown').exists()).toBe(true)
  })
})