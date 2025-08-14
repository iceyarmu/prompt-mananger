import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ThemeToggle from '../ThemeToggle.vue'
import { usePreferenceStore } from '../../../stores/preferences'
import { storeBus } from '../../../stores/communication'

vi.mock('../../../stores/communication', () => ({
  storeBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock as any

// Mock matchMedia
const matchMediaMock = vi.fn((query) => ({
  matches: query === '(prefers-color-scheme: dark)' ? false : false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))
global.matchMedia = matchMediaMock as any

describe('ThemeToggle', () => {
  let preferenceStore: ReturnType<typeof usePreferenceStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    preferenceStore = usePreferenceStore()
    vi.clearAllMocks()
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders theme toggle button', () => {
    const wrapper = mount(ThemeToggle)
    
    const button = wrapper.find('.theme-toggle-button')
    expect(button.exists()).toBe(true)
    expect(button.find('.theme-icon').exists()).toBe(true)
    expect(button.find('.theme-label').exists()).toBe(true)
  })

  it('displays light theme icon when theme is light', async () => {
    preferenceStore.preferences.theme = 'light'
    
    const wrapper = mount(ThemeToggle)
    await wrapper.vm.$nextTick()
    
    const icon = wrapper.find('.theme-icon')
    // Check for sun icon path element
    expect(icon.html()).toContain('M12 3v1m0 16v1')
    expect(wrapper.find('.theme-label').text()).toBe('Light')
  })

  it('displays dark theme icon when theme is dark', async () => {
    preferenceStore.preferences.theme = 'dark'
    
    const wrapper = mount(ThemeToggle)
    await wrapper.vm.$nextTick()
    
    const icon = wrapper.find('.theme-icon')
    // Check for moon icon path element
    expect(icon.html()).toContain('M20.354 15.354A9')
    expect(wrapper.find('.theme-label').text()).toBe('Dark')
  })

  it('displays auto theme icon when theme is auto', async () => {
    preferenceStore.preferences.theme = 'auto'
    
    const wrapper = mount(ThemeToggle)
    await wrapper.vm.$nextTick()
    
    const icon = wrapper.find('.theme-icon')
    // Check for desktop/monitor icon path element
    expect(icon.html()).toContain('M9.75 17L9 20')
    expect(wrapper.find('.theme-label').text()).toBe('Auto')
  })

  it('toggles theme in correct order: light -> dark -> auto -> light', async () => {
    preferenceStore.preferences.theme = 'light'
    preferenceStore.setTheme = vi.fn()
    
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('.theme-toggle-button')
    
    // Light -> Dark
    await button.trigger('click')
    expect(preferenceStore.setTheme).toHaveBeenCalledWith('dark')
    
    // Dark -> Auto
    preferenceStore.preferences.theme = 'dark'
    await wrapper.vm.$nextTick()
    await button.trigger('click')
    expect(preferenceStore.setTheme).toHaveBeenCalledWith('auto')
    
    // Auto -> Light
    preferenceStore.preferences.theme = 'auto'
    await wrapper.vm.$nextTick()
    await button.trigger('click')
    expect(preferenceStore.setTheme).toHaveBeenCalledWith('light')
  })

  it('applies dark class to document root when theme is dark', async () => {
    preferenceStore.preferences.theme = 'dark'
    
    mount(ThemeToggle)
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('removes dark class from document root when theme is light', async () => {
    document.documentElement.classList.add('dark')
    preferenceStore.preferences.theme = 'light'
    
    mount(ThemeToggle)
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('applies system preference when theme is auto', async () => {
    // Mock system prefers dark
    matchMediaMock.mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
    
    preferenceStore.preferences.theme = 'auto'
    
    mount(ThemeToggle)
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('stores theme preference in localStorage', async () => {
    preferenceStore.preferences.theme = 'light'
    preferenceStore.setTheme = vi.fn()
    
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('.theme-toggle-button')
    
    await button.trigger('click')
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark')
  })

  it('loads theme preference from localStorage on mount', async () => {
    localStorageMock.getItem.mockReturnValue('dark')
    preferenceStore.preferences.theme = 'light'
    preferenceStore.setTheme = vi.fn()
    
    mount(ThemeToggle)
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(preferenceStore.setTheme).toHaveBeenCalledWith('dark')
  })

  it('emits themeChanged event when theme changes', async () => {
    preferenceStore.preferences.theme = 'light'
    preferenceStore.setTheme = vi.fn()
    
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('.theme-toggle-button')
    
    await button.trigger('click')
    
    expect(wrapper.emitted('themeChanged')).toBeTruthy()
    expect(wrapper.emitted('themeChanged')?.[0]).toEqual(['dark'])
  })

  it('emits theme-changed event through storeBus', async () => {
    preferenceStore.preferences.theme = 'light'
    preferenceStore.setTheme = vi.fn()
    
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('.theme-toggle-button')
    
    await button.trigger('click')
    
    expect(storeBus.emit).toHaveBeenCalledWith('preferences', 'theme-changed', 'dark')
  })

  it('shows correct aria-label for accessibility', async () => {
    preferenceStore.preferences.theme = 'light'
    
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('.theme-toggle-button')
    
    expect(button.attributes('aria-label')).toBe('Switch to dark theme')
    
    preferenceStore.preferences.theme = 'dark'
    await wrapper.vm.$nextTick()
    expect(button.attributes('aria-label')).toBe('Switch to auto theme')
    
    preferenceStore.preferences.theme = 'auto'
    await wrapper.vm.$nextTick()
    expect(button.attributes('aria-label')).toBe('Switch to light theme')
  })

  it('shows correct title tooltip', async () => {
    preferenceStore.preferences.theme = 'light'
    
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('.theme-toggle-button')
    
    expect(button.attributes('title')).toContain('Current theme: Light')
    expect(button.attributes('title')).toContain('Click to switch to dark')
  })

  it('listens for system theme changes when in auto mode', async () => {
    const addEventListenerSpy = vi.fn()
    matchMediaMock.mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
    
    preferenceStore.preferences.theme = 'auto'
    
    mount(ThemeToggle)
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('removes event listener on unmount', async () => {
    const removeEventListenerSpy = vi.fn()
    matchMediaMock.mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn()
    })
    
    const wrapper = mount(ThemeToggle)
    await new Promise(resolve => setTimeout(resolve, 0))
    
    wrapper.unmount()
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('updates theme when store theme changes', async () => {
    preferenceStore.preferences.theme = 'light'
    
    const wrapper = mount(ThemeToggle)
    await wrapper.vm.$nextTick()
    
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    
    // Change theme in store
    preferenceStore.preferences.theme = 'dark'
    await wrapper.vm.$nextTick()
    
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})