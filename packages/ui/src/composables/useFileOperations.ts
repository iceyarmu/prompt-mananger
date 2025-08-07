import { ref, Ref } from 'vue'
import { useToast } from './useToast'
import { useFileTreeStore } from './useFileTreeStore'
import type { AppServices } from '../types/services'

export interface FileOperationsHandler {
  createFile: (parentPath: string, name: string) => Promise<void>
  createFolder: (parentPath: string, name: string) => Promise<void>
  renameItem: (oldPath: string, newName: string) => Promise<void>
  deleteItem: (path: string) => Promise<void>
  copyPath: (path: string) => Promise<void>
}

export interface UndoableOperation {
  id: string
  type: 'delete'
  path: string
  content?: string
  isFolder: boolean
  timestamp: number
}

const undoableOperations = ref<Map<string, UndoableOperation>>(new Map())
const undoTimers = new Map<string, NodeJS.Timeout>()

export function useFileOperations(services: Ref<AppServices | null>) {
  const { success, error, warning } = useToast()
  const fileTreeStore = useFileTreeStore()
  
  const loading = ref(false)

  const createFile = async (parentPath: string, name: string): Promise<void> => {
    if (!services.value) {
      error('Services not available')
      throw new Error('Services not available')
    }

    loading.value = true
    try {
      // Ensure .md extension
      const fileName = name.endsWith('.md') ? name : `${name}.md`
      const fullPath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`
      
      // Create file with initial content
      await services.value.webdavService.putFile({
        path: fullPath,
        content: `# ${name.replace('.md', '')}\n\n`
      })
      
      // Refresh tree
      await fileTreeStore.refreshNode(parentPath)
      
      success(`File "${fileName}" created successfully`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create file'
      error(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createFolder = async (parentPath: string, name: string): Promise<void> => {
    if (!services.value) {
      error('Services not available')
      throw new Error('Services not available')
    }

    loading.value = true
    try {
      const fullPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`
      
      await services.value.webdavService.createFolder(fullPath, true)
      
      // Refresh tree
      await fileTreeStore.refreshNode(parentPath)
      
      success(`Folder "${name}" created successfully`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create folder'
      error(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  const renameItem = async (oldPath: string, newName: string): Promise<void> => {
    if (!services.value) {
      error('Services not available')
      throw new Error('Services not available')
    }

    loading.value = true
    try {
      // Construct new path
      const pathParts = oldPath.split('/')
      pathParts[pathParts.length - 1] = newName
      const newPath = pathParts.join('/')
      
      // Check if it's a file and ensure .md extension
      const isFile = oldPath.endsWith('.md')
      const finalNewPath = isFile && !newName.endsWith('.md') 
        ? `${newPath}.md` 
        : newPath
      
      await services.value.webdavService.moveFile(oldPath, finalNewPath)
      
      // Refresh parent folder
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/'
      await fileTreeStore.refreshNode(parentPath)
      
      success(`Renamed to "${newName}" successfully`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename item'
      error(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteItem = async (path: string): Promise<void> => {
    if (!services.value) {
      error('Services not available')
      throw new Error('Services not available')
    }

    loading.value = true
    try {
      // Check if it's a folder
      const items = await services.value.webdavService.listFolder(path.substring(0, path.lastIndexOf('/')) || '/')
      const item = items.find(i => i.path === path)
      const isFolder = item?.type === 'directory'
      
      // Save content for undo (only for files)
      let content: string | undefined
      if (!isFolder) {
        try {
          const fileContent = await services.value.webdavService.getFile(path)
          content = fileContent.content
        } catch {
          // Ignore if we can't get content
        }
      }
      
      // Delete the item
      if (isFolder) {
        await services.value.webdavService.deleteFolder(path)
      } else {
        await services.value.webdavService.deleteFile(path)
      }
      
      // Save undo operation with unique ID
      const undoOp: UndoableOperation = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'delete',
        path,
        content,
        isFolder,
        timestamp: Date.now()
      }
      undoableOperations.value.set(undoOp.id, undoOp)
      
      // Refresh parent folder
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
      await fileTreeStore.refreshNode(parentPath)
      
      // Show undo notification
      const itemName = path.split('/').pop()
      warning(`Deleted "${itemName}"`, 5000)
      
      // Clear any existing timer for this operation
      if (undoTimers.has(undoOp.id)) {
        clearTimeout(undoTimers.get(undoOp.id))
      }
      
      // Auto-remove undo operation after 5 seconds
      const timer = setTimeout(() => {
        undoableOperations.value.delete(undoOp.id)
        undoTimers.delete(undoOp.id)
      }, 5000)
      undoTimers.set(undoOp.id, timer)
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete item'
      error(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  const restoreItem = async (undoId: string): Promise<void> => {
    const undoOp = undoableOperations.value.get(undoId)
    if (!undoOp || !services.value) return
    
    loading.value = true
    try {
      if (undoOp.isFolder) {
        await services.value.webdavService.createFolder(undoOp.path, true)
      } else if (undoOp.content !== undefined) {
        await services.value.webdavService.putFile({
          path: undoOp.path,
          content: undoOp.content
        })
      }
      
      // Refresh parent folder
      const parentPath = undoOp.path.substring(0, undoOp.path.lastIndexOf('/')) || '/'
      await fileTreeStore.refreshNode(parentPath)
      
      const itemName = undoOp.path.split('/').pop()
      success(`Restored "${itemName}"`)
      
      // Clear timer if exists
      if (undoTimers.has(undoId)) {
        clearTimeout(undoTimers.get(undoId))
        undoTimers.delete(undoId)
      }
      
      // Remove from undo operations
      undoableOperations.value.delete(undoId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore item'
      error(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path)
      success('Path copied to clipboard')
    } catch (err) {
      error('Failed to copy path')
      throw err
    }
  }

  return {
    loading,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
    restoreItem,
    copyPath,
    undoableOperations
  }
}