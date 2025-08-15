<template>
  <AppLayout>
    <!-- Navigation Header -->
    <template #header>
      <div class="app-header">
        <BreadcrumbNav 
          :path="currentPath"
          @navigate="handleBreadcrumbNavigate"
        />
        <div class="header-actions">
          <ConnectionStatus 
            :state="connectionState"
            :message="connectionMessage"
            @reconnect="handleReconnect"
          />
          <button @click="toggleSettings" class="settings-btn" aria-label="Settings">
            ⚙️
          </button>
          <ThemeToggleUI />
        </div>
      </div>
    </template>

    <!-- Left Panel - File Tree -->
    <template #left-header>
      <span class="panel-title">Files</span>
    </template>
    <template #left>
      <FileTree 
        v-if="fileTreeData"
        :data="fileTreeData" 
        @select="handleFileSelect"
      />
      <div v-else class="panel-placeholder">
        <p>No files available</p>
      </div>
    </template>

    <!-- Center Panel - Markdown Editor -->
    <template #center-header>
      <span class="panel-title">{{ currentFileName || 'Editor' }}</span>
    </template>
    <template #center>
      <MarkdownEditor 
        v-model="editorContent"
        :placeholder="'Start writing...'"
        @change="handleEditorChange"
      />
    </template>

    <!-- Right Panel - Results -->
    <template #right-header>
      <div class="flex items-center justify-between w-full">
        <span class="panel-title">Results</span>
        <div class="flex space-x-2">
          <button 
            @click="handleOptimize"
            :disabled="!editorContent || optimizationStore.isProcessing"
            class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ optimizationStore.isProcessing ? 'Optimizing...' : 'Optimize' }}
          </button>
          <button 
            @click="handleExecute"
            :disabled="!editorContent || executionInProgress"
            class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ executionInProgress ? 'Executing...' : 'Execute' }}
          </button>
        </div>
      </div>
    </template>
    <template #right>
      <div class="results-panel">
        <!-- Task 3.3: Display optimization progress/loading state -->
        <div v-if="optimizationStore.isProcessing" class="results-content">
          <h3>Optimizing...</h3>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${optimizationStore.progress}%` }"></div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Processing your optimization request...
          </p>
        </div>
        <!-- Task 3.4: Show optimization results when completed -->
        <div v-else-if="optimizationStore.hasResult" class="results-content">
          <h3>Optimization Results</h3>
          <pre class="whitespace-pre-wrap">{{ optimizationStore.currentResult }}</pre>
          <div class="mt-4 flex space-x-2">
            <button 
              @click="applyOptimizationResult"
              class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Apply to Editor
            </button>
            <button 
              @click="copyOptimizationResult"
              class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Copy
            </button>
          </div>
        </div>
        <!-- Task 3.5: Handle optimization errors appropriately -->
        <div v-else-if="optimizationStore.error" class="results-content">
          <h3 class="text-red-600 dark:text-red-400">Optimization Error</h3>
          <p class="text-red-600 dark:text-red-400">{{ optimizationStore.error }}</p>
          <button 
            @click="optimizationStore.clearError()"
            class="mt-4 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        <!-- Task 4.3: Display streaming execution results -->
        <div v-else-if="executionStore.isExecuting" class="results-content">
          <h3>Executing...</h3>
          <pre class="whitespace-pre-wrap animate-pulse">{{ executionStore.currentOutput || 'Starting execution...' }}</pre>
          <button 
            @click="executionStore.stopExecution()"
            class="mt-4 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Stop Execution
          </button>
        </div>
        <!-- Task 4.4: Handle execution completion -->
        <div v-else-if="executionStore.hasOutput" class="results-content">
          <h3>Execution Results</h3>
          <pre class="whitespace-pre-wrap">{{ executionStore.currentOutput }}</pre>
          <!-- Task 4.5: Enable result copy/export functionality -->
          <div class="mt-4 flex space-x-2">
            <button 
              @click="copyExecutionResult"
              class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Copy Output
            </button>
            <button 
              @click="exportExecutionResult"
              class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Export
            </button>
            <button 
              @click="executionStore.reset()"
              class="px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Clear
            </button>
          </div>
        </div>
        <!-- Execution error display -->
        <div v-else-if="executionStore.error" class="results-content">
          <h3 class="text-red-600 dark:text-red-400">Execution Error</h3>
          <p class="text-red-600 dark:text-red-400">{{ executionStore.error }}</p>
          <button 
            @click="executionStore.clearError()"
            class="mt-4 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        <div v-else class="panel-placeholder">
          <p>Results will appear here</p>
        </div>
      </div>
    </template>
  </AppLayout>
  
  <!-- Task 6: Loading Overlay -->
  <div 
    v-if="appStore.blockedInteraction" 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p class="text-gray-700 dark:text-gray-300">{{ appStore.loadingMessage }}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {{ appStore.activeOperationsCount }} operation(s) in progress
      </p>
    </div>
  </div>
  
  <!-- Unsaved Changes Warning Dialog -->
  <div v-if="showUnsavedWarning" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
      <h3 class="text-lg font-semibold mb-4">Unsaved Changes</h3>
      <p class="mb-6 text-gray-600 dark:text-gray-300">
        You have unsaved changes. Do you want to discard them and open the new file?
      </p>
      <div class="flex justify-end space-x-3">
        <button 
          @click="handleUnsavedConfirm(false)" 
          class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          Cancel
        </button>
        <button 
          @click="handleUnsavedConfirm(true)" 
          class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded"
        >
          Discard Changes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppLayout from './components/AppLayout.vue'
import { BreadcrumbNav, ConnectionStatus, type BreadcrumbItem, type ConnectionState } from './components/navigation'
import { 
  FileTreeUI as FileTree, 
  MarkdownEditorUI as MarkdownEditor,
  ThemeToggleUI,
  ToastUI as Toast
} from '@prompt-optimizer/ui'
import { useFileTreeStore } from './stores/fileTree'
import { useEditorStore } from './stores/editor'
import { useOptimizationStore } from './stores/optimization'
import { useExecutionStore } from './stores/execution'
import { useAppStore } from './stores/app'
import { useWebDAVStore } from './stores/webdav'
import { usePreferenceStore } from './stores/preferences'
import { useStoreCommunication } from './stores/communication'
// import { ServiceRegistry } from './services/ServiceRegistry'
import { useKeyboardShortcuts } from './utils/KeyboardShortcuts'

// Stores
const fileTreeStore = useFileTreeStore()
const editorStore = useEditorStore()
const optimizationStore = useOptimizationStore()
const executionStore = useExecutionStore()
const appStore = useAppStore()
const webdavStore = useWebDAVStore()
const preferenceStore = usePreferenceStore()
const { subscribe, emit, cleanup } = useStoreCommunication()

// Services
// TODO: Fix ServiceRegistry implementation
const services = {
  getService: (name: string) => {
    // Mock service implementation
    console.warn(`Service ${name} requested but not implemented`)
    return null
  }
}

// Keyboard shortcuts
const { register, setContext } = useKeyboardShortcuts()

// State
const currentPath = ref('/')
const currentFileName = ref('')
const editorContent = ref('')
const fileTreeData = ref(null)
const optimizationResults = ref(null)
const executionResults = ref(null)
const executionInProgress = ref(false)
const connectionState = ref<ConnectionState>('connected')
const connectionMessage = ref('')
const showUnsavedWarning = ref(false)
const pendingFile = ref<any>(null)

// Task 1: Watch for file selection changes in fileTreeStore
watch(() => fileTreeStore.selectedNode, async (newNode) => {
  if (newNode && newNode.type === 'file') {
    // Task 1.3: Handle unsaved changes warning before loading new file
    if (editorStore.hasUnsavedChanges && editorStore.currentFile) {
      pendingFile.value = newNode
      showUnsavedWarning.value = true
      emit('editor', 'unsaved-changes-warning', {
        currentFile: editorStore.currentFile,
        newFile: newNode
      })
      return
    }
    
    // Task 1.2: Implement editorService.loadFile() call when file is selected
    await loadFileIntoEditor(newNode)
  } else if (!newNode) {
    // Task 1.5: Clear editor when no file is selected
    editorStore.clearEditor()
    currentFileName.value = ''
    editorContent.value = ''
  }
})

// Task 1.2, 1.4: Load file into editor
async function loadFileIntoEditor(file: any) {
  const loadingId = `load-file-${file.path}`
  try {
    // Task 6.2: Add loading indicator for file loading
    appStore.startLoading(loadingId, `Loading ${file.name}...`)
    
    const editorService = await services.getService('editor')
    if (editorService) {
      await editorService.loadFile(file.path)
      const state = editorService.getState()
      
      // Task 1.4: Ensure editor updates with file content
      if (state) {
        editorContent.value = state.content || ''
        currentFileName.value = file.name
        currentPath.value = file.path
      } else {
        throw new Error('Failed to get editor state after loading file')
      }
      
      // Update editor store
      await editorStore.loadFile(file, services.getService('fileOps'))
      
      emit('filetree', 'file-loaded', { file })
    }
  } catch (error) {
    console.error('Failed to load file:', error)
    emit('*', 'error', { 
      message: `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

// Handle unsaved changes confirmation
async function handleUnsavedConfirm(confirm: boolean) {
  showUnsavedWarning.value = false
  
  if (confirm && pendingFile.value) {
    // Discard changes and load new file
    await loadFileIntoEditor(pendingFile.value)
    pendingFile.value = null
  } else {
    // Cancel file selection
    pendingFile.value = null
    // Restore previous selection
    if (editorStore.currentFile) {
      fileTreeStore.selectNode(fileTreeStore.findNodeByPath(editorStore.currentFile.path))
    }
  }
}

// Watch editor content changes
watch(editorContent, (newContent) => {
  editorStore.setContent(newContent)
  handleEditorChange(newContent)
})

// Methods
const toggleSettings = () => {
  console.log('Settings clicked')
}

const handleFileSelect = (file: any) => {
  fileTreeStore.selectNode(file)
}

const handleEditorChange = (content: string) => {
  // Update editor service
  const editorService = services.getService('editor')
  if (editorService) {
    editorService.updateContent(content)
  }
}

const handleBreadcrumbNavigate = (item: BreadcrumbItem) => {
  currentPath.value = item.path
  console.log('Navigate to:', item)
}

const handleReconnect = () => {
  console.log('Reconnecting...')
  connectionState.value = 'connecting'
  connectionMessage.value = 'Reconnecting...'
  
  // Simulate reconnection
  setTimeout(() => {
    connectionState.value = 'connected'
    connectionMessage.value = ''
  }, 2000)
}

// Task 3: Optimization handlers
async function handleOptimize() {
  // Task 3.1: Wire optimization button click to optimizationStore.optimize()
  if (!editorContent.value) return
  
  const loadingId = 'optimization'
  try {
    // Task 6.4: Mark as critical for optimization
    appStore.startLoading(loadingId, 'Optimizing content...', true)
    emit('optimization', 'started', { content: editorContent.value })
    
    const config = {
      model: 'gpt-4',
      template: 'default',
      temperature: 0.7,
      maxTokens: 2000
    }
    
    const promptService = await services.getService('prompt')
    await optimizationStore.optimize(editorContent.value, config, promptService)
    
    // Task 3.2: Subscribe to optimization status changes is handled by the store watcher
  } catch (error) {
    console.error('Optimization failed:', error)
    emit('*', 'error', { 
      message: `Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

function applyOptimizationResult() {
  if (optimizationStore.currentResult) {
    editorContent.value = optimizationStore.currentResult
    editorStore.setContent(optimizationStore.currentResult)
    emit('optimization', 'applied', { 
      result: optimizationStore.currentResult 
    })
  }
}

function copyOptimizationResult() {
  if (optimizationStore.currentResult) {
    navigator.clipboard.writeText(optimizationStore.currentResult).then(() => {
      emit('notification', 'info', { message: 'Result copied to clipboard' })
    }).catch(err => {
      console.error('Failed to copy:', err)
      emit('*', 'error', { message: 'Failed to copy to clipboard' })
    })
  }
}

// Task 4: Execution handlers
async function handleExecute() {
  // Task 4.1: Connect execute button to executionService.execute()
  if (!editorContent.value) return
  
  const loadingId = 'execution'
  executionInProgress.value = true
  executionResults.value = null
  
  try {
    // Task 6.2: Add loading indicator for execution
    appStore.startLoading(loadingId, 'Executing code...')
    emit('execution', 'started', { content: editorContent.value })
    
    const executionService = await services.getService('execution')
    if (executionService) {
      // Update message during execution
      appStore.updateLoadingMessage(loadingId, 'Processing output...')
      
      // Task 4.2: Subscribe to execution stream updates
      const result = await executionStore.execute(editorContent.value, executionService)
      
      if (result) {
        // Task 4.3: Display streaming results
        executionResults.value = result
        emit('execution', 'completed', { result })
      } else if (executionStore.error) {
        // Task 4.4: Handle execution errors
        throw new Error(executionStore.error)
      }
    } else {
      throw new Error('Execution service not available')
    }
  } catch (error) {
    console.error('Execution failed:', error)
    emit('*', 'error', { 
      message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    executionInProgress.value = false
    appStore.stopLoading(loadingId)
  }
}

// Task 4.5: Copy/export execution results
function copyExecutionResult() {
  if (executionStore.copyOutput()) {
    emit('notification', 'info', { message: 'Output copied to clipboard' })
  } else {
    emit('*', 'error', { message: 'Failed to copy output' })
  }
}

function exportExecutionResult() {
  const exported = executionStore.exportOutput('text')
  if (exported) {
    // Create download link
    const blob = new Blob([exported], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `execution-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    emit('notification', 'info', { message: 'Output exported' })
  }
}

// Task 3.2: Subscribe to optimization status changes
watch(() => optimizationStore.status, (newStatus) => {
  emit('optimization', 'status-changed', { status: newStatus })
})

// Task 4.2: Subscribe to execution stream updates
watch(() => executionStore.isStreaming, (isStreaming) => {
  if (isStreaming) {
    emit('execution', 'streaming-started')
  } else {
    emit('execution', 'streaming-stopped')
  }
})

// Subscribe to stream updates
subscribe('execution', 'stream-update', (payload) => {
  if (payload?.chunk) {
    // Stream chunk received, already handled by store
    console.log('Stream update received:', payload.chunk.length, 'bytes')
  }
})

// Task 8: Context Menu Handlers
async function handleCreateFile(parentPath: string) {
  const fileName = prompt('Enter file name:')
  if (!fileName) return
  
  const loadingId = 'create-file'
  try {
    appStore.startLoading(loadingId, 'Creating file...')
    const success = await fileTreeStore.createFile(parentPath, fileName)
    
    if (success) {
      emit('fileTree', 'file-created', { parentPath, fileName })
      // Optionally open the new file
      const newPath = `${parentPath}/${fileName}`.replace(/\/+/g, '/')
      const newNode = fileTreeStore.findNodeByPath(newPath)
      if (newNode) {
        fileTreeStore.selectNode(newNode)
      }
    }
  } catch (error) {
    emit('*', 'error', { 
      message: `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

async function handleCreateFolder(parentPath: string) {
  const folderName = prompt('Enter folder name:')
  if (!folderName) return
  
  const loadingId = 'create-folder'
  try {
    appStore.startLoading(loadingId, 'Creating folder...')
    const success = await fileTreeStore.createFolder(parentPath, folderName)
    
    if (success) {
      emit('fileTree', 'folder-created', { parentPath, folderName })
    }
  } catch (error) {
    emit('*', 'error', { 
      message: `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

async function handleRenameNode(node: any) {
  const newName = prompt('Enter new name:', node.name)
  if (!newName || newName === node.name) return
  
  const loadingId = 'rename-node'
  try {
    appStore.startLoading(loadingId, 'Renaming...')
    const success = await fileTreeStore.renameNode(node.path, newName)
    
    if (success) {
      emit('fileTree', 'node-renamed', { oldPath: node.path, newName })
      
      // If renamed file is currently open in editor, update editor state
      if (editorStore.currentFile?.path === node.path) {
        const pathParts = node.path.split('/')
        pathParts[pathParts.length - 1] = newName
        const newPath = pathParts.join('/')
        
        editorStore.updateFilePath(newPath, newName)
        currentFileName.value = newName
        currentPath.value = newPath
      }
    }
  } catch (error) {
    emit('*', 'error', { 
      message: `Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

async function handleDeleteNode(node: any) {
  const confirmDelete = confirm(`Are you sure you want to delete "${node.name}"?`)
  if (!confirmDelete) return
  
  const loadingId = 'delete-node'
  try {
    appStore.startLoading(loadingId, 'Deleting...')
    const success = await fileTreeStore.deleteNode(node.path)
    
    if (success) {
      emit('fileTree', 'node-deleted', { path: node.path })
      
      // If deleted file is currently open in editor, clear editor
      if (editorStore.currentFile?.path === node.path) {
        editorStore.clearEditor()
        currentFileName.value = ''
        currentPath.value = '/'
        editorContent.value = ''
      }
    }
  } catch (error) {
    emit('*', 'error', { 
      message: `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

async function handleDuplicateNode(node: any) {
  const loadingId = 'duplicate-node'
  try {
    appStore.startLoading(loadingId, 'Duplicating...')
    const success = await fileTreeStore.duplicateNode(node.path)
    
    if (success) {
      emit('fileTree', 'node-duplicated', { originalPath: node.path })
    }
  } catch (error) {
    emit('*', 'error', { 
      message: `Failed to duplicate: ${error instanceof Error ? error.message : 'Unknown error'}` 
    })
  } finally {
    appStore.stopLoading(loadingId)
  }
}

// Task 7: Keyboard Shortcuts
async function handleSaveShortcut(event: KeyboardEvent) {
  if (editorStore.currentFile && editorStore.hasUnsavedChanges) {
    const editorService = await services.getService('editor')
    if (editorService) {
      await editorService.saveFile()
      emit('editor', 'file-saved-shortcut', { file: editorStore.currentFile })
    }
  }
}

async function handleOpenShortcut(event: KeyboardEvent) {
  // This would typically open a file picker dialog
  // For now, emit an event that could be handled by a file picker component
  emit('app', 'open-file-requested', {})
}

function handleFocusPanel1(event: KeyboardEvent) {
  // Focus file tree panel
  setContext('fileTree')
  const fileTreeElement = document.querySelector('[data-panel="left"]')
  if (fileTreeElement) {
    (fileTreeElement as HTMLElement).focus()
  }
  emit('app', 'panel-focused', { panel: 'left' })
}

function handleFocusPanel2(event: KeyboardEvent) {
  // Focus editor panel
  setContext('editor')
  const editorElement = document.querySelector('[data-panel="center"]')
  if (editorElement) {
    (editorElement as HTMLElement).focus()
  }
  emit('app', 'panel-focused', { panel: 'center' })
}

function handleFocusPanel3(event: KeyboardEvent) {
  // Focus results panel
  setContext('panel')
  const resultsElement = document.querySelector('[data-panel="right"]')
  if (resultsElement) {
    (resultsElement as HTMLElement).focus()
  }
  emit('app', 'panel-focused', { panel: 'right' })
}

function handleEscapeShortcut(event: KeyboardEvent) {
  // Close any open dialogs/modals
  if (showUnsavedWarning.value) {
    handleUnsavedConfirm(false)
  }
  // Emit escape event for other components to handle
  emit('app', 'escape-pressed', {})
}

// Lifecycle
onMounted(() => {
  // Initialize services if needed
  services.initializeAll().catch(console.error)
  
  // Initialize optimization store
  optimizationStore.initialize()
  
  // Initialize execution store
  executionStore.initialize()
  
  // Task 7.2: Register keyboard shortcuts
  register({
    id: 'save-file',
    keys: { key: 's', ctrl: true },
    description: 'Save current file',
    handler: handleSaveShortcut,
    context: 'global',
    priority: 100,
    enabled: true
  })
  
  register({
    id: 'open-file',
    keys: { key: 'o', ctrl: true },
    description: 'Open file',
    handler: handleOpenShortcut,
    context: 'global',
    priority: 100,
    enabled: true
  })
  
  // Task 7.5: Panel navigation shortcuts
  register({
    id: 'focus-panel-1',
    keys: { key: '1', ctrl: true },
    description: 'Focus File Tree panel',
    handler: handleFocusPanel1,
    context: 'global',
    priority: 90,
    enabled: true
  })
  
  register({
    id: 'focus-panel-2',
    keys: { key: '2', ctrl: true },
    description: 'Focus Editor panel',
    handler: handleFocusPanel2,
    context: 'global',
    priority: 90,
    enabled: true
  })
  
  register({
    id: 'focus-panel-3',
    keys: { key: '3', ctrl: true },
    description: 'Focus Results panel',
    handler: handleFocusPanel3,
    context: 'global',
    priority: 90,
    enabled: true
  })
  
  register({
    id: 'escape',
    keys: { key: 'Escape' },
    description: 'Cancel/Close',
    handler: handleEscapeShortcut,
    context: 'global',
    priority: 60,
    enabled: true
  })
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.app-header {
  @apply flex items-center justify-between px-4 py-2;
  height: 48px;
}

.header-actions {
  @apply flex items-center space-x-3;
}

.settings-btn {
  @apply p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors;
}

.panel-title {
  @apply font-medium text-sm text-gray-700 dark:text-gray-300;
}

.panel-placeholder {
  @apply flex items-center justify-center h-full text-gray-500 dark:text-gray-400;
}

.results-panel {
  @apply h-full overflow-auto p-4;
}

.results-content {
  @apply space-y-2;
}

.results-content h3 {
  @apply text-lg font-semibold text-gray-800 dark:text-gray-200;
}

.results-content pre {
  @apply bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm;
}

.progress-bar {
  @apply w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden;
}

.progress-fill {
  @apply h-full bg-blue-500 transition-all duration-300 ease-out;
}
</style>