<template>
  <Modal
    v-model="internalVisible"
    @update:modelValue="handleClose"
    class="optimization-results-modal"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        <span>{{ $t('editor.optimizationResults', 'Optimization Results') }}</span>
      </div>
    </template>

    <div v-if="result" class="optimization-results">
      <!-- Stats Header -->
      <div class="stats-bar mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400">{{ $t('editor.original', 'Original') }}</span>
            <div class="font-medium">{{ result.metadata.originalLength }} {{ $t('editor.chars', 'chars') }}</div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">{{ $t('editor.optimized', 'Optimized') }}</span>
            <div class="font-medium">{{ result.metadata.optimizedLength }} {{ $t('editor.chars', 'chars') }}</div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">{{ $t('editor.change', 'Change') }}</span>
            <div class="font-medium" :class="changeColorClass">
              {{ result.metadata.changePercentage > 0 ? '+' : '' }}{{ result.metadata.changePercentage }}%
            </div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">{{ $t('editor.model', 'Model') }}</span>
            <div class="font-medium text-xs">{{ result.metadata.model }}</div>
          </div>
        </div>
      </div>
      
      <!-- View Tabs -->
      <div class="view-tabs mb-4">
        <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            v-for="view in viewModes"
            :key="view.value"
            @click="currentView = view.value"
            :class="[
              'flex-1 px-3 py-1.5 text-sm rounded transition-colors',
              currentView === view.value
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
          >
            {{ view.label }}
          </button>
        </div>
      </div>
      
      <!-- Content Views -->
      <div class="content-area">
        <!-- Split View -->
        <div v-if="currentView === 'split'" class="grid grid-cols-1 md:grid-cols-2 gap-4 h-96">
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div class="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-sm font-medium border-b border-gray-200 dark:border-gray-700">
              {{ $t('editor.original', 'Original') }}
            </div>
            <div class="p-4 h-full overflow-auto">
              <MarkdownRenderer :content="result.original" class="prose prose-sm dark:prose-invert max-w-none" />
            </div>
          </div>
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div class="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-sm font-medium border-b border-gray-200 dark:border-gray-700 text-blue-700 dark:text-blue-300">
              {{ $t('editor.optimized', 'Optimized') }}
            </div>
            <div class="p-4 h-full overflow-auto">
              <MarkdownRenderer :content="result.optimized" class="prose prose-sm dark:prose-invert max-w-none" />
            </div>
          </div>
        </div>
        
        <!-- Diff View -->
        <div v-else-if="currentView === 'diff'" class="border border-gray-200 dark:border-gray-700 rounded-lg h-96 overflow-hidden">
          <TextDiff
            :original="result.original"
            :optimized="result.optimized"
            :compareResult="compareResult"
            :isEnabled="true"
            :showHeader="false"
            displayMode="optimized"
          />
        </div>
        
        <!-- Optimized Only View -->
        <div v-else-if="currentView === 'optimized'" class="border border-gray-200 dark:border-gray-700 rounded-lg h-96 overflow-auto p-4">
          <MarkdownRenderer :content="result.optimized" class="prose dark:prose-invert max-w-none" />
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex gap-2">
          <button
            @click="copyToClipboard(result.optimized)"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {{ $t('common.copy', 'Copy') }}
          </button>
        </div>
        
        <div class="flex gap-3">
          <button
            @click="handleClose"
            :disabled="applying"
            class="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
          >
            {{ $t('common.cancel', 'Cancel') }}
          </button>
          <button
            @click="handleApply"
            :disabled="applying"
            class="px-4 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg v-if="applying" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ applying ? $t('editor.applying', 'Applying...') : $t('editor.applyOptimization', 'Apply Optimization') }}
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';
import TextDiff from './TextDiff.vue';
import MarkdownRenderer from './MarkdownRenderer.vue';
import { showNotification } from '../utils/notification';
import { useServices } from '../composables/useServices';
import type { OptimizationResult } from '../services/EditorOptimizationHandler';
import type { CompareResult } from '@prompt-optimizer/core';

interface Props {
  result: OptimizationResult | null;
  visible: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'apply', content: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t } = useI18n();
const { services } = useServices();

// Internal state
const internalVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const currentView = ref<'split' | 'diff' | 'optimized'>('split');
const applying = ref(false);
const compareResult = ref<CompareResult | null>(null);

// View modes configuration
const viewModes = [
  { value: 'split', label: t('editor.viewModes.splitView', 'Split View') },
  { value: 'diff', label: t('editor.viewModes.diffView', 'Diff View') },
  { value: 'optimized', label: t('editor.viewModes.optimizedOnly', 'Optimized Only') }
];

// Cache for comparison results to avoid recomputation
const comparisonCache = new Map<string, CompareResult>();
let comparisonTimeout: ReturnType<typeof setTimeout> | null = null;

// Compute comparison result when result changes with debouncing
watch(() => props.result, async (newResult) => {
  // Clear previous timeout
  if (comparisonTimeout) {
    clearTimeout(comparisonTimeout);
  }
  
  if (newResult && services.value?.compareService) {
    // Create a cache key from the first 100 chars of each string
    const cacheKey = `${newResult.original.slice(0, 100)}-${newResult.optimized.slice(0, 100)}`;
    
    // Check cache first
    if (comparisonCache.has(cacheKey)) {
      compareResult.value = comparisonCache.get(cacheKey) || null;
      return;
    }
    
    // Debounce the comparison operation
    comparisonTimeout = setTimeout(async () => {
      try {
        const result = await services.value.compareService.compare(
          newResult.original,
          newResult.optimized
        );
        compareResult.value = result;
        // Store in cache
        comparisonCache.set(cacheKey, result);
        
        // Limit cache size to prevent memory issues
        if (comparisonCache.size > 10) {
          const firstKey = comparisonCache.keys().next().value;
          comparisonCache.delete(firstKey);
        }
      } catch (error) {
        console.error('Failed to generate diff:', error);
        compareResult.value = null;
      }
    }, 300); // 300ms debounce
  }
}, { immediate: true });

// Cleanup on unmount
onUnmounted(() => {
  if (comparisonTimeout) {
    clearTimeout(comparisonTimeout);
  }
  comparisonCache.clear();
});

// Computed properties
const changeColorClass = computed(() => {
  const change = props.result?.metadata.changePercentage || 0;
  if (change > 0) return 'text-red-600 dark:text-red-400';
  if (change < 0) return 'text-green-600 dark:text-green-400';
  return 'text-gray-600 dark:text-gray-400';
});

// Methods
const handleClose = () => {
  emit('update:visible', false);
};

const handleApply = async () => {
  if (!props.result) return;
  
  applying.value = true;
  try {
    emit('apply', props.result.optimized);
    handleClose();
  } finally {
    applying.value = false;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    showNotification(t('common.copiedToClipboard', 'Copied to clipboard'), 'success');
  } catch (error) {
    showNotification(t('common.copyFailed', 'Failed to copy'), 'error');
  }
};
</script>

<style scoped>
.optimization-results-modal :deep(.theme-modal) {
  max-width: 1024px !important;
}

.optimization-results {
  min-height: 400px;
}

.content-area {
  min-height: 400px;
}

/* Ensure proper scrolling in content areas */
.content-area .overflow-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.content-area .overflow-auto::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.content-area .overflow-auto::-webkit-scrollbar-track {
  background: transparent;
}

.content-area .overflow-auto::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.dark .content-area .overflow-auto::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>