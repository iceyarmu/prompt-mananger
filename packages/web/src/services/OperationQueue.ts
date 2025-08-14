import { createLogger } from '../utils/logger'

const logger = createLogger('OperationQueue')

export interface QueuedOperation {
  id: string
  type: 'create' | 'delete' | 'move' | 'copy' | 'rename'
  source?: string
  target?: string
  content?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error?: Error
  retryCount: number
  maxRetries: number
  timestamp: number
}

export interface OperationQueueOptions {
  maxConcurrent?: number
  maxRetries?: number
  retryDelay?: number
}

export type OperationExecutor = (operation: QueuedOperation) => Promise<void>

export class OperationQueue {
  private queue: QueuedOperation[] = []
  private processing = false
  private currentOperation: QueuedOperation | null = null
  private abortController: AbortController | null = null
  private maxConcurrent: number
  private maxRetries: number
  private retryDelay: number
  private executor: OperationExecutor
  private listeners: Map<string, (operation: QueuedOperation) => void> = new Map()
  
  constructor(executor: OperationExecutor, options: OperationQueueOptions = {}) {
    this.executor = executor
    this.maxConcurrent = options.maxConcurrent || 1
    this.maxRetries = options.maxRetries || 3
    this.retryDelay = options.retryDelay || 1000
  }
  
  /**
   * Add operation to queue
   */
  enqueue(operation: Omit<QueuedOperation, 'id' | 'status' | 'retryCount' | 'timestamp'>): string {
    const id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      status: 'pending',
      retryCount: 0,
      timestamp: Date.now()
    }
    
    this.queue.push(queuedOp)
    logger.info('Operation enqueued', { id, type: operation.type })
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }
    
    return id
  }
  
  /**
   * Process operations in queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      // Get next pending operation
      const operation = this.queue.find(op => op.status === 'pending')
      if (!operation) break
      
      this.currentOperation = operation
      operation.status = 'processing'
      this.notifyListeners(operation)
      
      try {
        // Create abort controller for cancellation
        this.abortController = new AbortController()
        
        // Execute operation with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), 30000)
        })
        
        await Promise.race([
          this.executor(operation),
          timeoutPromise
        ])
        
        operation.status = 'completed'
        logger.info('Operation completed', { id: operation.id })
      } catch (error) {
        operation.error = error as Error
        operation.retryCount++
        
        if (operation.retryCount < this.maxRetries) {
          // Retry after delay
          operation.status = 'pending'
          logger.warn('Operation failed, retrying', { 
            id: operation.id, 
            attempt: operation.retryCount,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          
          await this.delay(this.retryDelay * operation.retryCount)
        } else {
          operation.status = 'failed'
          logger.error('Operation failed after max retries', { 
            id: operation.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } finally {
        this.notifyListeners(operation)
        this.currentOperation = null
        this.abortController = null
      }
      
      // Remove completed or failed operations
      if (operation.status === 'completed' || operation.status === 'failed') {
        const index = this.queue.indexOf(operation)
        if (index !== -1) {
          this.queue.splice(index, 1)
        }
      }
    }
    
    this.processing = false
  }
  
  /**
   * Cancel a specific operation
   */
  cancel(operationId: string): boolean {
    const operation = this.queue.find(op => op.id === operationId)
    if (!operation) return false
    
    if (operation.status === 'pending') {
      operation.status = 'cancelled'
      const index = this.queue.indexOf(operation)
      if (index !== -1) {
        this.queue.splice(index, 1)
      }
      this.notifyListeners(operation)
      logger.info('Operation cancelled', { id: operationId })
      return true
    }
    
    if (operation.status === 'processing' && this.abortController) {
      this.abortController.abort()
      operation.status = 'cancelled'
      this.notifyListeners(operation)
      logger.info('Processing operation cancelled', { id: operationId })
      return true
    }
    
    return false
  }
  
  /**
   * Cancel all pending operations
   */
  cancelAll(): number {
    let cancelledCount = 0
    
    // Cancel current operation if processing
    if (this.currentOperation && this.abortController) {
      this.abortController.abort()
      this.currentOperation.status = 'cancelled'
      this.notifyListeners(this.currentOperation)
      cancelledCount++
    }
    
    // Cancel all pending operations
    this.queue.forEach(operation => {
      if (operation.status === 'pending') {
        operation.status = 'cancelled'
        this.notifyListeners(operation)
        cancelledCount++
      }
    })
    
    // Clear the queue
    this.queue = this.queue.filter(op => op.status !== 'cancelled')
    
    logger.info('All operations cancelled', { count: cancelledCount })
    return cancelledCount
  }
  
  /**
   * Get queue status
   */
  getStatus(): {
    pending: number
    processing: number
    completed: number
    failed: number
    total: number
    currentOperation: QueuedOperation | null
  } {
    const pending = this.queue.filter(op => op.status === 'pending').length
    const processing = this.queue.filter(op => op.status === 'processing').length
    const completed = this.queue.filter(op => op.status === 'completed').length
    const failed = this.queue.filter(op => op.status === 'failed').length
    
    return {
      pending,
      processing,
      completed,
      failed,
      total: this.queue.length,
      currentOperation: this.currentOperation
    }
  }
  
  /**
   * Get specific operation
   */
  getOperation(operationId: string): QueuedOperation | undefined {
    return this.queue.find(op => op.id === operationId)
  }
  
  /**
   * Subscribe to operation updates
   */
  subscribe(listener: (operation: QueuedOperation) => void): () => void {
    const id = `listener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.listeners.set(id, listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(id)
    }
  }
  
  /**
   * Notify listeners of operation changes
   */
  private notifyListeners(operation: QueuedOperation): void {
    this.listeners.forEach(listener => {
      try {
        listener(operation)
      } catch (error) {
        logger.error('Listener error', { error })
      }
    })
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Clear completed operations
   */
  clearCompleted(): number {
    const beforeCount = this.queue.length
    this.queue = this.queue.filter(op => 
      op.status !== 'completed' && op.status !== 'failed' && op.status !== 'cancelled'
    )
    const removed = beforeCount - this.queue.length
    logger.info('Cleared completed operations', { removed })
    return removed
  }
  
  /**
   * Get all operations
   */
  getAllOperations(): QueuedOperation[] {
    return [...this.queue]
  }
}