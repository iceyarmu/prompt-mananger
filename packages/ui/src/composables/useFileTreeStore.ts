import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useWebDAVStore } from './useWebDAVStore'
import { WebDAVService, type FileInfo } from '@prompt-optimizer/webdav'
import type { TreeNode } from '../types/fileTree'

export const useFileTreeStore = defineStore('fileTree', () => {
  // State
  const tree = ref<TreeNode[]>([])
  const selectedNode = ref<TreeNode | null>(null)
  const expandedPaths = ref<Set<string>>(new Set())
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // WebDAV store
  const webdavStore = useWebDAVStore()

  // Computed
  const selectedPath = computed(() => selectedNode.value?.path || null)
  const hasSelection = computed(() => selectedNode.value !== null)

  // Actions
  async function loadTree(path: string = '/') {
    if (!webdavStore.isConnected) {
      throw new Error('WebDAV not connected')
    }

    loading.value = true
    error.value = null

    try {
      // Load the tree structure from WebDAV
      const rootNodes = await loadDirectoryContents(path)
      tree.value = rootNodes
      
      // Restore expanded paths from localStorage
      const storedPaths = localStorage.getItem('fileTree:expandedPaths')
      if (storedPaths) {
        expandedPaths.value = new Set(JSON.parse(storedPaths))
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load file tree'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadDirectoryContents(path: string): Promise<TreeNode[]> {
    // Create a WebDAV service instance and connect
    const webdavService = new WebDAVService()
    
    // Get credentials from the webdav store
    const profile = await webdavStore.getProfileWithCredentials(webdavStore.activeProfile!.id)
    
    // Connect to WebDAV using the profile credentials
    await webdavService.connect({
      url: profile.url,
      username: profile.username,
      password: profile.password,
      authType: profile.username && profile.password ? 'basic' : 'none',
      timeout: 30000
    })
    
    try {
      // List folder contents from WebDAV
      const items = await webdavService.listFolder(path)
      
      // Build tree nodes from WebDAV items
      const nodes: TreeNode[] = []
      
      for (const item of items) {
        // Filter to only show .md files and folders that might contain them
        if (item.type === 'file' && !item.name.toLowerCase().endsWith('.md')) {
          continue // Skip non-.md files
        }
        
        const node: TreeNode = {
          id: `${item.type}-${item.path}`,
          name: item.name,
          path: item.path,
          type: item.type === 'directory' ? 'folder' : 'file',
          metadata: {
            size: item.size,
            modified: item.lastModified
          }
        }
        
        // For folders, recursively check if they contain .md files
        if (item.type === 'directory') {
          // Check if folder has any .md files (lazy load on expand)
          node.children = [] // Initialize as empty, will load on expand
        }
        
        nodes.push(node)
      }
      
      return nodes
      
    } finally {
      // Always disconnect after operation
      await webdavService.disconnect()
    }
  }

  function selectNode(node: TreeNode | null) {
    selectedNode.value = node
  }

  function toggleNode(node: TreeNode) {
    if (node.type === 'folder') {
      if (expandedPaths.value.has(node.path)) {
        expandedPaths.value.delete(node.path)
      } else {
        expandedPaths.value.add(node.path)
        // Lazy load children if not loaded
        if (!node.children || node.children.length === 0) {
          node.loading = true
          loadDirectoryContents(node.path).then(children => {
            node.children = children
            node.loading = false
          }).catch(err => {
            console.error('Failed to load folder contents:', err)
            node.loading = false
            error.value = err instanceof Error ? err.message : 'Failed to load folder contents'
          })
        }
      }
      
      // Persist expanded paths
      localStorage.setItem('fileTree:expandedPaths', JSON.stringify(Array.from(expandedPaths.value)))
    }
  }

  function expandPath(path: string) {
    expandedPaths.value.add(path)
    localStorage.setItem('fileTree:expandedPaths', JSON.stringify(Array.from(expandedPaths.value)))
  }

  function collapsePath(path: string) {
    expandedPaths.value.delete(path)
    localStorage.setItem('fileTree:expandedPaths', JSON.stringify(Array.from(expandedPaths.value)))
  }

  function collapseAll() {
    expandedPaths.value.clear()
    localStorage.removeItem('fileTree:expandedPaths')
  }

  function expandAll() {
    const addAllPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'folder') {
          expandedPaths.value.add(node.path)
          if (node.children) {
            addAllPaths(node.children)
          }
        }
      }
    }
    addAllPaths(tree.value)
    localStorage.setItem('fileTree:expandedPaths', JSON.stringify(Array.from(expandedPaths.value)))
  }

  function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    if (!query) return nodes
    
    const lowerQuery = query.toLowerCase()
    const filtered: TreeNode[] = []
    
    for (const node of nodes) {
      // Check if node name matches
      const nameMatches = node.name.toLowerCase().includes(lowerQuery)
      
      // For folders, also check children
      if (node.type === 'folder' && node.children) {
        const filteredChildren = filterTree(node.children, query)
        if (filteredChildren.length > 0) {
          // Include folder if it has matching children
          filtered.push({
            ...node,
            children: filteredChildren,
            expanded: true // Auto-expand folders with matches
          })
        } else if (nameMatches) {
          // Include folder if its name matches
          filtered.push(node)
        }
      } else if (node.type === 'file' && nameMatches) {
        // Include file if name matches and it's a .md file
        if (node.name.toLowerCase().endsWith('.md')) {
          filtered.push(node)
        }
      }
    }
    
    return filtered
  }

  function findNodeByPath(path: string): TreeNode | null {
    const search = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node
        if (node.children) {
          const found = search(node.children)
          if (found) return found
        }
      }
      return null
    }
    return search(tree.value)
  }

  function refresh() {
    return loadTree()
  }

  async function refreshNode(nodePath: string) {
    const node = findNodeByPath(nodePath)
    if (node && node.type === 'folder') {
      node.loading = true
      try {
        const children = await loadDirectoryContents(nodePath)
        node.children = children
      } catch (err) {
        console.error('Failed to refresh folder:', err)
        error.value = err instanceof Error ? err.message : 'Failed to refresh folder'
      } finally {
        node.loading = false
      }
    }
  }

  // Clear store on disconnect
  function clearTree() {
    tree.value = []
    selectedNode.value = null
    expandedPaths.value.clear()
    searchQuery.value = ''
    error.value = null
  }

  return {
    // State
    tree,
    selectedNode,
    expandedPaths,
    searchQuery,
    loading,
    error,

    // Computed
    selectedPath,
    hasSelection,

    // Actions
    loadTree,
    selectNode,
    toggleNode,
    expandPath,
    collapsePath,
    expandAll,
    collapseAll,
    filterTree,
    findNodeByPath,
    refresh,
    refreshNode,
    clearTree
  }
})