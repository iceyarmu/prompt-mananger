<template>
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li v-for="(item, index) in breadcrumbItems" :key="index" class="breadcrumb-item">
        <button 
          v-if="index < breadcrumbItems.length - 1"
          @click="navigateTo(item)"
          class="breadcrumb-link"
          :aria-label="`Navigate to ${item.label}`"
        >
          {{ item.label }}
        </button>
        <span v-else class="breadcrumb-current" aria-current="page">
          {{ item.label }}
        </span>
        <span v-if="index < breadcrumbItems.length - 1" class="breadcrumb-separator">
          /
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface BreadcrumbItem {
  label: string
  path: string
  data?: any
}

const props = defineProps<{
  path: string
  separator?: string
}>()

const emit = defineEmits<{
  navigate: [item: BreadcrumbItem]
}>()

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  if (!props.path || props.path === '/') {
    return [{ label: 'Root', path: '/' }]
  }

  const parts = props.path.split('/').filter(Boolean)
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
  emit('navigate', item)
}
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