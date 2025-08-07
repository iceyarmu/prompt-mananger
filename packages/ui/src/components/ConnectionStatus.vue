<template>
  <div class="flex items-center space-x-3">
    <!-- Connection Status Indicator -->
    <div class="flex items-center space-x-2">
      <div 
        class="w-3 h-3 rounded-full flex-shrink-0 transition-colors"
        :class="statusClasses"
        :title="statusText"
      ></div>
      <span class="text-sm theme-text hidden sm:inline">
        {{ statusText }}
      </span>
    </div>

    <!-- Active Profile Name -->
    <div v-if="activeProfile" class="text-sm theme-manager-text-secondary hidden md:block">
      {{ activeProfile.name }}
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center space-x-2">
      <!-- Reconnect Button (shown on error) -->
      <button
        v-if="connectionStatus === 'error' && activeProfile"
        @click="reconnect"
        :disabled="isConnecting"
        class="text-sm px-2 py-1 rounded theme-button-secondary flex items-center space-x-1"
        :title="$t('webdav.status.reconnect')"
      >
        <svg 
          class="w-3 h-3" 
          :class="{ 'animate-spin': isConnecting }"
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
        <span class="hidden sm:inline">
          {{ $t('webdav.status.reconnect') }}
        </span>
      </button>

      <!-- Configure Button -->
      <button
        @click="openConfig"
        class="text-sm px-2 py-1 rounded theme-button-secondary flex items-center space-x-1"
        :title="$t('webdav.status.configure')"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <span class="hidden sm:inline">
          {{ $t('webdav.status.configure') }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWebDAVStore } from '@/composables/useWebDAVStore'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const webdavStore = useWebDAVStore()
const toast = useToast()

// Emits
const emit = defineEmits<{
  'open-config': []
}>()

// Reactive data
const isConnecting = ref(false)

// Computed
const connectionStatus = computed(() => webdavStore.connectionStatus)
const activeProfile = computed(() => webdavStore.activeProfile)

const statusClasses = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    case 'disconnected':
    default:
      return 'bg-gray-400'
  }
})

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return t('webdav.status.connected')
    case 'connecting':
      return t('webdav.status.connecting')
    case 'error':
      return t('webdav.status.error')
    case 'disconnected':
    default:
      return t('webdav.status.disconnected')
  }
})

// Methods
const reconnect = async () => {
  if (!activeProfile.value || isConnecting.value) return

  isConnecting.value = true
  try {
    await webdavStore.connect(activeProfile.value.id)
    toast.success(t('webdav.status.reconnected'))
  } catch (error) {
    toast.error(t('webdav.status.reconnectFailed', { error: error.message }))
  } finally {
    isConnecting.value = false
  }
}

const openConfig = () => {
  emit('open-config')
}
</script>