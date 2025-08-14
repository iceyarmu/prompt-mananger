import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { TreeNode } from './types'

export const useFileTreeStore = defineStore('fileTree', () => {
  const tree = ref<TreeNode[]>([])
  const selectedNode = ref<TreeNode | null>(null)
  const expandedPaths = ref<Set<string>>(new Set())
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  const selectedPath = computed(() => selectedNode.value?.path || null)
  const hasSelection = computed(() => selectedNode.value !== null)
  const filteredTree = computed(() => {
    if (!searchQuery.value) return tree.value
    return filterTree(tree.value, searchQuery.value)
  })
  
  const sortedTree = computed(() => {
    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
      return [...nodes].sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1
        if (a.type === 'file' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      }).map(node => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined
      }))
    }
    return sortNodes(filteredTree.value)
  })
  
  async function loadTree(path: string = '/') {
    loading.value = true
    error.value = null
    
    try {
      const rootNodes = await loadDirectoryContents(path)
      tree.value = rootNodes
      
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
    const { webdavStore } = await import('./webdav')
    const store = webdavStore()
    
    if (!store.isConnected) {
      throw new Error('WebDAV not connected')
    }
    
    const { WebDAVService } = await import('@prompt-optimizer/webdav')
    const webdavService = new WebDAVService()
    
    const profile = await store.getProfileWithCredentials(store.activeProfile!.id)
    
    await webdavService.connect({
      url: profile.url,
      username: profile.username,
      password: profile.password,
      authType: profile.username && profile.password ? 'basic' : 'none',
      timeout: 30000
    })
    
    try {
      const items = await webdavService.listFolder(path)
      const nodes: TreeNode[] = []
      
      for (const item of items) {
        if (item.type === 'file' && !item.name.toLowerCase().endsWith('.md')) {
          continue
        }
        
        const node: TreeNode = {
          path: item.path,
          name: item.name,
          type: item.type === 'directory' ? 'directory' : 'file',
          children: item.type === 'directory' ? [] : undefined,
          fileInfo: item
        }
        
        nodes.push(node)
      }
      
      return nodes
    } finally {
      await webdavService.disconnect()
    }
  }
  
  function selectNode(node: TreeNode | null) {
    selectedNode.value = node
  }
  
  function toggleNode(node: TreeNode) {
    if (node.type === 'directory') {
      if (expandedPaths.value.has(node.path)) {
        collapsePath(node.path)
      } else {
        expandPath(node.path)
        if (!node.children || node.children.length === 0) {
          node.isLoading = true
          loadDirectoryContents(node.path).then(children => {
            node.children = children
            node.isLoading = false
          }).catch(err => {
            console.error('Failed to load folder contents:', err)
            node.isLoading = false
            node.error = err instanceof Error ? err.message : 'Failed to load folder contents'
            error.value = node.error
          })
        }
      }
    }
  }
  
  function expandPath(path: string) {
    expandedPaths.value.add(path)
    persistExpandedPaths()
  }
  
  function collapsePath(path: string) {
    expandedPaths.value.delete(path)
    persistExpandedPaths()
  }
  
  function persistExpandedPaths() {
    localStorage.setItem('fileTree:expandedPaths', JSON.stringify(Array.from(expandedPaths.value)))
  }
  
  function collapseAll() {
    expandedPaths.value.clear()
    localStorage.removeItem('fileTree:expandedPaths')
  }
  
  function expandAll() {
    const addAllPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          expandedPaths.value.add(node.path)
          if (node.children) {
            addAllPaths(node.children)
          }
        }
      }
    }
    addAllPaths(tree.value)
    persistExpandedPaths()
  }
  
  function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    if (!query) return nodes
    
    const lowerQuery = query.toLowerCase()
    const filtered: TreeNode[] = []
    
    for (const node of nodes) {
      const nameMatches = node.name.toLowerCase().includes(lowerQuery)
      
      if (node.type === 'directory' && node.children) {
        const filteredChildren = filterTree(node.children, query)
        if (filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children: filteredChildren,
            isExpanded: true
          })
        } else if (nameMatches) {
          filtered.push(node)
        }
      } else if (node.type === 'file' && nameMatches) {
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
    if (node && node.type === 'directory') {
      node.isLoading = true
      try {
        const children = await loadDirectoryContents(nodePath)
        node.children = children
      } catch (err) {
        console.error('Failed to refresh folder:', err)
        error.value = err instanceof Error ? err.message : 'Failed to refresh folder'
      } finally {
        node.isLoading = false
      }
    }
  }
  
  function setNodeModified(path: string, isModified: boolean) {
    const node = findNodeByPath(path)
    if (node) {
      if (isModified) {
        node.name = node.name.endsWith(' •') ? node.name : `${node.name} •`
      } else {
        node.name = node.name.replace(' •', '')
      }
    }
  }
  
  function clearTree() {
    tree.value = []
    selectedNode.value = null
    expandedPaths.value.clear()
    searchQuery.value = ''
    error.value = null
  }
  
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }
  
  // Task 8: Context Menu Operations
  async function createFile(parentPath: string, fileName: string): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const { webdavStore } = await import('./webdav')
      const store = webdavStore()
      
      if (!store.isConnected) {
        throw new Error('WebDAV not connected')
      }
      
      const { WebDAVService } = await import('@prompt-optimizer/webdav')
      const webdavService = new WebDAVService()
      
      const profile = await store.getProfileWithCredentials(store.activeProfile!.id)
      
      await webdavService.connect({
        url: profile.url,
        username: profile.username,
        password: profile.password,
        authType: profile.username && profile.password ? 'basic' : 'none',
        timeout: 30000
      })
      
      try {
        const filePath = `${parentPath}/${fileName}`.replace(/\/+/g, '/')
        
        // Create the file with empty content
        await webdavService.writeFile(filePath, '')
        
        // Refresh the parent directory
        await refreshNode(parentPath)
        
        // Emit success event
        const { storeBus } = await import('./communication')
        storeBus.emit('fileTree', 'file-created', { 
          path: filePath,
          parentPath,
          fileName
        })
        
        return true
      } finally {
        await webdavService.disconnect()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create file'
      
      // Emit error event
      const { storeBus } = await import('./communication')
      storeBus.emit('fileTree', 'error', { 
        operation: 'create-file',
        error: error.value
      })
      
      return false
    } finally {
      loading.value = false
    }
  }
  
  async function createFolder(parentPath: string, folderName: string): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const { webdavStore } = await import('./webdav')
      const store = webdavStore()
      
      if (!store.isConnected) {
        throw new Error('WebDAV not connected')
      }
      
      const { WebDAVService } = await import('@prompt-optimizer/webdav')
      const webdavService = new WebDAVService()
      
      const profile = await store.getProfileWithCredentials(store.activeProfile!.id)
      
      await webdavService.connect({
        url: profile.url,
        username: profile.username,
        password: profile.password,
        authType: profile.username && profile.password ? 'basic' : 'none',
        timeout: 30000
      })
      
      try {
        const folderPath = `${parentPath}/${folderName}`.replace(/\/+/g, '/')
        
        // Create the directory
        await webdavService.createDirectory(folderPath)
        
        // Refresh the parent directory
        await refreshNode(parentPath)
        
        // Emit success event
        const { storeBus } = await import('./communication')
        storeBus.emit('fileTree', 'folder-created', { 
          path: folderPath,
          parentPath,
          folderName
        })
        
        return true
      } finally {
        await webdavService.disconnect()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create folder'
      
      // Emit error event
      const { storeBus } = await import('./communication')
      storeBus.emit('fileTree', 'error', { 
        operation: 'create-folder',
        error: error.value
      })
      
      return false
    } finally {
      loading.value = false
    }
  }
  
  async function renameNode(oldPath: string, newName: string): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const { webdavStore } = await import('./webdav')
      const store = webdavStore()
      
      if (!store.isConnected) {
        throw new Error('WebDAV not connected')
      }
      
      const { WebDAVService } = await import('@prompt-optimizer/webdav')
      const webdavService = new WebDAVService()
      
      const profile = await store.getProfileWithCredentials(store.activeProfile!.id)
      
      await webdavService.connect({
        url: profile.url,
        username: profile.username,
        password: profile.password,
        authType: profile.username && profile.password ? 'basic' : 'none',
        timeout: 30000
      })
      
      try {
        const pathParts = oldPath.split('/')
        pathParts[pathParts.length - 1] = newName
        const newPath = pathParts.join('/')
        
        // Move/rename the file or folder
        await webdavService.moveFile(oldPath, newPath)
        
        // Refresh the parent directory
        const parentPath = pathParts.slice(0, -1).join('/') || '/'
        await refreshNode(parentPath)
        
        // Update selection if renamed node was selected
        if (selectedNode.value?.path === oldPath) {
          const newNode = findNodeByPath(newPath)
          if (newNode) {
            selectNode(newNode)
          }
        }
        
        // Emit success event
        const { storeBus } = await import('./communication')
        storeBus.emit('fileTree', 'node-renamed', { 
          oldPath,
          newPath,
          newName
        })
        
        return true
      } finally {
        await webdavService.disconnect()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename'
      
      // Emit error event
      const { storeBus } = await import('./communication')
      storeBus.emit('fileTree', 'error', { 
        operation: 'rename',
        error: error.value
      })
      
      return false
    } finally {
      loading.value = false
    }
  }
  
  async function deleteNode(path: string): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const { webdavStore } = await import('./webdav')
      const store = webdavStore()
      
      if (!store.isConnected) {
        throw new Error('WebDAV not connected')
      }
      
      const { WebDAVService } = await import('@prompt-optimizer/webdav')
      const webdavService = new WebDAVService()
      
      const profile = await store.getProfileWithCredentials(store.activeProfile!.id)
      
      await webdavService.connect({
        url: profile.url,
        username: profile.username,
        password: profile.password,
        authType: profile.username && profile.password ? 'basic' : 'none',
        timeout: 30000
      })
      
      try {
        // Delete the file or folder
        await webdavService.deleteFile(path)
        
        // Clear selection if deleted node was selected
        if (selectedNode.value?.path === path) {
          selectNode(null)
        }
        
        // Refresh the parent directory
        const pathParts = path.split('/')
        const parentPath = pathParts.slice(0, -1).join('/') || '/'
        await refreshNode(parentPath)
        
        // Emit success event
        const { storeBus } = await import('./communication')
        storeBus.emit('fileTree', 'node-deleted', { 
          path,
          parentPath
        })
        
        return true
      } finally {
        await webdavService.disconnect()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete'
      
      // Emit error event
      const { storeBus } = await import('./communication')
      storeBus.emit('fileTree', 'error', { 
        operation: 'delete',
        error: error.value
      })
      
      return false
    } finally {
      loading.value = false
    }
  }
  
  async function duplicateNode(path: string): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const { webdavStore } = await import('./webdav')
      const store = webdavStore()
      
      if (!store.isConnected) {
        throw new Error('WebDAV not connected')
      }
      
      const { WebDAVService } = await import('@prompt-optimizer/webdav')
      const webdavService = new WebDAVService()
      
      const profile = await store.getProfileWithCredentials(store.activeProfile!.id)
      
      await webdavService.connect({
        url: profile.url,
        username: profile.username,
        password: profile.password,
        authType: profile.username && profile.password ? 'basic' : 'none',
        timeout: 30000
      })
      
      try {
        // Generate duplicate name
        const pathParts = path.split('/')
        const originalName = pathParts[pathParts.length - 1]
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
        const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : ''
        
        let copyNumber = 1
        let duplicatePath = ''
        let duplicateExists = true
        
        // Find a unique name for the duplicate
        while (duplicateExists) {
          const duplicateName = `${nameWithoutExt}_copy${copyNumber > 1 ? copyNumber : ''}${extension}`
          pathParts[pathParts.length - 1] = duplicateName
          duplicatePath = pathParts.join('/')
          
          try {
            await webdavService.getFile(duplicatePath)
            copyNumber++
          } catch {
            duplicateExists = false
          }
        }
        
        // Read the original file content
        const content = await webdavService.readFile(path)
        
        // Write to the duplicate path
        await webdavService.writeFile(duplicatePath, content)
        
        // Refresh the parent directory
        const parentPath = pathParts.slice(0, -1).join('/') || '/'
        await refreshNode(parentPath)
        
        // Emit success event
        const { storeBus } = await import('./communication')
        storeBus.emit('fileTree', 'node-duplicated', { 
          originalPath: path,
          duplicatePath
        })
        
        return true
      } finally {
        await webdavService.disconnect()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to duplicate'
      
      // Emit error event
      const { storeBus } = await import('./communication')
      storeBus.emit('fileTree', 'error', { 
        operation: 'duplicate',
        error: error.value
      })
      
      return false
    } finally {
      loading.value = false
    }
  }
  
  return {
    tree,
    selectedNode,
    expandedPaths,
    searchQuery,
    loading,
    error,
    selectedPath,
    hasSelection,
    filteredTree,
    sortedTree,
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
    setNodeModified,
    clearTree,
    setSearchQuery,
    // Context menu operations
    createFile,
    createFolder,
    renameNode,
    deleteNode,
    duplicateNode
  }
})