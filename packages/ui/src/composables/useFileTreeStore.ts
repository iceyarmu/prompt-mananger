import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useWebDAVStore } from './useWebDAVStore'
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
      // Get the WebDAV service from the store
      const profile = await webdavStore.getProfileWithCredentials(webdavStore.activeProfile!.id)
      
      // For now, we'll create a mock tree structure
      // In a real implementation, this would call the WebDAV service
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
    // This is a placeholder implementation
    // In reality, this would call the WebDAV service's listFolder method
    
    // For now, return a mock structure
    if (path === '/') {
      return [
        {
          id: 'folder-1',
          name: 'prompts',
          path: '/prompts',
          type: 'folder',
          children: [
            {
              id: 'file-1',
              name: 'example.md',
              path: '/prompts/example.md',
              type: 'file',
              metadata: {
                size: 1024,
                modified: new Date()
              }
            },
            {
              id: 'file-2',
              name: 'template.md',
              path: '/prompts/template.md',
              type: 'file',
              metadata: {
                size: 2048,
                modified: new Date()
              }
            }
          ]
        },
        {
          id: 'folder-2',
          name: 'templates',
          path: '/templates',
          type: 'folder',
          children: []
        },
        {
          id: 'file-3',
          name: 'README.md',
          path: '/README.md',
          type: 'file',
          metadata: {
            size: 512,
            modified: new Date()
          }
        }
      ]
    }
    
    return []
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
        if (!node.children) {
          node.loading = true
          loadDirectoryContents(node.path).then(children => {
            node.children = children
            node.loading = false
          }).catch(err => {
            console.error('Failed to load folder contents:', err)
            node.loading = false
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
    clearTree
  }
})