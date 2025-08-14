import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ExecutionResult {
  id: string
  command: string
  output: string
  error?: string
  timestamp: number
  status: 'pending' | 'running' | 'completed' | 'error'
  duration?: number
}

export interface StreamUpdate {
  id: string
  chunk: string
  type: 'stdout' | 'stderr'
  timestamp: number
}

export const useExecutionStore = defineStore('execution', () => {
  const currentExecutionId = ref<string | null>(null)
  const currentCommand = ref('')
  const currentOutput = ref('')
  const streamBuffer = ref<string[]>([])
  const status = ref<'idle' | 'executing' | 'completed' | 'error'>('idle')
  const error = ref<string | null>(null)
  const history = ref<ExecutionResult[]>([])
  const isStreaming = ref(false)
  
  const isExecuting = computed(() => status.value === 'executing')
  const hasOutput = computed(() => currentOutput.value !== '')
  const hasHistory = computed(() => history.value.length > 0)
  
  const sortedHistory = computed(() => 
    [...history.value].sort((a, b) => b.timestamp - a.timestamp)
  )
  
  const recentHistory = computed(() => 
    sortedHistory.value.slice(0, 10)
  )
  
  async function execute(
    command: string,
    executionService?: any
  ): Promise<string | null> {
    if (!executionService) {
      setError('Execution service not available')
      return null
    }
    
    currentExecutionId.value = crypto.randomUUID()
    currentCommand.value = command
    currentOutput.value = ''
    streamBuffer.value = []
    status.value = 'executing'
    error.value = null
    isStreaming.value = true
    
    const startTime = Date.now()
    
    try {
      // Execute command with streaming support
      const result = await executionService.execute(command, {
        onStream: (chunk: string) => {
          appendStreamChunk(chunk)
        }
      })
      
      currentOutput.value = result
      status.value = 'completed'
      isStreaming.value = false
      
      const duration = Date.now() - startTime
      
      addToHistory({
        id: currentExecutionId.value,
        command,
        output: result,
        timestamp: Date.now(),
        status: 'completed',
        duration
      })
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed'
      setError(errorMessage)
      status.value = 'error'
      isStreaming.value = false
      
      addToHistory({
        id: currentExecutionId.value,
        command,
        output: currentOutput.value,
        error: errorMessage,
        timestamp: Date.now(),
        status: 'error',
        duration: Date.now() - startTime
      })
      
      console.error('Execution failed:', err)
      return null
    }
  }
  
  function appendStreamChunk(chunk: string) {
    streamBuffer.value.push(chunk)
    currentOutput.value = streamBuffer.value.join('')
    
    // Emit stream update event
    const { storeBus } = window as any
    if (storeBus) {
      storeBus.emit('execution', 'stream-update', {
        id: currentExecutionId.value,
        chunk,
        type: 'stdout',
        timestamp: Date.now()
      })
    }
  }
  
  function addToHistory(result: ExecutionResult) {
    history.value.push(result)
    
    // Limit history size
    if (history.value.length > 100) {
      history.value.shift()
    }
    
    saveHistoryToStorage()
  }
  
  function removeFromHistory(id: string) {
    const index = history.value.findIndex(item => item.id === id)
    if (index !== -1) {
      history.value.splice(index, 1)
      saveHistoryToStorage()
    }
  }
  
  function clearHistory() {
    history.value = []
    localStorage.removeItem('execution:history')
  }
  
  function saveHistoryToStorage() {
    try {
      localStorage.setItem('execution:history', JSON.stringify(history.value))
    } catch (err) {
      console.error('Failed to save execution history:', err)
    }
  }
  
  function loadHistoryFromStorage() {
    try {
      const stored = localStorage.getItem('execution:history')
      if (stored) {
        history.value = JSON.parse(stored)
      }
    } catch (err) {
      console.error('Failed to load execution history:', err)
    }
  }
  
  function stopExecution() {
    if (isExecuting.value) {
      status.value = 'completed'
      isStreaming.value = false
      
      // Add partial result to history
      if (currentExecutionId.value && currentCommand.value) {
        addToHistory({
          id: currentExecutionId.value,
          command: currentCommand.value,
          output: currentOutput.value,
          timestamp: Date.now(),
          status: 'completed'
        })
      }
    }
  }
  
  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }
  
  function clearError() {
    error.value = null
  }
  
  function reset() {
    currentExecutionId.value = null
    currentCommand.value = ''
    currentOutput.value = ''
    streamBuffer.value = []
    status.value = 'idle'
    error.value = null
    isStreaming.value = false
  }
  
  function copyOutput() {
    if (currentOutput.value) {
      navigator.clipboard.writeText(currentOutput.value)
      return true
    }
    return false
  }
  
  function exportOutput(format: 'text' | 'json' = 'text') {
    if (!currentOutput.value) return null
    
    if (format === 'json') {
      return JSON.stringify({
        command: currentCommand.value,
        output: currentOutput.value,
        timestamp: Date.now(),
        status: status.value
      }, null, 2)
    }
    
    return currentOutput.value
  }
  
  function initialize() {
    loadHistoryFromStorage()
  }
  
  return {
    currentExecutionId,
    currentCommand,
    currentOutput,
    streamBuffer,
    status,
    error,
    history,
    isStreaming,
    isExecuting,
    hasOutput,
    hasHistory,
    sortedHistory,
    recentHistory,
    execute,
    appendStreamChunk,
    addToHistory,
    removeFromHistory,
    clearHistory,
    stopExecution,
    setError,
    clearError,
    reset,
    copyOutput,
    exportOutput,
    initialize
  }
})