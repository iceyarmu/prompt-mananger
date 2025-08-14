import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BreadcrumbNav from '../BreadcrumbNav.vue'
import { useFileTreeStore } from '../../../stores/fileTree'
import { storeBus } from '../../../stores/communication'

vi.mock('../../../stores/communication', () => ({
  storeBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

describe('BreadcrumbNav', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders root breadcrumb for root path', () => {
    const store = useFileTreeStore()
    store.currentPath = '/'
    
    const wrapper = mount(BreadcrumbNav)
    
    const items = wrapper.findAll('.breadcrumb-item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toBe('Root')
  })

  it('renders multiple breadcrumb items for nested path', () => {
    const store = useFileTreeStore()
    store.currentPath = '/documents/projects/webapp'
    
    const wrapper = mount(BreadcrumbNav)
    
    const items = wrapper.findAll('.breadcrumb-item')
    expect(items).toHaveLength(4)
    
    const labels = items.map(item => item.text().replace(' /', ''))
    expect(labels).toEqual(['Root', 'documents', 'projects', 'webapp'])
  })

  it('makes all items except last clickable', () => {
    const store = useFileTreeStore()
    store.currentPath = '/documents/projects'
    
    const wrapper = mount(BreadcrumbNav)
    
    const buttons = wrapper.findAll('.breadcrumb-link')
    const current = wrapper.find('.breadcrumb-current')
    
    expect(buttons).toHaveLength(2) // Root and documents are clickable
    expect(current.text()).toBe('projects') // projects is current
  })

  it('navigates to path when breadcrumb clicked', async () => {
    const store = useFileTreeStore()
    store.currentPath = '/documents/projects/webapp'
    store.navigateToPath = vi.fn()
    
    const wrapper = mount(BreadcrumbNav)
    
    const buttons = wrapper.findAll('.breadcrumb-link')
    
    // Click on "documents" breadcrumb
    await buttons[1].trigger('click')
    
    expect(store.navigateToPath).toHaveBeenCalledWith('/documents')
    expect(storeBus.emit).toHaveBeenCalledWith('filetree', 'navigate-to-path', '/documents')
  })

  it('truncates long folder names', () => {
    const store = useFileTreeStore()
    store.currentPath = '/very-long-folder-name-that-exceeds-twenty-characters'
    
    const wrapper = mount(BreadcrumbNav)
    
    const current = wrapper.find('.breadcrumb-current')
    expect(current.text()).toContain('...')
    expect(current.text().length).toBeLessThanOrEqual(20)
  })

  it('shows tooltip for long folder names', () => {
    const store = useFileTreeStore()
    const longName = 'very-long-folder-name-that-exceeds-twenty-characters'
    store.currentPath = `/${longName}`
    
    const wrapper = mount(BreadcrumbNav)
    
    const current = wrapper.find('.breadcrumb-current')
    expect(current.attributes('title')).toBe(longName)
  })

  it('does not show tooltip for short folder names', () => {
    const store = useFileTreeStore()
    store.currentPath = '/docs'
    
    const wrapper = mount(BreadcrumbNav)
    
    const current = wrapper.find('.breadcrumb-current')
    expect(current.attributes('title')).toBeUndefined()
  })

  it('handles root navigation correctly', async () => {
    const store = useFileTreeStore()
    store.currentPath = '/documents/projects'
    store.navigateToPath = vi.fn()
    
    const wrapper = mount(BreadcrumbNav)
    
    const rootButton = wrapper.findAll('.breadcrumb-link')[0]
    await rootButton.trigger('click')
    
    expect(store.navigateToPath).toHaveBeenCalledWith('/')
    expect(storeBus.emit).toHaveBeenCalledWith('filetree', 'navigate-to-path', '/')
  })

  it('updates when store currentPath changes', async () => {
    const store = useFileTreeStore()
    store.currentPath = '/documents'
    
    const wrapper = mount(BreadcrumbNav)
    
    expect(wrapper.findAll('.breadcrumb-item')).toHaveLength(2)
    
    // Update store path
    store.currentPath = '/documents/projects/webapp'
    await wrapper.vm.$nextTick()
    
    expect(wrapper.findAll('.breadcrumb-item')).toHaveLength(4)
  })

  it('handles empty path gracefully', () => {
    const store = useFileTreeStore()
    store.currentPath = ''
    
    const wrapper = mount(BreadcrumbNav)
    
    const items = wrapper.findAll('.breadcrumb-item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toBe('Root')
  })

  it('properly truncates labels maintaining readability', () => {
    const store = useFileTreeStore()
    store.currentPath = '/abcdefghijklmnopqrstuvwxyz'
    
    const wrapper = mount(BreadcrumbNav)
    
    const current = wrapper.find('.breadcrumb-current')
    const text = current.text()
    
    // Should have ellipsis in the middle
    expect(text).toContain('...')
    // Should show start and end of the name
    expect(text).toMatch(/^abcd.*xyz$/)
  })
})