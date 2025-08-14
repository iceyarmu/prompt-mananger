<template>
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li v-for="(item, index) in breadcrumbItems" :key="index" class="breadcrumb-item">
        <button 
          v-if="index < breadcrumbItems.length - 1"
          @click="navigateTo(item)"
          class="breadcrumb-link"
          :aria-label="`Navigate to ${item.label}`"
          :title="item.label.length > 20 ? item.label : undefined"
        >
          {{ truncateLabel(item.label) }}
        </button>
        <span 
          v-else 
          class="breadcrumb-current" 
          aria-current="page"
          :title="item.label.length > 20 ? item.label : undefined"
        >
          {{ truncateLabel(item.label) }}
        </span>
        <span v-if="index < breadcrumbItems.length - 1" class="breadcrumb-separator">
          /
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useFileTreeStore } from '../../stores/fileTree'
import { storeBus } from '../../stores/communication'

export interface BreadcrumbItem {
  label: string
  path: string
  data?: any
}

const fileTreeStore = useFileTreeStore()

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const path = fileTreeStore.currentPath
  
  if (!path || path === '/') {
    return [{ label: 'Root', path: '/' }]
  }

  const parts = path.split('/').filter(Boolean)
  const items: BreadcrumbItem[] = [{ label: 'Root', path: '/' }]

  let currentPath = ''
  for (const part of parts) {
    currentPath += `/${part}`
    items.push({
      label: part,
      path: currentPath
    })
  }

  return items
})

const navigateTo = (item: BreadcrumbItem) => {
  fileTreeStore.navigateToPath(item.path)
  
  // Emit navigation event through StoreCommunicationBus
  storeBus.emit('filetree', 'navigate-to-path', item.path)
}

const truncateLabel = (label: string, maxLength: number = 20) => {
  if (label.length <= maxLength) return label
  
  const start = Math.floor((maxLength - 3) / 2)
  const end = Math.ceil((maxLength - 3) / 2)
  return `${label.slice(0, start)}...${label.slice(-end)}`
}

// Listen for navigation events from other components
storeBus.on('filetree', 'path-changed', (path: string) => {
  // Path is automatically synced through the store's currentPath
})
</script>

<style scoped>
.breadcrumb-nav {
  @apply flex items-center;
}

.breadcrumb-list {
  @apply flex items-center space-x-1 text-sm;
}

.breadcrumb-item {
  @apply flex items-center;
}

.breadcrumb-link {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300;
  @apply hover:underline transition-colors;
}

.breadcrumb-current {
  @apply text-gray-700 dark:text-gray-300 font-medium;
}

.breadcrumb-separator {
  @apply mx-2 text-gray-400 dark:text-gray-600;
}
</style>