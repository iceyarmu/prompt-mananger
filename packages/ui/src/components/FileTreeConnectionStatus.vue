<template>
  <div class="connection-status flex items-center gap-2 min-w-0">
    <!-- Status Indicator -->
    <div class="relative flex-shrink-0">
      <div
        class="status-dot w-2 h-2 rounded-full transition-colors duration-300"
        :class="statusDotClass"
      />
      <!-- Pulsing animation for connecting state -->
      <div
        v-if="status === 'connecting'"
        class="absolute inset-0 w-2 h-2 rounded-full animate-ping"
        :class="statusDotClass"
      />
    </div>
    
    <!-- Status Text -->
    <div 
      class="min-w-0 flex-1 text-xs font-medium truncate theme-text-secondary"
      :title="tooltipText"
    >
      <template v-if="profile && status === 'connected'">
        {{ profile.name }}
      </template>
      <template v-else-if="status === 'connecting'">
        {{ t('webdav.status.connecting') }}
      </template>
      <template v-else-if="status === 'error'">
        {{ t('webdav.status.error') }}
      </template>
      <template v-else>
        {{ t('webdav.status.disconnected') }}
      </template>
    </div>
    
    <!-- Connection quality indicator -->
    <div v-if="profile && status === 'connected'" class="flex items-center gap-0.5 flex-shrink-0">
      <div 
        v-for="i in 3" 
        :key="i"
        class="w-1 h-2 rounded-sm transition-colors"
        :class="i <= connectionQuality ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WebDAVProfile } from '../composables/useWebDAVStore'

interface Props {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  profile?: WebDAVProfile | null
  lastSync?: Date | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const statusDotClass = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
})

const connectionQuality = computed(() => {
  // Calculate connection quality based on last sync time
  if (!props.lastSync) return 1
  const timeSinceSync = Date.now() - props.lastSync.getTime()
  if (timeSinceSync < 60000) return 3 // < 1 minute = excellent
  if (timeSinceSync < 300000) return 2 // < 5 minutes = good
  return 1 // > 5 minutes = poor
})

const tooltipText = computed(() => {
  if (props.profile && props.status === 'connected') {
    let tooltip = `${props.profile.name}\n${props.profile.url}`
    if (props.lastSync) {
      tooltip += `\n${t('webdav.status.lastSync')}: ${formatRelativeTime(props.lastSync)}`
    }
    return tooltip
  }
  return t(`webdav.status.${props.status}`)
})

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return t('time.justNow')
  if (diffMins < 60) return t('time.minutesAgo', { count: diffMins })
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
  
  return date.toLocaleDateString()
}
</script>

<style scoped>
.status-dot {
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.dark .status-dot {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}
</style>