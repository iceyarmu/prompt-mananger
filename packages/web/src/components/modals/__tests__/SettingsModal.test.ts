import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SettingsModal from '../SettingsModal.vue'
import { usePreferenceStore } from '../../../stores/preferences'
import { storeBus } from '../../../stores/communication'

vi.mock('../../../stores/communication', () => ({
  storeBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

describe('SettingsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders when isOpen is true', () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    expect(wrapper.find('.settings-modal').exists()).toBe(true)
    expect(wrapper.find('.modal-title').text()).toBe('Settings')
  })

  it('does not render when isOpen is false', () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: false
      }
    })
    
    expect(wrapper.find('.settings-modal').exists()).toBe(false)
  })

  it('displays all three tabs', () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    const tabs = wrapper.findAll('.tab-button')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].text()).toBe('Editor')
    expect(tabs[1].text()).toBe('UI')
    expect(tabs[2].text()).toBe('System')
  })

  it('switches between tabs when clicked', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    const tabs = wrapper.findAll('.tab-button')
    const panels = wrapper.findAll('.tab-panel')
    
    // Initially editor tab is active
    expect(tabs[0].classes()).toContain('active')
    
    // Click UI tab
    await tabs[1].trigger('click')
    expect(tabs[1].classes()).toContain('active')
    expect(tabs[0].classes()).not.toContain('active')
    
    // Click System tab
    await tabs[2].trigger('click')
    expect(tabs[2].classes()).toContain('active')
    expect(tabs[1].classes()).not.toContain('active')
  })

  it('loads preferences from store when opened', async () => {
    const store = usePreferenceStore()
    store.preferences.fontSize = 16
    store.preferences.theme = 'dark'
    store.preferences.autoSave = true
    
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: false
      }
    })
    
    // Open modal
    await wrapper.setProps({ isOpen: true })
    await wrapper.vm.$nextTick()
    
    // Check that values are loaded
    const fontSizeInput = wrapper.find('#fontSize') as any
    expect(fontSizeInput.element.value).toBe('16')
    
    const themeSelect = wrapper.find('#theme') as any
    expect(themeSelect.element.value).toBe('dark')
  })

  it('enables save button when changes are made', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    const saveButton = wrapper.find('.btn-primary')
    
    // Initially disabled (no changes)
    expect(saveButton.attributes('disabled')).toBeDefined()
    
    // Make a change
    const fontSizeInput = wrapper.find('#fontSize')
    await fontSizeInput.setValue('16')
    
    // Save button should be enabled
    expect(saveButton.attributes('disabled')).toBeUndefined()
  })

  it('saves preferences when save button clicked', async () => {
    const store = usePreferenceStore()
    store.setPreference = vi.fn()
    
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    // Make changes
    const fontSizeInput = wrapper.find('#fontSize')
    await fontSizeInput.setValue('16')
    
    const saveButton = wrapper.find('.btn-primary')
    await saveButton.trigger('click')
    
    // Check that preferences were saved
    expect(store.setPreference).toHaveBeenCalledWith('fontSize', 16)
    expect(storeBus.emit).toHaveBeenCalledWith('preferences', 'settings-changed', expect.any(Object))
  })

  it('resets changes when cancel clicked', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    // Make a change
    const fontSizeInput = wrapper.find('#fontSize')
    const originalValue = fontSizeInput.element.value
    await fontSizeInput.setValue('20')
    
    // Click cancel
    const cancelButton = wrapper.findAll('.btn-secondary')[1] // Second secondary button is cancel
    await cancelButton.trigger('click')
    
    // Reopen modal
    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    
    // Value should be reset
    expect(wrapper.find('#fontSize').element.value).toBe(originalValue)
  })

  it('resets to defaults when reset button clicked', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    // Change some values
    await wrapper.find('#fontSize').setValue('20')
    await wrapper.find('#tabSize').setValue('8')
    
    // Click reset
    const resetButton = wrapper.findAll('.btn-secondary')[0] // First secondary button is reset
    await resetButton.trigger('click')
    
    // Values should be reset to defaults
    expect(wrapper.find('#fontSize').element.value).toBe('14')
    expect(wrapper.find('#tabSize').element.value).toBe('2')
  })

  it('closes modal when X button clicked', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    const closeButton = wrapper.find('.close-button')
    await closeButton.trigger('click')
    
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('closes modal when overlay clicked', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    const overlay = wrapper.find('.settings-modal-overlay')
    await overlay.trigger('click')
    
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not close when modal content clicked', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    const modal = wrapper.find('.settings-modal')
    await modal.trigger('click')
    
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('validates font size input', async () => {
    const store = usePreferenceStore()
    store.setPreference = vi.fn()
    
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    // Set invalid font size
    await wrapper.find('#fontSize').setValue('50')
    
    // Save
    await wrapper.find('.btn-primary').trigger('click')
    
    // Should be clamped to valid range
    expect(store.setPreference).toHaveBeenCalledWith('fontSize', 14)
  })

  it('shows/hides auto-save interval when auto-save toggled', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    // Switch to system tab
    await wrapper.findAll('.tab-button')[2].trigger('click')
    
    // Initially auto-save is off, interval should be hidden
    expect(wrapper.find('#autoSaveInterval').exists()).toBe(false)
    
    // Enable auto-save
    const autoSaveCheckbox = wrapper.findAll('.setting-checkbox').find(
      el => el.element.parentElement?.textContent?.includes('Enable Auto-Save')
    )
    await autoSaveCheckbox?.setValue(true)
    
    // Interval should now be visible
    expect(wrapper.find('#autoSaveInterval').exists()).toBe(true)
  })

  it('handles theme changes correctly', async () => {
    const store = usePreferenceStore()
    store.setPreference = vi.fn()
    
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true
      }
    })
    
    // Switch to UI tab
    await wrapper.findAll('.tab-button')[1].trigger('click')
    
    // Change theme
    const themeSelect = wrapper.find('#theme')
    await themeSelect.setValue('dark')
    
    // Save
    await wrapper.find('.btn-primary').trigger('click')
    
    expect(store.setPreference).toHaveBeenCalledWith('theme', 'dark')
  })
})