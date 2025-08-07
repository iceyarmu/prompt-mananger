<template>
  <Modal
    v-model="visible"
    @confirm="handleConfirm"
  >
    <template #title>
      {{ t('fileTree.confirmDelete') }}
    </template>
    
    <div class="space-y-4">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm theme-text">
            {{ t('fileTree.deleteConfirmMessage', { 
              type: item?.type === 'folder' ? t('fileTree.folder') : t('fileTree.file'),
              name: item?.name 
            }) }}
          </p>
          <p v-if="item?.type === 'folder'" class="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            {{ t('fileTree.deleteFolderWarning') }}
          </p>
        </div>
      </div>
    </div>
    
    <template #footer>
      <button
        @click="handleCancel"
        class="theme-button-secondary"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        @click="handleConfirm"
        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
      >
        {{ t('common.delete') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from './Modal.vue'
import type { TreeNode } from '../types/fileTree'

// Props
const props = defineProps<{
  modelValue: boolean
  item: TreeNode | null
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
}>()

// Composables
const { t } = useI18n()

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Methods
function handleConfirm() {
  emit('confirm')
  visible.value = false
}

function handleCancel() {
  visible.value = false
}
</script>