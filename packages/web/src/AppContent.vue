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
      <span class="panel-title">Results</span>
    </template>
    <template #right>
      <div class="results-panel">
        <div v-if="optimizationResults" class="results-content">
          <h3>Optimization Results</h3>
          <pre>{{ optimizationResults }}</pre>
        </div>
        <div v-else-if="executionResults" class="results-content">
          <h3>Execution Results</h3>
          <pre>{{ executionResults }}</pre>
        </div>
        <div v-else class="panel-placeholder">
          <p>Results will appear here</p>
        </div>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppLayout from './components/AppLayout.vue'
import { BreadcrumbNav, ConnectionStatus, type BreadcrumbItem, type ConnectionState } from './components/navigation'
import { 
  FileTree, 
  MarkdownEditor,
  ThemeToggleUI
} from '@prompt-optimizer/ui'

// State
const currentPath = ref('/')
const currentFileName = ref('')
const editorContent = ref('')
const fileTreeData = ref(null)
const optimizationResults = ref(null)
const executionResults = ref(null)
const connectionState = ref<ConnectionState>('connected')
const connectionMessage = ref('')

// Methods
const toggleSettings = () => {
  console.log('Settings clicked')
}

const handleFileSelect = (file: any) => {
  currentFileName.value = file.name
  currentPath.value = file.path
  console.log('File selected:', file)
}

const handleEditorChange = (content: string) => {
  console.log('Editor content changed')
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
</style>