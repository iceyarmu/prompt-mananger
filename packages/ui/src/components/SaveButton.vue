<template>
  <button
    @click="handleSave"
    :disabled="isSaving || !hasUnsavedChanges"
    :class="buttonClasses"
    :title="buttonTitle"
    class="save-button flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200"
  >
    <Icon 
      v-if="isSaving" 
      name="loader" 
      class="w-4 h-4 animate-spin" 
    />
    <Icon 
      v-else 
      name="save" 
      class="w-4 h-4" 
    />
    <span class="text-sm font-medium">
      {{ buttonText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

interface Props {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaveTime?: Date | null;
  onSave: () => Promise<void>;
}

const props = defineProps<Props>();

const buttonClasses = computed(() => {
  if (props.isSaving) {
    return 'bg-blue-500 text-white cursor-wait';
  }
  if (!props.hasUnsavedChanges) {
    return 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600';
  }
  return 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700';
});

const buttonText = computed(() => {
  if (props.isSaving) {
    return 'Saving...';
  }
  if (!props.hasUnsavedChanges) {
    return 'Saved';
  }
  return 'Save';
});

const buttonTitle = computed(() => {
  const shortcut = navigator.platform.includes('Mac') ? 'Cmd+S' : 'Ctrl+S';
  
  if (!props.hasUnsavedChanges && props.lastSaveTime) {
    return `Last saved: ${formatTime(props.lastSaveTime)} (${shortcut})`;
  }
  
  return `Save file (${shortcut})`;
});

const handleSave = async () => {
  if (props.isSaving || !props.hasUnsavedChanges) {
    return;
  }
  
  await props.onSave();
};

const formatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return date.toLocaleDateString();
};
</script>

<style scoped>
.save-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.save-button:disabled {
  opacity: 0.6;
}
</style>