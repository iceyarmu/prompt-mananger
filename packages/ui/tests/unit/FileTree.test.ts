import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FileTree from '../../src/components/FileTree.vue'
import TreeNode from '../../src/components/TreeNode.vue'
import { useFileTreeStore } from '../../src/composables/useFileTreeStore'
import { useWebDAVStore } from '../../src/composables/useWebDAVStore'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

// Mock toast
vi.mock('../../src/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}))

describe('FileTree', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders empty state when no files', () => {
    const wrapper = mount(FileTree)
    expect(wrapper.text()).toContain('fileTree.empty')
  })

  it('shows loading state', async () => {
    const fileTreeStore = useFileTreeStore()
    // Set loading to true before mounting
    fileTreeStore.$patch({ loading: true })
    
    const wrapper = mount(FileTree)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('displays search input', () => {
    const wrapper = mount(FileTree)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('emits file-selected event when node is selected', async () => {
    const wrapper = mount(FileTree)
    const fileTreeStore = useFileTreeStore()
    
    // Add sample tree data
    fileTreeStore.tree.value = [
      {
        id: 'file-1',
        name: 'test.md',
        path: '/test.md',
        type: 'file'
      }
    ]
    
    await wrapper.vm.$nextTick()
    
    // Simulate selecting a node
    wrapper.vm.selectNode('file-1')
    
    expect(wrapper.emitted('file-selected')).toBeTruthy()
    expect(wrapper.emitted('file-selected')[0]).toEqual(['/test.md'])
  })
})

describe('TreeNode', () => {
  it('renders file node correctly', () => {
    const node = {
      id: 'file-1',
      name: 'test.md',
      path: '/test.md',
      type: 'file' as const
    }
    
    const wrapper = mount(TreeNode, {
      props: {
        node,
        level: 0,
        selectedId: null,
        expandedPaths: new Set(),
        searchQuery: ''
      }
    })
    
    expect(wrapper.text()).toContain('test.md')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders folder node with expand icon', () => {
    const node = {
      id: 'folder-1',
      name: 'folder',
      path: '/folder',
      type: 'folder' as const,
      children: []
    }
    
    const wrapper = mount(TreeNode, {
      props: {
        node,
        level: 0,
        selectedId: null,
        expandedPaths: new Set(),
        searchQuery: ''
      }
    })
    
    expect(wrapper.text()).toContain('folder')
    expect(wrapper.find('.tree-node-expand').exists()).toBe(true)
  })

  it('highlights search matches', () => {
    const node = {
      id: 'file-1',
      name: 'test.md',
      path: '/test.md',
      type: 'file' as const
    }
    
    const wrapper = mount(TreeNode, {
      props: {
        node,
        level: 0,
        selectedId: null,
        expandedPaths: new Set(),
        searchQuery: 'test'
      }
    })
    
    expect(wrapper.html()).toContain('<mark')
  })

  it('emits toggle event when folder is clicked', async () => {
    const node = {
      id: 'folder-1',
      name: 'folder',
      path: '/folder',
      type: 'folder' as const,
      children: []
    }
    
    const wrapper = mount(TreeNode, {
      props: {
        node,
        level: 0,
        selectedId: null,
        expandedPaths: new Set(),
        searchQuery: ''
      }
    })
    
    await wrapper.find('.tree-node-content').trigger('click')
    
    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')[0]).toEqual(['folder-1'])
  })

  it('emits open event on double click for files', async () => {
    const node = {
      id: 'file-1',
      name: 'test.md',
      path: '/test.md',
      type: 'file' as const
    }
    
    const wrapper = mount(TreeNode, {
      props: {
        node,
        level: 0,
        selectedId: null,
        expandedPaths: new Set(),
        searchQuery: ''
      }
    })
    
    await wrapper.find('.tree-node-content').trigger('dblclick')
    
    expect(wrapper.emitted('open')).toBeTruthy()
    expect(wrapper.emitted('open')[0]).toEqual(['file-1'])
  })
})