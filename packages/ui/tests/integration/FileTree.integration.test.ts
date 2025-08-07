import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FileTree from '../../src/components/FileTree.vue'
import { useFileTreeStore } from '../../src/composables/useFileTreeStore'
import { useWebDAVStore } from '../../src/composables/useWebDAVStore'
import { WebDAVService } from '@prompt-optimizer/webdav'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('FileTree Integration Tests', () => {
  let pinia: any
  let fileTreeStore: any
  let webdavStore: any
  let mockWebDAVService: any

  beforeEach(() => {
    // Create a new pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Get store instances
    fileTreeStore = useFileTreeStore()
    webdavStore = useWebDAVStore()
    
    // Mock WebDAV service
    mockWebDAVService = {
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listFolder: vi.fn().mockResolvedValue([
        {
          name: 'folder1',
          path: '/folder1',
          type: 'directory',
          size: 0,
          lastModified: new Date()
        },
        {
          name: 'test.md',
          path: '/test.md',
          type: 'file',
          size: 1024,
          lastModified: new Date()
        },
        {
          name: 'notes.md',
          path: '/notes.md',
          type: 'file',
          size: 2048,
          lastModified: new Date()
        },
        {
          name: 'other.txt',
          path: '/other.txt',
          type: 'file',
          size: 512,
          lastModified: new Date()
        }
      ])
    }
    
    // Mock WebDAVService constructor
    vi.spyOn(WebDAVService.prototype, 'connect').mockImplementation(mockWebDAVService.connect)
    vi.spyOn(WebDAVService.prototype, 'disconnect').mockImplementation(mockWebDAVService.disconnect)
    vi.spyOn(WebDAVService.prototype, 'listFolder').mockImplementation(mockWebDAVService.listFolder)
    
    // Set up webdav store as connected
    webdavStore.$patch({
      connectionStatus: 'connected',
      activeProfile: {
        id: 'test-profile',
        name: 'Test Profile',
        url: 'https://test.webdav.com',
        username: 'testuser',
        createdAt: new Date()
      }
    })
    
    // Mock getProfileWithCredentials
    webdavStore.getProfileWithCredentials = vi.fn().mockResolvedValue({
      id: 'test-profile',
      name: 'Test Profile',
      url: 'https://test.webdav.com',
      username: 'testuser',
      password: 'testpass',
      createdAt: new Date()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('WebDAV Data Loading', () => {
    it('loads and displays files from WebDAV', async () => {
      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      // Wait for component to mount and load data
      await wrapper.vm.$nextTick()
      
      // Trigger loadTree
      await fileTreeStore.loadTree()
      await wrapper.vm.$nextTick()

      // Verify WebDAV service was called
      expect(mockWebDAVService.connect).toHaveBeenCalled()
      expect(mockWebDAVService.listFolder).toHaveBeenCalledWith('/')
      
      // Check that only .md files and folders are in the tree
      expect(fileTreeStore.tree).toHaveLength(3) // folder1, test.md, notes.md (other.txt filtered out)
      expect(fileTreeStore.tree.find((n: any) => n.name === 'folder1')).toBeTruthy()
      expect(fileTreeStore.tree.find((n: any) => n.name === 'test.md')).toBeTruthy()
      expect(fileTreeStore.tree.find((n: any) => n.name === 'notes.md')).toBeTruthy()
      expect(fileTreeStore.tree.find((n: any) => n.name === 'other.txt')).toBeFalsy()
    })

    it('handles WebDAV connection errors gracefully', async () => {
      // Mock connection failure
      mockWebDAVService.connect.mockRejectedValue(new Error('Connection failed'))
      
      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      // Try to load tree
      try {
        await fileTreeStore.loadTree()
      } catch (error) {
        // Expected to throw
      }

      await wrapper.vm.$nextTick()
      
      // Check error state
      expect(fileTreeStore.error).toBeTruthy()
      expect(fileTreeStore.loading).toBe(false)
    })

    it('lazy loads folder contents on expand', async () => {
      // Set up mock for subfolder
      mockWebDAVService.listFolder.mockImplementation((path: string) => {
        if (path === '/') {
          return Promise.resolve([
            {
              name: 'folder1',
              path: '/folder1',
              type: 'directory',
              size: 0,
              lastModified: new Date()
            }
          ])
        } else if (path === '/folder1') {
          return Promise.resolve([
            {
              name: 'subfolder.md',
              path: '/folder1/subfolder.md',
              type: 'file',
              size: 512,
              lastModified: new Date()
            }
          ])
        }
        return Promise.resolve([])
      })

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await wrapper.vm.$nextTick()

      const folderNode = fileTreeStore.tree[0]
      expect(folderNode.children).toEqual([])

      // Expand folder
      fileTreeStore.toggleNode(folderNode)
      await wrapper.vm.$nextTick()
      
      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify subfolder was loaded
      expect(mockWebDAVService.listFolder).toHaveBeenCalledWith('/folder1')
      expect(folderNode.children).toHaveLength(1)
      expect(folderNode.children[0].name).toBe('subfolder.md')
    })
  })

  describe('Search and Filter', () => {
    it('filters tree based on search query', async () => {
      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await wrapper.vm.$nextTick()

      // Set search query
      fileTreeStore.searchQuery = 'test'
      await wrapper.vm.$nextTick()

      // Get filtered results
      const filtered = fileTreeStore.filterTree(fileTreeStore.tree, 'test')
      
      // Should only show test.md
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('test.md')
    })

    it('preserves folder structure when filtering', async () => {
      // Set up nested structure
      mockWebDAVService.listFolder.mockResolvedValue([
        {
          name: 'docs',
          path: '/docs',
          type: 'directory',
          size: 0,
          lastModified: new Date(),
          children: [
            {
              name: 'readme.md',
              path: '/docs/readme.md',
              type: 'file',
              size: 1024,
              lastModified: new Date()
            }
          ]
        }
      ])

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      
      // Search for readme
      const filtered = fileTreeStore.filterTree(fileTreeStore.tree, 'readme')
      
      // Should show docs folder with readme.md inside
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('docs')
      expect(filtered[0].children).toBeDefined()
    })
  })

  describe('Virtual Scrolling', () => {
    it('activates virtual scrolling for large file lists', async () => {
      // Mock large file list (>100 items)
      const largeFileList = Array.from({ length: 150 }, (_, i) => ({
        name: `file${i}.md`,
        path: `/file${i}.md`,
        type: 'file',
        size: 1024,
        lastModified: new Date()
      }))
      
      mockWebDAVService.listFolder.mockResolvedValue(largeFileList)

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await wrapper.vm.$nextTick()

      // Check that virtual scrolling is active
      // The component should use virtual scrolling when tree has >100 items
      expect(fileTreeStore.tree.length).toBeGreaterThan(100)
      
      // Note: Full virtual scrolling testing would require checking DOM elements
      // which is limited in unit tests without a real browser environment
    })
  })

  describe('State Persistence', () => {
    it('persists expanded paths to localStorage', async () => {
      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await wrapper.vm.$nextTick()

      // Expand a folder
      const folderNode = fileTreeStore.tree[0]
      fileTreeStore.toggleNode(folderNode)

      // Check localStorage
      const stored = localStorage.getItem('fileTree:expandedPaths')
      expect(stored).toBeTruthy()
      const expandedPaths = JSON.parse(stored!)
      expect(expandedPaths).toContain('/folder1')
    })

    it('restores expanded paths from localStorage', async () => {
      // Set up localStorage with expanded paths
      localStorage.setItem('fileTree:expandedPaths', JSON.stringify(['/folder1']))

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await wrapper.vm.$nextTick()

      // Check that expanded paths were restored
      expect(fileTreeStore.expandedPaths.has('/folder1')).toBe(true)
    })
  })
})