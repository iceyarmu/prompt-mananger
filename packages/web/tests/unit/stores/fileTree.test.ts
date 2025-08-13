import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileTreeStore } from '../../../src/stores/fileTree'

vi.mock('../../../src/stores/webdav', () => ({
  webdavStore: () => ({
    isConnected: true,
    activeProfile: { id: 'test-profile' },
    getProfileWithCredentials: vi.fn().mockResolvedValue({
      url: 'http://test.webdav',
      username: 'test',
      password: 'test'
    })
  })
}))

vi.mock('@prompt-optimizer/webdav', () => ({
  WebDAVService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listFolder: vi.fn().mockResolvedValue([
      { name: 'folder1', path: '/folder1', type: 'directory', size: 0, lastModified: new Date() },
      { name: 'file1.md', path: '/file1.md', type: 'file', size: 100, lastModified: new Date() },
      { name: 'file2.txt', path: '/file2.txt', type: 'file', size: 200, lastModified: new Date() }
    ])
  }))
}))

describe('FileTree Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('should initialize with default values', () => {
    const store = useFileTreeStore()
    
    expect(store.tree).toEqual([])
    expect(store.selectedNode).toBe(null)
    expect(store.expandedPaths.size).toBe(0)
    expect(store.searchQuery).toBe('')
    expect(store.loading).toBe(false)
    expect(store.error).toBe(null)
    expect(store.selectedPath).toBe(null)
    expect(store.hasSelection).toBe(false)
  })

  it('should load tree from WebDAV', async () => {
    const store = useFileTreeStore()
    
    await store.loadTree()
    
    expect(store.tree).toHaveLength(2)
    expect(store.tree[0].name).toBe('folder1')
    expect(store.tree[0].type).toBe('directory')
    expect(store.tree[1].name).toBe('file1.md')
    expect(store.tree[1].type).toBe('file')
    expect(store.loading).toBe(false)
  })

  it('should select and deselect nodes', () => {
    const store = useFileTreeStore()
    const node = { name: 'test.md', path: '/test.md', type: 'file' as const }
    
    store.selectNode(node)
    expect(store.selectedNode).toBe(node)
    expect(store.selectedPath).toBe('/test.md')
    expect(store.hasSelection).toBe(true)
    
    store.selectNode(null)
    expect(store.selectedNode).toBe(null)
    expect(store.selectedPath).toBe(null)
    expect(store.hasSelection).toBe(false)
  })

  it('should expand and collapse paths', () => {
    const store = useFileTreeStore()
    
    store.expandPath('/folder1')
    expect(store.expandedPaths.has('/folder1')).toBe(true)
    expect(localStorage.getItem('fileTree:expandedPaths')).toContain('/folder1')
    
    store.collapsePath('/folder1')
    expect(store.expandedPaths.has('/folder1')).toBe(false)
  })

  it('should expand and collapse all nodes', () => {
    const store = useFileTreeStore()
    store.tree = [
      { name: 'folder1', path: '/folder1', type: 'directory', children: [] },
      { name: 'folder2', path: '/folder2', type: 'directory', children: [] }
    ]
    
    store.expandAll()
    expect(store.expandedPaths.has('/folder1')).toBe(true)
    expect(store.expandedPaths.has('/folder2')).toBe(true)
    
    store.collapseAll()
    expect(store.expandedPaths.size).toBe(0)
    expect(localStorage.getItem('fileTree:expandedPaths')).toBe(null)
  })

  it('should filter tree by search query', () => {
    const store = useFileTreeStore()
    store.tree = [
      { name: 'test.md', path: '/test.md', type: 'file' },
      { name: 'readme.md', path: '/readme.md', type: 'file' },
      { name: 'data.txt', path: '/data.txt', type: 'file' }
    ]
    
    store.setSearchQuery('test')
    expect(store.filteredTree).toHaveLength(1)
    expect(store.filteredTree[0].name).toBe('test.md')
    
    store.setSearchQuery('')
    expect(store.filteredTree).toHaveLength(3)
  })

  it('should find node by path', () => {
    const store = useFileTreeStore()
    const node = { name: 'test.md', path: '/test.md', type: 'file' as const }
    store.tree = [node]
    
    const found = store.findNodeByPath('/test.md')
    expect(found).toBe(node)
    
    const notFound = store.findNodeByPath('/nonexistent')
    expect(notFound).toBe(null)
  })

  it('should mark nodes as modified', () => {
    const store = useFileTreeStore()
    const node = { name: 'test.md', path: '/test.md', type: 'file' as const }
    store.tree = [node]
    
    store.setNodeModified('/test.md', true)
    expect(store.tree[0].name).toBe('test.md •')
    
    store.setNodeModified('/test.md', false)
    expect(store.tree[0].name).toBe('test.md')
  })

  it('should clear tree on disconnect', () => {
    const store = useFileTreeStore()
    store.tree = [{ name: 'test.md', path: '/test.md', type: 'file' }]
    store.selectedNode = { name: 'test.md', path: '/test.md', type: 'file' }
    store.expandedPaths.add('/folder')
    store.searchQuery = 'test'
    store.error = 'Some error'
    
    store.clearTree()
    
    expect(store.tree).toEqual([])
    expect(store.selectedNode).toBe(null)
    expect(store.expandedPaths.size).toBe(0)
    expect(store.searchQuery).toBe('')
    expect(store.error).toBe(null)
  })

  it('should sort tree with directories first', () => {
    const store = useFileTreeStore()
    store.tree = [
      { name: 'file2.md', path: '/file2.md', type: 'file' },
      { name: 'folder2', path: '/folder2', type: 'directory' },
      { name: 'file1.md', path: '/file1.md', type: 'file' },
      { name: 'folder1', path: '/folder1', type: 'directory' }
    ]
    
    const sorted = store.sortedTree
    expect(sorted[0].name).toBe('folder1')
    expect(sorted[1].name).toBe('folder2')
    expect(sorted[2].name).toBe('file1.md')
    expect(sorted[3].name).toBe('file2.md')
  })
})