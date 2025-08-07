<template>
  <div class="optimization-options-popover">
    <div class="relative inline-block">
      <!-- Options button -->
      <button
        @click="togglePopover"
        ref="triggerRef"
        :class="[
          'p-1 rounded transition-colors',
          isOpen
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        ]"
        :aria-label="$t('editor.optimizationOptions', 'Optimization Options')"
        :aria-expanded="isOpen"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      
      <!-- Popover content -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          ref="popoverRef"
          class="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
        >
          <div class="p-4 space-y-4">
            <!-- Optimization Mode -->
            <div>
              <label class="block text-sm font-medium mb-2">
                {{ $t('editor.optimizationMode', 'Optimization Mode') }}
              </label>
              <OptimizationModeSelector
                :modelValue="optimizationMode"
                @update:modelValue="$emit('update:optimizationMode', $event)"
              />
            </div>
            
            <!-- Model Selection -->
            <div>
              <label class="block text-sm font-medium mb-2">
                {{ $t('editor.model', 'Model') }}
              </label>
              <ModelSelect
                :modelValue="selectedModel"
                @update:modelValue="$emit('update:selectedModel', $event)"
                class="w-full"
              />
            </div>
            
            <!-- Template Selection -->
            <div>
              <label class="block text-sm font-medium mb-2">
                {{ $t('editor.template', 'Template') }}
              </label>
              <TemplateSelect
                :modelValue="selectedTemplate"
                @update:modelValue="$emit('update:selectedTemplate', $event)"
                :optimizationMode="optimizationMode"
                class="w-full"
              />
            </div>
            
            <!-- Save as default -->
            <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="saveAsDefault"
                class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                {{ $t('editor.saveAsDefault', 'Save as Default') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import OptimizationModeSelector from './OptimizationModeSelector.vue';
import ModelSelect from './ModelSelect.vue';
import TemplateSelect from './TemplateSelect.vue';
import { showNotification } from '../utils/notification';
import { useServices } from '../composables/useServices';
import type { OptimizationMode } from '@prompt-optimizer/core';

interface Props {
  optimizationMode: OptimizationMode;
  selectedModel: string;
  selectedTemplate: string;
}

interface Emits {
  (e: 'update:optimizationMode', value: OptimizationMode): void;
  (e: 'update:selectedModel', value: string): void;
  (e: 'update:selectedTemplate', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t } = useI18n();
const { services } = useServices();

const isOpen = ref(false);
const triggerRef = ref<HTMLElement>();
const popoverRef = ref<HTMLElement>();

// Toggle popover
const togglePopover = () => {
  isOpen.value = !isOpen.value;
};

// Close popover when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (!triggerRef.value || !popoverRef.value) return;
  
  const target = event.target as Node;
  if (!triggerRef.value.contains(target) && !popoverRef.value.contains(target)) {
    isOpen.value = false;
  }
};

// Save current settings as default
const saveAsDefault = async () => {
  try {
    if (services.value?.preferenceService) {
      await services.value.preferenceService.set('editor.optimization.mode', props.optimizationMode);
      await services.value.preferenceService.set('editor.optimization.model', props.selectedModel);
      await services.value.preferenceService.set('editor.optimization.template', props.selectedTemplate);
      
      showNotification(t('editor.savedAsDefault', 'Saved as default'), 'success');
      isOpen.value = false;
    }
  } catch (error) {
    console.error('Failed to save defaults:', error);
    showNotification(t('editor.saveFailed', 'Failed to save defaults'), 'error');
  }
};

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.optimization-options-popover {
  display: inline-block;
}
</style>