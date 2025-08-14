<template>
  <div 
    class="connection-status"
    :class="statusClass"
    :title="statusTooltip"
  >
    <span class="status-indicator" :class="indicatorClass"></span>
    <span class="status-text">{{ statusText }}</span>
    <button 
      v-if="showReconnect"
      @click="handleReconnect"
      class="reconnect-btn"
      :disabled="isReconnecting"
    >
      {{ isReconnecting ? 'Reconnecting...' : 'Reconnect' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useWebDAVStore } from '../../stores/webdav'
import { storeBus } from '../../stores/communication'

const webdavStore = useWebDAVStore()

const isReconnecting = ref(false)
const reconnectAttempts = ref(0)
const lastSyncTime = ref<Date | null>(null)
const reconnectTimer = ref<number | null>(null)

const connectionState = computed(() => webdavStore.connectionStatus)

const showReconnect = computed(() => 
  connectionState.value === 'disconnected' || connectionState.value === 'error'
)

const statusClass = computed(() => ({
  'connection-status--connected': connectionState.value === 'connected',
  'connection-status--disconnected': connectionState.value === 'disconnected',
  'connection-status--connecting': connectionState.value === 'connecting',
  'connection-status--error': connectionState.value === 'error'
}))

const indicatorClass = computed(() => ({
  'status-indicator--connected': connectionState.value === 'connected',
  'status-indicator--disconnected': connectionState.value === 'disconnected',
  'status-indicator--connecting': connectionState.value === 'connecting',
  'status-indicator--error': connectionState.value === 'error'
}))

const statusText = computed(() => {
  switch (connectionState.value) {
    case 'connected':
      return lastSyncTime.value 
        ? `Connected • Last sync: ${formatTime(lastSyncTime.value)}`
        : 'Connected'
    case 'connecting':
      return isReconnecting.value 
        ? `Reconnecting... (${reconnectAttempts.value})`
        : 'Connecting...'
    case 'error':
      return webdavStore.connectionError || 'Connection Error'
    case 'disconnected':
    default:
      return 'Disconnected'
  }
})

const statusTooltip = computed(() => {
  if (connectionState.value === 'connected') {
    const profile = webdavStore.activeProfile
    return profile ? `Connected to ${profile.name} (${profile.url})` : 'Connection is active'
  } else if (connectionState.value === 'connecting') {
    return 'Establishing connection...'
  } else if (connectionState.value === 'error') {
    return `Connection error${reconnectAttempts.value > 0 ? ` (${reconnectAttempts.value} attempts)` : ''}`
  } else {
    return 'Connection is inactive'
  }
})

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const handleReconnect = async () => {
  if (isReconnecting.value || !webdavStore.activeProfile) return

  isReconnecting.value = true
  reconnectAttempts.value++
  
  try {
    await webdavStore.connect(webdavStore.activeProfile.id)
    
    // Reset on successful connection
    reconnectAttempts.value = 0
    isReconnecting.value = false
    
    // Emit success event
    storeBus.emit('webdav', 'connection-restored', {
      profile: webdavStore.activeProfile,
      attempts: reconnectAttempts.value
    })
  } catch (error) {
    isReconnecting.value = false
    
    // Schedule retry if under max attempts
    if (reconnectAttempts.value < webdavStore.maxRetries) {
      reconnectTimer.value = window.setTimeout(() => {
        handleReconnect()
      }, 5000 * reconnectAttempts.value) // Exponential backoff
    }
    
    // Emit error event
    storeBus.emit('webdav', 'connection-failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      attempts: reconnectAttempts.value
    })
  }
}

// Watch for connection status changes
watch(connectionState, (newState, oldState) => {
  if (newState === 'connected') {
    lastSyncTime.value = new Date()
    reconnectAttempts.value = 0
    
    // Clear any pending reconnect timers
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }
  } else if (newState === 'disconnected' && oldState === 'connected') {
    // Auto-reconnect on unexpected disconnect
    setTimeout(() => {
      if (connectionState.value === 'disconnected' && !isReconnecting.value) {
        handleReconnect()
      }
    }, 3000)
  }
})

// Listen for sync events
storeBus.on('webdav', 'file-synced', () => {
  lastSyncTime.value = new Date()
})

// Update sync time periodically
const updateTimer = setInterval(() => {
  // Trigger reactivity to update time display
  if (lastSyncTime.value) {
    lastSyncTime.value = new Date(lastSyncTime.value)
  }
}, 60000) // Update every minute

onMounted(() => {
  // Load initial state
  if (webdavStore.isConnected) {
    lastSyncTime.value = new Date()
  }
})

onUnmounted(() => {
  // Cleanup timers
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value)
  }
  clearInterval(updateTimer)
})
</script>

<style scoped>
.connection-status {
  @apply flex items-center space-x-2 px-3 py-1 rounded-full;
  @apply bg-gray-100 dark:bg-gray-800 transition-all duration-300;
}

.connection-status--connected {
  @apply bg-green-50 dark:bg-green-900/20;
}

.connection-status--disconnected {
  @apply bg-gray-100 dark:bg-gray-800;
}

.connection-status--connecting {
  @apply bg-yellow-50 dark:bg-yellow-900/20;
}

.connection-status--error {
  @apply bg-red-50 dark:bg-red-900/20;
}

.status-indicator {
  @apply w-2 h-2 rounded-full transition-colors duration-300;
}

.status-indicator--connected {
  @apply bg-green-500 animate-pulse;
}

.status-indicator--disconnected {
  @apply bg-gray-400 dark:bg-gray-600;
}

.status-indicator--connecting {
  @apply bg-yellow-500;
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.status-indicator--error {
  @apply bg-red-500 animate-ping;
}

.status-text {
  @apply text-xs font-medium;
}

.connection-status--connected .status-text {
  @apply text-green-700 dark:text-green-400;
}

.connection-status--disconnected .status-text {
  @apply text-gray-600 dark:text-gray-400;
}

.connection-status--connecting .status-text {
  @apply text-yellow-700 dark:text-yellow-400;
}

.connection-status--error .status-text {
  @apply text-red-700 dark:text-red-400;
}

.reconnect-btn {
  @apply px-2 py-0.5 text-xs font-medium rounded;
  @apply bg-blue-500 text-white hover:bg-blue-600;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply transition-colors duration-200;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>