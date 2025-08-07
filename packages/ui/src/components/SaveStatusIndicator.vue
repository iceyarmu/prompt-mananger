<template>
  <div class="save-status flex items-center gap-2 text-sm">
    <!-- Unsaved indicator -->
    <Transition name="fade">
      <span
        v-if="hasUnsavedChanges && !saving"
        class="text-orange-500 font-medium text-lg leading-none"
        title="Unsaved changes"
      >
        ●
      </span>
    </Transition>
    
    <!-- Connection status indicator -->
    <Transition name="fade">
      <span
        v-if="!isConnected"
        class="text-red-500"
        title="Disconnected from server"
      >
        <Icon name="wifi-off" class="w-4 h-4" />
      </span>
    </Transition>
    
    <!-- Save status with transitions -->
    <Transition name="slide-fade" mode="out-in">
      <div v-if="saving" class="flex items-center gap-1 text-blue-600 dark:text-blue-400">
        <Icon name="loader" class="w-3 h-3 animate-spin" />
        <span>Saving...</span>
      </div>
      
      <div v-else-if="justSaved" class="flex items-center gap-1 text-green-600 dark:text-green-400">
        <Icon name="check" class="w-3 h-3" />
        <span>Saved</span>
      </div>
      
      <div v-else-if="saveError" class="flex items-center gap-1 text-red-600 dark:text-red-400">
        <Icon name="alert-triangle" class="w-3 h-3" />
        <span>Save failed</span>
      </div>
      
      <div v-else-if="conflictDetected" class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
        <Icon name="alert" class="w-3 h-3" />
        <span>Conflict detected</span>
      </div>
    </Transition>
    
    <!-- Last saved timestamp -->
    <Transition name="fade">
      <span 
        v-if="lastSavedTime && !saving && !saveError" 
        class="text-gray-400 dark:text-gray-500 text-xs"
        :title="`Last saved: ${lastSavedTime.toLocaleString()}`"
      >
        {{ formatRelativeTime(lastSavedTime) }}
      </span>
    </Transition>
    
    <!-- Auto-save indicator -->
    <Transition name="fade">
      <span
        v-if="autoSaveEnabled && !saving"
        class="text-gray-400 dark:text-gray-500 text-xs"
        title="Auto-save enabled"
      >
        <Icon name="refresh-cw" class="w-3 h-3" />
      </span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Icon } from '@iconify/vue';

interface Props {
  hasUnsavedChanges: boolean;
  saving: boolean;
  lastSavedTime?: Date | null;
  saveError?: Error | null;
  isConnected?: boolean;
  conflictDetected?: boolean;
  autoSaveEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isConnected: true,
  conflictDetected: false,
  autoSaveEnabled: true
});

const justSaved = ref(false);
const showSavedDuration = 2000; // Show "Saved" message for 2 seconds

// Watch for successful saves
watch(() => props.saving, (newSaving, oldSaving) => {
  if (oldSaving && !newSaving && !props.saveError) {
    justSaved.value = true;
    setTimeout(() => {
      justSaved.value = false;
    }, showSavedDuration);
  }
});

// Reset justSaved when error occurs
watch(() => props.saveError, (error) => {
  if (error) {
    justSaved.value = false;
  }
});

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};
</script>

<style scoped>
/* Fade transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Slide-fade transition */
.slide-fade-enter-active, .slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Pulsing animation for unsaved indicator */
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.save-status span:first-child {
  animation: pulse 2s ease-in-out infinite;
}
</style>