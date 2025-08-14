<template>
  <div class="execution-results-panel fixed inset-y-0 right-0 w-1/2 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div v-if="result && result.model" class="flex items-center gap-2">
          <svg v-if="getProviderIcon(result.model) === 'openai'" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.975 5.975 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
          </svg>
          <svg v-else-if="getProviderIcon(result.model) === 'anthropic'" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.model }}</span>
        </div>
        <span v-if="result && result.executionTime" class="text-sm text-gray-500 dark:text-gray-400">
          {{ formatTime(result.executionTime) }}
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          @click="copyResult"
          class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :aria-label="$t('execution.copy', 'Copy')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          @click="exportResult"
          class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :aria-label="$t('execution.export', 'Export')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          @click="$emit('close')"
          class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :aria-label="$t('common.close', 'Close')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-auto p-6">
      <div v-if="streaming && !result?.content" class="flex items-center gap-3">
        <svg class="w-5 h-5 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('execution.waitingForResponse', 'Waiting for response...') }}
        </span>
      </div>
      
      <div v-else-if="result?.content" class="prose prose-sm dark:prose-invert max-w-none">
        <MarkdownRenderer :content="displayContent" />
        <span v-if="streaming" class="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-600 animate-pulse ml-1"></span>
      </div>
      
      <div v-else class="text-gray-500 dark:text-gray-400">
        {{ $t('execution.noContent', 'No content to display') }}
      </div>
    </div>
    
    <!-- Footer -->
    <div v-if="result && result.usage" class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
        <div class="flex gap-4">
          <span>{{ $t('execution.tokens', 'Tokens') }}: {{ result.usage.totalTokens }}</span>
          <span>{{ $t('execution.cost', 'Cost') }}: ${{ result.usage.cost.toFixed(4) }}</span>
          <span>{{ formatTimestamp(result.timestamp) }}</span>
        </div>
        
        <div class="flex gap-2">
          <span class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            {{ result.usage.promptTokens }}p + {{ result.usage.completionTokens }}c
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import { useClipboard } from '../composables/useClipboard'
import MarkdownRenderer from './MarkdownRenderer.vue'
import type { ExecutionResult } from '../services/PromptExecutionHandler'

const props = defineProps<{
  result: ExecutionResult | null
  streaming?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const toast = useToast()
const { copyText } = useClipboard()

// Display content
const displayContent = computed(() => {
  return props.result?.content || ''
})

// Get provider icon based on model name
const getProviderIcon = (model: string) => {
  if (model.includes('gpt')) return 'openai'
  if (model.includes('claude')) return 'anthropic'
  if (model.includes('gemini')) return 'google'
  return 'default'
}

// Copy result to clipboard
const copyResult = async () => {
  if (!props.result?.content) return
  await copyText(props.result.content)
}

// Export result as JSON
const exportResult = () => {
  if (!props.result) return
  
  const data = {
    content: props.result.content,
    model: props.result.model,
    usage: props.result.usage,
    executionTime: props.result.executionTime,
    timestamp: props.result.timestamp
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `execution-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  toast.success(t('toast.success.exported', 'Exported successfully'))
}

// Format execution time
const formatTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// Format timestamp
const formatTimestamp = (date: Date) => {
  return new Date(date).toLocaleString()
}
</script>

<style scoped>
.execution-results-panel {
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.prose {
  color: inherit;
}

.prose :deep(pre) {
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
}

.prose :deep(code) {
  background-color: var(--color-background-secondary);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}
</style>