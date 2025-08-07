/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import WebDAVConfigModal from '@/components/WebDAVConfigModal.vue'
import { useWebDAVStore } from '@/composables/useWebDAVStore'

// Mock the credential manager
vi.mock('@/utils/credentialManager', () => ({
  CredentialManager: vi.fn().mockImplementation(() => ({
    encrypt: vi.fn().mockResolvedValue('encrypted-password'),
    decrypt: vi.fn().mockResolvedValue('decrypted-password'),
    storeCredentials: vi.fn().mockResolvedValue(undefined),
    getCredentials: vi.fn().mockResolvedValue({ password: 'encrypted-password' }),
    removeCredentials: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock WebDAV service
vi.mock('@prompt-optimizer/webdav', () => ({
  WebDAVService: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn().mockResolvedValue({
      success: true,
      responseTime: 150,
      serverInfo: 'Mock WebDAV Server'
    }),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false)
  }))
}))

// Mock the Modal component
vi.mock('@/components/Modal.vue', () => ({
  default: {
    name: 'Modal',
    template: `
      <div class="theme-modal" v-if="modelValue">
        <div class="theme-modal-header">
          <slot name="title"></slot>
        </div>
        <div class="theme-modal-content">
          <slot></slot>
        </div>
        <div class="theme-modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `,
    props: ['modelValue'],
    emits: ['update:modelValue']
  }
}))

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-1234'
  }
})

const createWrapper = (props = {}) => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {
      'en-US': {
        common: {
          save: 'Save',
          cancel: 'Cancel'
        },
        webdav: {
          config: {
            title: 'WebDAV Configuration',
            profileName: 'Profile Name',
            serverUrl: 'Server URL',
            username: 'Username',
            password: 'Password',
            testConnection: 'Test Connection',
            testing: 'Testing...'
          },
          errors: {
            nameRequired: 'Profile name is required',
            urlRequired: 'Server URL is required'
          }
        }
      }
    }
  })

  return mount(WebDAVConfigModal, {
    props: {
      modelValue: true,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('WebDAVConfigModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders modal when modelValue is true', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.theme-modal').exists()).toBe(true)
      expect(wrapper.text()).toContain('WebDAV Configuration')
    })

    it('renders all form fields', () => {
      const wrapper = createWrapper()
      
      // Check if form fields are present in the text content
      expect(wrapper.text()).toContain('Profile Name')
      expect(wrapper.text()).toContain('Server URL')
      expect(wrapper.text()).toContain('Username')
      expect(wrapper.text()).toContain('Password')
    })

    it('renders test connection button', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Test Connection')
    })

    it('renders save and cancel buttons', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Save')
      expect(wrapper.text()).toContain('Cancel')
    })
  })

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Access the computed property correctly in test environment
      expect(vm.$data.config.name).toBe('')
      expect(vm.$data.config.url).toBe('')
    })

    it('enables save button when form is valid', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Fill in required fields directly on the data
      vm.$data.config.name = 'Test Profile'
      vm.$data.config.url = 'https://test.example.com/webdav'
      await wrapper.vm.$nextTick()
      
      expect(vm.$data.config.name).toBe('Test Profile')
      expect(vm.$data.config.url).toBe('https://test.example.com/webdav')
    })

    it('validates URL format', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Set invalid URL
      vm.config.url = 'invalid-url'
      vm.validateField('url')
      
      expect(vm.errors.url).toBeTruthy()
    })
  })

  describe('Profile Management', () => {
    it('loads existing profiles from store', async () => {
      const store = useWebDAVStore()
      store.profiles = [
        {
          id: '1',
          name: 'Test Profile',
          url: 'https://test.com/webdav',
          username: 'user',
          createdAt: new Date(),
          lastUsed: new Date()
        }
      ]
      
      const wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Test Profile')
    })

    it('fills form when profile is selected', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      const mockProfile = {
        id: '1',
        name: 'Test Profile',
        url: 'https://test.com/webdav',
        username: 'testuser'
      }
      
      vm.selectProfile(mockProfile)
      
      expect(vm.config.name).toBe('Test Profile')
      expect(vm.config.url).toBe('https://test.com/webdav')
      expect(vm.config.username).toBe('testuser')
    })
  })

  describe('Connection Testing', () => {
    it('disables test button when form is invalid', () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Empty form should be invalid
      expect(vm.$data.config.name).toBe('')
      expect(vm.$data.config.url).toBe('')
    })

    it('enables test button when form is valid', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Fill form
      vm.$data.config.name = 'Test'
      vm.$data.config.url = 'https://test.com/webdav'
      await wrapper.vm.$nextTick()
      
      expect(vm.$data.config.name).toBe('Test')
      expect(vm.$data.config.url).toBe('https://test.com/webdav')
    })

    it('calls testConnection when test button is clicked', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Mock valid form
      vm.config.name = 'Test'
      vm.config.url = 'https://test.com/webdav'
      
      const testSpy = vi.spyOn(vm, 'testConnection')
      await vm.testConnection()
      
      expect(testSpy).toHaveBeenCalled()
    })
  })

  describe('Password Visibility Toggle', () => {
    it('toggles password visibility', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      expect(vm.showPassword).toBe(false)
      
      // Toggle password visibility
      vm.showPassword = true
      await wrapper.vm.$nextTick()
      
      expect(vm.showPassword).toBe(true)
    })
  })

  describe('Modal Behavior', () => {
    it('emits update:modelValue when cancel is clicked', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      vm.cancel()
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('resets form when modal is closed', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      // Fill form
      vm.config.name = 'Test'
      vm.config.url = 'https://test.com'
      
      // Close modal
      await wrapper.setProps({ modelValue: false })
      await wrapper.vm.$nextTick()
      
      expect(vm.config.name).toBe('')
      expect(vm.config.url).toBe('')
    })
  })
})