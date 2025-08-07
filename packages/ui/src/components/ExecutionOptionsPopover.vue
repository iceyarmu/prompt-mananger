<template>
  <div class="relative inline-block">
    <button
      @click="isOpen = !isOpen"
      class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      :aria-label="$t('execution.options', 'Execution Options')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
    
    <div v-if="isOpen" 
         v-click-outside="() => isOpen = false"
         class="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 p-4">
      <h3 class="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
        {{ $t('execution.options', 'Execution Options') }}
      </h3>
      
      <!-- Temperature -->
      <div class="mb-4">
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('execution.temperature', 'Temperature') }}: {{ localOptions.temperature }}
        </label>
        <input
          v-model.number="localOptions.temperature"
          type="range"
          min="0"
          max="2"
          step="0.1"
          class="w-full"
          @input="updateOptions"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('execution.temperatureHint', 'Higher values make output more random') }}
        </p>
      </div>
      
      <!-- Max Tokens -->
      <div class="mb-4">
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('execution.maxTokens', 'Max Tokens') }}
        </label>
        <input
          v-model.number="localOptions.maxTokens"
          type="number"
          min="1"
          :max="getMaxTokensForModel()"
          class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          @input="updateOptions"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('execution.maxTokensHint', 'Maximum tokens to generate') }} ({{ getMaxTokensForModel() }} max)
        </p>
      </div>
      
      <!-- System Prompt -->
      <div class="mb-4">
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('execution.systemPrompt', 'System Prompt') }}
        </label>
        <textarea
          v-model="localOptions.systemPrompt"
          rows="3"
          class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          :placeholder="$t('execution.systemPromptPlaceholder', 'Optional system prompt...')"
          @input="updateOptions"
        />
      </div>
      
      <!-- Streaming -->
      <div class="mb-4">
        <label class="flex items-center space-x-2">
          <input
            v-model="localOptions.streaming"
            type="checkbox"
            class="rounded"
            @change="updateOptions"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('execution.enableStreaming', 'Enable streaming') }}
          </span>
        </label>
      </div>
      
      <!-- Presets -->
      <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('execution.presets', 'Presets') }}
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="preset in presets"
            :key="preset.name"
            @click="applyPreset(preset)"
            class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { clickOutside } from '../directives/clickOutside'
import type { ExecutionOptions } from '../services/PromptExecutionHandler'

const props = defineProps<{
  options: ExecutionOptions
  selectedModel: string
}>()

const emit = defineEmits<{
  'update:options': [options: ExecutionOptions]
}>()

const vClickOutside = clickOutside
const isOpen = ref(false)
const localOptions = ref({ ...props.options })

// Presets
const presets = [
  {
    name: 'Creative',
    temperature: 1.0,
    maxTokens: 2000,
    streaming: true
  },
  {
    name: 'Balanced',
    temperature: 0.7,
    maxTokens: 1000,
    streaming: true
  },
  {
    name: 'Precise',
    temperature: 0.1,
    maxTokens: 500,
    streaming: false
  },
  {
    name: 'Long Form',
    temperature: 0.8,
    maxTokens: 4000,
    streaming: true
  }
]

// Get max tokens for the selected model
const getMaxTokensForModel = () => {
  const modelLimits: Record<string, number> = {
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 4096,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'gemini-pro': 32768,
    'gemini-2.0-flash': 32768
  }
  
  return modelLimits[props.selectedModel] || 4096
}

// Apply a preset
const applyPreset = (preset: typeof presets[0]) => {
  localOptions.value = {
    ...localOptions.value,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    streaming: preset.streaming
  }
  updateOptions()
}

// Update options
const updateOptions = () => {
  emit('update:options', { ...localOptions.value })
}

// Watch for external changes
watch(() => props.options, (newOptions) => {
  localOptions.value = { ...newOptions }
}, { deep: true })
</script>