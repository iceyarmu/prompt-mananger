<template>
  <div 
    class="file-tree-toolbar sticky bottom-0 z-10 bg-white dark:bg-gray-800 border-t theme-border"
    role="toolbar"
    :aria-label="t('fileTree.toolbar.ariaLabel')"
  >
    <div class="flex items-center justify-between gap-2 p-2 min-h-[40px]">
      <!-- Left: Connection Status -->
      <div 
        class="flex items-center gap-2 min-w-0 flex-1"
        role="status"
        aria-live="polite"
      >
        <FileTreeConnectionStatus
          :status="connectionStatus"
          :profile="activeProfile"
          :last-sync="lastSyncTime"
        />
      </div>
      
      <!-- Right: Action Buttons -->
      <div 
        class="flex items-center gap-1 flex-shrink-0"
        role="group"
        :aria-label="t('fileTree.toolbar.actions')"
      >
        <!-- Refresh Button -->
        <button
          @click="refreshTree"
          :disabled="!isConnected || refreshing"
          class="h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          :aria-label="t('fileTree.toolbar.refresh')"
          :aria-describedby="refreshing ? 'refresh-status' : undefined"
        >
          <svg 
            class="w-4 h-4 mx-auto"
            :class="{ 'animate-spin': refreshing }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </button>
        
        <!-- Configure Button -->
        <button
          @click="openConfiguration"
          class="h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          :aria-label="t('fileTree.toolbar.configure')"
        >
          <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
            />
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Screen reader only status updates -->
    <div id="refresh-status" class="sr-only" aria-live="polite">
      <span v-if="refreshing">{{ t('fileTree.refresh.inProgress') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useWebDAVStore } from '../composables/useWebDAVStore'
import { useFileTreeStore } from '../composables/useFileTreeStore'
import { useToast } from '../composables/useToast'
import { useI18n } from 'vue-i18n'
import FileTreeConnectionStatus from './FileTreeConnectionStatus.vue'

const webdavStore = useWebDAVStore()
const fileTreeStore = useFileTreeStore()
const toast = useToast()
const { t } = useI18n()

const refreshing = ref(false)
const lastSyncTime = ref<Date | null>(null)
const connectionMonitorInterval = ref<number | null>(null)

// Computed properties
const connectionStatus = computed(() => webdavStore.connectionStatus)
const activeProfile = computed(() => webdavStore.activeProfile)
const isConnected = computed(() => connectionStatus.value === 'connected')

// Emit for opening config modal
const emit = defineEmits<{
  'open-config': []
}>()

const refreshTree = async () => {
  if (!isConnected.value) return
  
  refreshing.value = true
  
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 3000)
  })
  
  try {
    // Race between the refresh and timeout
    await Promise.race([
      fileTreeStore.loadTree(),
      timeoutPromise
    ])
    
    lastSyncTime.value = new Date()
    toast.success(t('fileTree.refresh.success'))
  } catch (error) {
    console.error('Failed to refresh tree:', error)
    handleRefreshError(error as Error)
  } finally {
    refreshing.value = false
  }
}

const handleRefreshError = (error: Error) => {
  let message = t('fileTree.refresh.error')
  
  if (error.message.includes('network') || error.name === 'NetworkError') {
    message = t('webdav.errors.networkError')
  } else if (error.message.includes('timeout')) {
    message = t('webdav.errors.connectionTimeout')
  } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
    message = t('webdav.errors.authenticationFailed')
  } else if (error.message.includes('404')) {
    message = t('webdav.errors.serverNotFound')
  }
  
  toast.error(message)
}

const openConfiguration = () => {
  emit('open-config')
}

// Connection monitoring
const startConnectionMonitoring = () => {
  stopConnectionMonitoring()
  
  connectionMonitorInterval.value = window.setInterval(async () => {
    if (activeProfile.value && connectionStatus.value === 'connected') {
      try {
        // Check connection by testing with current profile
        const profile = await webdavStore.getProfileWithCredentials(activeProfile.value.id)
        await webdavStore.testConnection({
          url: profile.url,
          username: profile.username,
          password: profile.password
        })
      } catch (error) {
        console.warn('Connection test failed:', error)
        webdavStore.connectionStatus = 'error'
      }
    }
  }, 30000) // Check every 30 seconds
}

const stopConnectionMonitoring = () => {
  if (connectionMonitorInterval.value) {
    clearInterval(connectionMonitorInterval.value)
    connectionMonitorInterval.value = null
  }
}

onMounted(() => {
  startConnectionMonitoring()
})

onUnmounted(() => {
  stopConnectionMonitoring()
})
</script>

<style scoped>
.file-tree-toolbar {
  backdrop-filter: blur(8px);
  background-color: rgba(255, 255, 255, 0.95);
}

.dark .file-tree-toolbar {
  background-color: rgba(31, 41, 55, 0.95);
}

/* Responsive breakpoints for sidebar */
@media (max-width: 250px) {
  .file-tree-toolbar .toolbar-text {
    display: none;
  }
}
</style>