import { createLogger } from '../utils/logger'
import type { FileOperationsService } from './FileOperationsService'

const logger = createLogger('UndoRedoManager')

export interface UndoableAction {
  id: string
  type: 'create' | 'delete' | 'move' | 'copy' | 'rename' | 'edit'
  timestamp: number
  description: string
  undo: () => Promise<void>
  redo: () => Promise<void>
  data: {
    source?: string
    target?: string
    content?: string
    previousContent?: string
  }
}

export class UndoRedoManager {
  private undoStack: UndoableAction[] = []
  private redoStack: UndoableAction[] = []
  private maxHistorySize: number
  private fileOps: FileOperationsService
  private listeners: Set<() => void> = new Set()
  
  constructor(fileOps: FileOperationsService, maxHistorySize: number = 50) {
    this.fileOps = fileOps
    this.maxHistorySize = maxHistorySize
  }
  
  /**
   * Add action to undo stack
   */
  addAction(action: Omit<UndoableAction, 'id' | 'timestamp'>): void {
    const fullAction: UndoableAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    this.undoStack.push(fullAction)
    this.redoStack = [] // Clear redo stack when new action is added
    
    // Limit stack size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }
    
    logger.info('Action added to undo stack', { 
      id: fullAction.id, 
      type: fullAction.type,
      description: fullAction.description
    })
    
    this.notifyListeners()
  }
  
  /**
   * Record a file creation action
   */
  recordCreate(path: string, content: string): void {
    this.addAction({
      type: 'create',
      description: `Create ${path}`,
      data: { target: path, content },
      undo: async () => {
        await this.fileOps.delete(path)
        logger.info('Undid file creation', { path })
      },
      redo: async () => {
        await this.fileOps.createFile(path, content)
        logger.info('Redid file creation', { path })
      }
    })
  }
  
  /**
   * Record a file deletion action
   */
  recordDelete(path: string, content: string): void {
    this.addAction({
      type: 'delete',
      description: `Delete ${path}`,
      data: { source: path, content },
      undo: async () => {
        await this.fileOps.createFile(path, content)
        logger.info('Undid file deletion', { path })
      },
      redo: async () => {
        await this.fileOps.delete(path)
        logger.info('Redid file deletion', { path })
      }
    })
  }
  
  /**
   * Record a file move action
   */
  recordMove(sourcePath: string, targetPath: string): void {
    this.addAction({
      type: 'move',
      description: `Move ${sourcePath} to ${targetPath}`,
      data: { source: sourcePath, target: targetPath },
      undo: async () => {
        await this.fileOps.move(targetPath, sourcePath)
        logger.info('Undid file move', { from: targetPath, to: sourcePath })
      },
      redo: async () => {
        await this.fileOps.move(sourcePath, targetPath)
        logger.info('Redid file move', { from: sourcePath, to: targetPath })
      }
    })
  }
  
  /**
   * Record a file copy action
   */
  recordCopy(sourcePath: string, targetPath: string): void {
    this.addAction({
      type: 'copy',
      description: `Copy ${sourcePath} to ${targetPath}`,
      data: { source: sourcePath, target: targetPath },
      undo: async () => {
        await this.fileOps.delete(targetPath)
        logger.info('Undid file copy', { deleted: targetPath })
      },
      redo: async () => {
        await this.fileOps.copy(sourcePath, targetPath)
        logger.info('Redid file copy', { from: sourcePath, to: targetPath })
      }
    })
  }
  
  /**
   * Record a file rename action
   */
  recordRename(oldPath: string, newPath: string): void {
    this.addAction({
      type: 'rename',
      description: `Rename ${oldPath} to ${newPath}`,
      data: { source: oldPath, target: newPath },
      undo: async () => {
        await this.fileOps.rename(newPath, oldPath)
        logger.info('Undid file rename', { from: newPath, to: oldPath })
      },
      redo: async () => {
        await this.fileOps.rename(oldPath, newPath)
        logger.info('Redid file rename', { from: oldPath, to: newPath })
      }
    })
  }
  
  /**
   * Record a file edit action
   */
  recordEdit(path: string, previousContent: string, newContent: string): void {
    this.addAction({
      type: 'edit',
      description: `Edit ${path}`,
      data: { target: path, previousContent, content: newContent },
      undo: async () => {
        await this.fileOps.write(path, previousContent)
        logger.info('Undid file edit', { path })
      },
      redo: async () => {
        await this.fileOps.write(path, newContent)
        logger.info('Redid file edit', { path })
      }
    })
  }
  
  /**
   * Undo last action
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      logger.warn('No actions to undo')
      return false
    }
    
    const action = this.undoStack.pop()!
    
    try {
      await action.undo()
      this.redoStack.push(action)
      logger.info('Action undone', { id: action.id, description: action.description })
      this.notifyListeners()
      return true
    } catch (error) {
      logger.error('Failed to undo action', { 
        id: action.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Put action back on stack if undo failed
      this.undoStack.push(action)
      return false
    }
  }
  
  /**
   * Redo last undone action
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      logger.warn('No actions to redo')
      return false
    }
    
    const action = this.redoStack.pop()!
    
    try {
      await action.redo()
      this.undoStack.push(action)
      logger.info('Action redone', { id: action.id, description: action.description })
      this.notifyListeners()
      return true
    } catch (error) {
      logger.error('Failed to redo action', { 
        id: action.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Put action back on stack if redo failed
      this.redoStack.push(action)
      return false
    }
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }
  
  /**
   * Get undo history
   */
  getUndoHistory(): Array<{ id: string; type: string; description: string; timestamp: number }> {
    return this.undoStack.map(action => ({
      id: action.id,
      type: action.type,
      description: action.description,
      timestamp: action.timestamp
    }))
  }
  
  /**
   * Get redo history
   */
  getRedoHistory(): Array<{ id: string; type: string; description: string; timestamp: number }> {
    return this.redoStack.map(action => ({
      id: action.id,
      type: action.type,
      description: action.description,
      timestamp: action.timestamp
    }))
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    logger.info('Undo/redo history cleared')
    this.notifyListeners()
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  
  /**
   * Notify listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener()
      } catch (error) {
        logger.error('Listener error', { error })
      }
    })
  }
  
  /**
   * Get current state
   */
  getState(): {
    canUndo: boolean
    canRedo: boolean
    undoCount: number
    redoCount: number
    lastUndo?: string
    lastRedo?: string
  } {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastUndo: this.undoStack[this.undoStack.length - 1]?.description,
      lastRedo: this.redoStack[this.redoStack.length - 1]?.description
    }
  }
}