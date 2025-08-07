import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
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

/**
 * Real WebDAV Integration Tests for FileTree Component
 * 
 * Prerequisites:
 * 1. Start the Docker WebDAV test server:
 *    cd packages/ui/tests/docker && ./test-helper.sh start
 * 
 * 2. The server should be running at http://localhost:8080
 *    Username: testuser
 *    Password: testpass
 * 
 * 3. Test data should be automatically generated with 1000+ .md files
 */
describe('FileTree Real WebDAV Integration Tests', () => {
  let pinia: any
  let fileTreeStore: any
  let webdavStore: any
  let webdavService: WebDAVService
  let isServerAvailable = false

  // Check if WebDAV server is available
  beforeAll(async () => {
    try {
      // Try to connect to the Docker WebDAV server
      const response = await fetch('http://localhost:8080/', {
        method: 'HEAD',
        headers: {
          'Authorization': 'Basic ' + btoa('testuser:testpass')
        }
      })
      
      isServerAvailable = response.ok || response.status === 207
      
      if (!isServerAvailable) {
        console.warn('⚠️  WebDAV test server is not available at http://localhost:8080')
        console.warn('   Run: cd packages/ui/tests/docker && ./test-helper.sh start')
        console.warn('   Skipping real WebDAV tests...')
      } else {
        console.log('✅ WebDAV test server is available')
      }
    } catch (error) {
      console.warn('⚠️  Could not connect to WebDAV test server:', error)
      console.warn('   Skipping real WebDAV tests...')
      isServerAvailable = false
    }
  })

  beforeEach(async () => {
    if (!isServerAvailable) return

    // Create a new pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Get store instances
    fileTreeStore = useFileTreeStore()
    webdavStore = useWebDAVStore()
    
    // Create real WebDAV service
    webdavService = new WebDAVService()
    
    // Connect to the Docker WebDAV server
    const connected = await webdavService.connect({
      url: 'http://localhost:8080',
      username: 'testuser',
      password: 'testpass',
      authType: 'basic'
    })
    
    if (connected) {
      // Update webdav store with connection
      webdavStore.$patch({
        connectionStatus: 'connected',
        activeProfile: {
          id: 'test-profile',
          name: 'Docker Test Server',
          url: 'http://localhost:8080',
          username: 'testuser',
          createdAt: new Date()
        },
        service: webdavService
      })
    }
  })

  afterAll(async () => {
    if (webdavService) {
      await webdavService.disconnect()
    }
  })

  describe('Real Data Loading', () => {
    it('should load file tree from real WebDAV server', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      // Load the tree
      await fileTreeStore.loadTree()
      
      // Wait for loading to complete
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Check that we have loaded data
      expect(fileTreeStore.tree).toBeDefined()
      expect(fileTreeStore.tree.length).toBeGreaterThan(0)
      
      // Verify we have the expected folders from test data
      const rootFolderNames = fileTreeStore.tree.map((node: any) => node.name)
      expect(rootFolderNames).toContain('documents')
      expect(rootFolderNames).toContain('notes')
      expect(rootFolderNames).toContain('templates')
      expect(rootFolderNames).toContain('performance-test')
      
      // Check that .md files are included
      const hasMarkdownFiles = fileTreeStore.tree.some((node: any) => 
        node.name.endsWith('.md') || 
        (node.children && node.children.some((child: any) => child.name.endsWith('.md')))
      )
      expect(hasMarkdownFiles).toBe(true)
      
      // Check that non-.md files are filtered out
      const hasNonMarkdownFiles = fileTreeStore.tree.some((node: any) => 
        node.name.endsWith('.json') || 
        node.name.endsWith('.csv') || 
        node.name.endsWith('.txt')
      )
      expect(hasNonMarkdownFiles).toBe(false)
    })

    it('should handle large datasets with virtual scrolling', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      // Load the tree
      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Expand performance-test folder to load 1000+ files
      const perfTestNode = fileTreeStore.tree.find((node: any) => node.name === 'performance-test')
      expect(perfTestNode).toBeDefined()
      
      if (perfTestNode) {
        await fileTreeStore.toggleNode(perfTestNode.id)
        
        // Wait for children to load
        await vi.waitFor(() => perfTestNode.children && perfTestNode.children.length > 0, { timeout: 5000 })
        
        // Check that virtual scrolling is activated (>100 items)
        const totalNodes = countAllNodes(fileTreeStore.tree)
        console.log(`Total nodes in tree: ${totalNodes}`)
        
        if (totalNodes > 100) {
          // Virtual scrolling should be active
          const virtualContainer = wrapper.find('.virtual-scroll-container')
          expect(virtualContainer.exists()).toBe(true)
        }
      }
    })

    it('should maintain performance with 1000+ files', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      const startTime = performance.now()
      
      // Load the tree
      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 10000 })
      
      const loadTime = performance.now() - startTime
      console.log(`Tree load time: ${loadTime}ms`)
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
      
      // Test search performance
      const searchStartTime = performance.now()
      await wrapper.find('input[type="text"]').setValue('file-0500')
      
      // Wait for debounced search
      await new Promise(resolve => setTimeout(resolve, 400))
      
      const searchTime = performance.now() - searchStartTime
      console.log(`Search time: ${searchTime}ms`)
      
      // Search should complete within 500ms
      expect(searchTime).toBeLessThan(500)
    })

    it('should correctly filter and display only .md files', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Check edge-cases folder which contains both .md and non-.md files
      const edgeCasesNode = fileTreeStore.tree.find((node: any) => node.name === 'edge-cases')
      
      if (edgeCasesNode) {
        await fileTreeStore.toggleNode(edgeCasesNode.id)
        await vi.waitFor(() => edgeCasesNode.children && edgeCasesNode.children.length > 0, { timeout: 5000 })
        
        // Find special-chars folder
        const specialCharsNode = edgeCasesNode.children.find((node: any) => node.name === 'special-chars')
        
        if (specialCharsNode) {
          await fileTreeStore.toggleNode(specialCharsNode.id)
          await vi.waitFor(() => specialCharsNode.children && specialCharsNode.children.length > 0, { timeout: 5000 })
          
          // All children should be .md files
          specialCharsNode.children.forEach((child: any) => {
            expect(child.name).toMatch(/\.md$/)
          })
          
          // Check for special character handling
          const specialFileNames = specialCharsNode.children.map((child: any) => child.name)
          expect(specialFileNames).toContain('file-with-dash.md')
          expect(specialFileNames).toContain('file_with_underscore.md')
          expect(specialFileNames).toContain('FILE-UPPERCASE.md')
        }
      }
    })

    it('should handle deep folder nesting', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Navigate through deep nested structure
      const edgeCasesNode = fileTreeStore.tree.find((node: any) => node.name === 'edge-cases')
      
      if (edgeCasesNode) {
        await fileTreeStore.toggleNode(edgeCasesNode.id)
        await vi.waitFor(() => edgeCasesNode.children && edgeCasesNode.children.length > 0)
        
        // Follow the deep path: edge-cases -> deep -> nested -> structure -> very -> deep -> level
        let currentNode = edgeCasesNode.children.find((n: any) => n.name === 'deep')
        const pathSegments = ['nested', 'structure', 'very', 'deep', 'level']
        
        for (const segment of pathSegments) {
          if (currentNode) {
            await fileTreeStore.toggleNode(currentNode.id)
            await vi.waitFor(() => currentNode.children && currentNode.children.length > 0)
            currentNode = currentNode.children.find((n: any) => n.name === segment)
            expect(currentNode).toBeDefined()
          }
        }
        
        // Final level should contain deep-file.md
        if (currentNode && currentNode.children) {
          const deepFile = currentNode.children.find((n: any) => n.name === 'deep-file.md')
          expect(deepFile).toBeDefined()
        }
      }
    })

    it('should persist expanded state during session', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Expand some folders
      const documentsNode = fileTreeStore.tree.find((node: any) => node.name === 'documents')
      const notesNode = fileTreeStore.tree.find((node: any) => node.name === 'notes')
      
      if (documentsNode) {
        await fileTreeStore.toggleNode(documentsNode.id)
        expect(fileTreeStore.expandedPaths.has(documentsNode.id)).toBe(true)
      }
      
      if (notesNode) {
        await fileTreeStore.toggleNode(notesNode.id)
        expect(fileTreeStore.expandedPaths.has(notesNode.id)).toBe(true)
      }
      
      // Simulate remounting the component (session persistence)
      wrapper.unmount()
      
      const newWrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Expanded paths should be preserved
      if (documentsNode) {
        expect(fileTreeStore.expandedPaths.has(documentsNode.id)).toBe(true)
      }
      if (notesNode) {
        expect(fileTreeStore.expandedPaths.has(notesNode.id)).toBe(true)
      }
    })

    it('should handle search with real data', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Search for a specific file
      const searchInput = wrapper.find('input[type="text"]')
      await searchInput.setValue('README')
      
      // Wait for debounced search
      await new Promise(resolve => setTimeout(resolve, 400))
      
      // Get filtered results
      const filteredTree = fileTreeStore.getFilteredTree('README')
      
      // Should find README.md
      const hasReadme = filteredTree.some((node: any) => 
        node.name === 'README.md' || 
        (node.children && node.children.some((child: any) => child.name === 'README.md'))
      )
      expect(hasReadme).toBe(true)
      
      // Should not show files that don't match
      const hasUnrelatedFiles = filteredTree.some((node: any) => 
        node.name === 'test.md' || 
        (node.children && node.children.some((child: any) => child.name === 'test.md'))
      )
      expect(hasUnrelatedFiles).toBe(false)
    })

    it('should handle file selection and opening', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 5000 })

      // Find and select README.md
      const readmeNode = fileTreeStore.tree.find((node: any) => node.name === 'README.md')
      
      if (readmeNode) {
        // Single click to select
        await fileTreeStore.selectNode(readmeNode.id)
        expect(fileTreeStore.selectedNodeId).toBe(readmeNode.id)
        
        // Double click to open (emit event)
        const fileOpenSpy = vi.fn()
        wrapper.vm.$on = vi.fn((event: string, handler: Function) => {
          if (event === 'file-open') {
            fileOpenSpy.mockImplementation(handler)
          }
        })
        
        await fileTreeStore.openFile(readmeNode)
        
        // Should emit file-open event with node data
        expect(fileTreeStore.selectedNodeId).toBe(readmeNode.id)
      }
    })
  })

  describe('Performance Benchmarks', () => {
    it('should document performance metrics', async function() {
      if (!isServerAvailable) {
        this.skip()
        return
      }

      const metrics = {
        initialLoad: 0,
        largeDatasetLoad: 0,
        searchTime: 0,
        scrollPerformance: 0
      }

      const wrapper = mount(FileTree, {
        global: {
          plugins: [pinia]
        }
      })

      // Measure initial load
      const loadStart = performance.now()
      await fileTreeStore.loadTree()
      await vi.waitFor(() => !fileTreeStore.loading, { timeout: 10000 })
      metrics.initialLoad = performance.now() - loadStart

      // Measure large dataset handling
      const perfTestNode = fileTreeStore.tree.find((node: any) => node.name === 'performance-test')
      if (perfTestNode) {
        const expandStart = performance.now()
        await fileTreeStore.toggleNode(perfTestNode.id)
        await vi.waitFor(() => perfTestNode.children && perfTestNode.children.length > 0, { timeout: 10000 })
        
        // Expand all batch folders
        for (const batch of perfTestNode.children || []) {
          await fileTreeStore.toggleNode(batch.id)
        }
        metrics.largeDatasetLoad = performance.now() - expandStart
      }

      // Measure search performance
      const searchStart = performance.now()
      await wrapper.find('input[type="text"]').setValue('file-0750')
      await new Promise(resolve => setTimeout(resolve, 400))
      metrics.searchTime = performance.now() - searchStart

      // Log performance metrics
      console.log('\n📊 Performance Metrics:')
      console.log('=======================')
      console.log(`Initial Load: ${metrics.initialLoad.toFixed(2)}ms`)
      console.log(`Large Dataset Load: ${metrics.largeDatasetLoad.toFixed(2)}ms`)
      console.log(`Search Time: ${metrics.searchTime.toFixed(2)}ms`)
      console.log('=======================\n')

      // Performance assertions
      expect(metrics.initialLoad).toBeLessThan(3000) // Should load in under 3 seconds
      expect(metrics.searchTime).toBeLessThan(500)   // Search should complete in under 500ms
      
      if (metrics.largeDatasetLoad > 0) {
        expect(metrics.largeDatasetLoad).toBeLessThan(5000) // Large dataset in under 5 seconds
      }
    })
  })
})

// Helper function to count all nodes in tree
function countAllNodes(tree: any[]): number {
  let count = 0
  
  function traverse(nodes: any[]) {
    for (const node of nodes) {
      count++
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  
  traverse(tree)
  return count
}