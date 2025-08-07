<template>
  <div class="inline-edit-container">
    <input
      v-if="editing"
      ref="inputRef"
      v-model="editValue"
      type="text"
      class="inline-edit-input px-2 py-1 text-sm border rounded theme-input"
      :class="{ 'border-red-500': validationError }"
      @keydown.enter="handleSave"
      @keydown.escape="handleCancel"
      @blur="handleBlur"
      @input="handleInput"
    />
    <div v-else 
      class="inline-edit-display"
      @click="startEdit"
    >
      <slot :value="value">{{ value }}</slot>
    </div>
    <div v-if="validationError" class="text-xs text-red-500 mt-1">
      {{ validationError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

// Props
const props = defineProps<{
  value: string
  editing?: boolean
  validator?: (value: string) => string | null
  sanitizer?: (value: string) => string
}>()

// Emits
const emit = defineEmits<{
  'update:value': [value: string]
  'update:editing': [editing: boolean]
  'save': [value: string]
  'cancel': []
}>()

// Refs
const inputRef = ref<HTMLInputElement>()
const editValue = ref(props.value)
const validationError = ref<string | null>(null)
const isFocused = ref(false)
const isIntentionalBlur = ref(false)

// Watch value prop changes
watch(() => props.value, (newValue) => {
  editValue.value = newValue
})

// Watch editing prop to focus input
watch(() => props.editing, async (isEditing) => {
  if (isEditing) {
    isFocused.value = true
    isIntentionalBlur.value = false
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  } else {
    isFocused.value = false
  }
})

// Methods
function startEdit() {
  editValue.value = props.value
  validationError.value = null
  isFocused.value = true
  isIntentionalBlur.value = false
  emit('update:editing', true)
}

function handleInput() {
  if (props.validator) {
    validationError.value = props.validator(editValue.value)
  }
}

function handleSave() {
  // Validate
  if (props.validator) {
    const error = props.validator(editValue.value)
    if (error) {
      validationError.value = error
      return
    }
  }
  
  // Sanitize
  let finalValue = editValue.value
  if (props.sanitizer) {
    finalValue = props.sanitizer(finalValue)
  }
  
  // Save
  isIntentionalBlur.value = true
  emit('update:value', finalValue)
  emit('save', finalValue)
  emit('update:editing', false)
  validationError.value = null
  isFocused.value = false
}

function handleCancel() {
  isIntentionalBlur.value = true
  editValue.value = props.value
  validationError.value = null
  emit('update:editing', false)
  emit('cancel')
  isFocused.value = false
}

function handleBlur() {
  // Only save on blur if it wasn't an intentional save/cancel
  if (!isIntentionalBlur.value && isFocused.value && props.editing) {
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      // Check if we're still not focused (no immediate refocus)
      if (!document.activeElement || !inputRef.value?.contains(document.activeElement)) {
        handleSave()
      }
    })
  }
  isFocused.value = false
}
</script>

<style scoped>
.inline-edit-container {
  position: relative;
  width: 100%;
}

.inline-edit-display {
  cursor: text;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.inline-edit-display:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dark .inline-edit-display:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.inline-edit-input {
  width: 100%;
  font-size: inherit;
  font-family: inherit;
}

.inline-edit-input:focus {
  outline: none;
  border-color: rgb(59, 130, 246);
}

.inline-edit-input.border-red-500 {
  border-color: rgb(239, 68, 68);
}
</style>