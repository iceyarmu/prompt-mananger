<template>
  <Modal
    v-model="visible"
    @confirm="handleConfirm"
  >
    <template #title>
      {{ isFolder ? t('fileTree.newFolder') : t('fileTree.newFile') }}
    </template>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1 theme-text">
          {{ t('fileTree.name') }}
        </label>
        <input
          ref="inputRef"
          v-model="itemName"
          type="text"
          class="w-full px-3 py-2 border rounded-md theme-input"
          :class="{ 'border-red-500': validationError }"
          :placeholder="isFolder ? t('fileTree.folderNamePlaceholder') : t('fileTree.fileNamePlaceholder')"
          @keydown.enter="handleConfirm"
          @input="handleInput"
        />
        <div v-if="validationError" class="text-xs text-red-500 mt-1">
          {{ validationError }}
        </div>
        <div v-if="!isFolder" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t('fileTree.mdExtensionNote') }}
        </div>
      </div>
      
      <div v-if="suggestedName" class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
        <div class="text-sm">
          {{ t('fileTree.suggestedName') }}: 
          <button
            @click="useSuggestion"
            class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ suggestedName }}
          </button>
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
        :disabled="!itemName.trim() || !!validationError"
        class="theme-button-primary"
        :class="{ 'opacity-50 cursor-not-allowed': !itemName.trim() || !!validationError }"
      >
        {{ t('common.create') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from './Modal.vue'
import { validateFilename, sanitizeFilename, isDuplicateName, generateUniqueName } from '../utils/validation'

// Props
const props = defineProps<{
  modelValue: boolean
  isFolder: boolean
  parentPath: string
  existingNames: string[]
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [name: string]
}>()

// Composables
const { t } = useI18n()

// Refs
const inputRef = ref<HTMLInputElement>()
const itemName = ref('')
const validationError = ref<string | null>(null)
const suggestedName = ref<string | null>(null)

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Watch visibility to focus input
watch(visible, async (isVisible) => {
  if (isVisible) {
    itemName.value = ''
    validationError.value = null
    suggestedName.value = null
    await nextTick()
    inputRef.value?.focus()
  }
})

// Methods
function handleInput() {
  const sanitized = sanitizeFilename(itemName.value, props.isFolder)
  
  // Validate
  validationError.value = validateFilename(sanitized, props.isFolder)
  
  // Check for duplicates
  if (!validationError.value && isDuplicateName(sanitized, props.existingNames)) {
    validationError.value = t('fileTree.duplicateName')
    suggestedName.value = generateUniqueName(sanitized, props.existingNames, props.isFolder)
  } else {
    suggestedName.value = null
  }
}

function useSuggestion() {
  if (suggestedName.value) {
    itemName.value = suggestedName.value
    validationError.value = null
    suggestedName.value = null
  }
}

function handleConfirm() {
  if (!itemName.value.trim() || validationError.value) return
  
  const sanitized = sanitizeFilename(itemName.value, props.isFolder)
  emit('confirm', sanitized)
  visible.value = false
}

function handleCancel() {
  visible.value = false
}
</script>