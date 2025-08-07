/**
 * File Tree Types
 */

export interface TreeNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children?: TreeNode[]
  expanded?: boolean
  selected?: boolean
  loading?: boolean
  icon?: string
  metadata?: {
    size?: number
    modified?: Date
    permissions?: string
  }
}

export interface FileTreeState {
  tree: TreeNode[]
  selectedNode: TreeNode | null
  expandedPaths: Set<string>
  searchQuery: string
  loading: boolean
  error: string | null
}

export interface FileTreeFilter {
  searchQuery?: string
  fileExtensions?: string[]
  showHidden?: boolean
}