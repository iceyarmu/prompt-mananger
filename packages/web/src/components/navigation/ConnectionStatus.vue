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
import { computed, ref } from 'vue'

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error'

const props = withDefaults(defineProps<{
  state?: ConnectionState
  message?: string
  showReconnect?: boolean
  autoReconnect?: boolean
  reconnectDelay?: number
}>(), {
  state: 'disconnected',
  showReconnect: true,
  autoReconnect: true,
  reconnectDelay: 5000
})

const emit = defineEmits<{
  reconnect: []
}>()

const isReconnecting = ref(false)
const reconnectAttempts = ref(0)

const statusClass = computed(() => ({
  'connection-status--connected': props.state === 'connected',
  'connection-status--disconnected': props.state === 'disconnected',
  'connection-status--connecting': props.state === 'connecting',
  'connection-status--error': props.state === 'error'
}))

const indicatorClass = computed(() => ({
  'status-indicator--connected': props.state === 'connected',
  'status-indicator--disconnected': props.state === 'disconnected',
  'status-indicator--connecting': props.state === 'connecting',
  'status-indicator--error': props.state === 'error'
}))

const statusText = computed(() => {
  if (props.message) return props.message

  switch (props.state) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting...'
    case 'error':
      return 'Connection Error'
    case 'disconnected':
    default:
      return 'Disconnected'
  }
})

const statusTooltip = computed(() => {
  if (props.state === 'connected') {
    return 'Connection is active'
  } else if (props.state === 'connecting') {
    return 'Establishing connection...'
  } else if (props.state === 'error') {
    return `Connection error${reconnectAttempts.value > 0 ? ` (${reconnectAttempts.value} attempts)` : ''}`
  } else {
    return 'Connection is inactive'
  }
})

const handleReconnect = async () => {
  if (isReconnecting.value) return

  isReconnecting.value = true
  reconnectAttempts.value++
  
  emit('reconnect')

  // Simulate reconnection delay
  setTimeout(() => {
    isReconnecting.value = false
  }, 2000)
}

// Auto-reconnect logic
if (props.autoReconnect && props.state === 'disconnected') {
  setTimeout(() => {
    if (props.state === 'disconnected' && !isReconnecting.value) {
      handleReconnect()
    }
  }, props.reconnectDelay)
}
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
  @apply bg-yellow-500 animate-spin;
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