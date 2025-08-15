<template>
  <div class="system-router">
    <TransitionGroup 
      name="system-switch" 
      mode="out-in"
      @before-leave="handleBeforeLeave"
      @after-enter="handleAfterEnter"
    >
      <!-- New System Components -->
      <component 
        v-if="isNewSystem"
        :is="currentComponent"
        :key="'new-' + componentKey"
        v-bind="componentProps"
        @load-error="handleComponentError"
      />
      
      <!-- Old System Components (Fallback) -->
      <component 
        v-else
        :is="legacyComponent"
        :key="'old-' + componentKey"
        v-bind="componentProps"
        @load-error="handleLegacyError"
      />
    </TransitionGroup>
    
    <!-- System Switch Indicator (Dev Mode) -->
    <div 
      v-if="showSystemIndicator" 
      class="system-indicator"
      :class="{ 'new-system': isNewSystem, 'old-system': !isNewSystem }"
    >
      <span>{{ systemLabel }}</span>
      <span class="variant">{{ userVariant }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent, shallowRef } from 'vue';
import { useStoreCommunication } from '../stores/communication';
import type { Component } from 'vue';

// Simple feature flag implementation
const useFeatureFlags = () => {
  const flags = ref<Record<string, boolean>>({
    new_platform_enabled: false
  });
  
  return {
    isEnabled: (flag: string) => flags.value[flag] || false,
    onFlagChange: (flag: string, callback: (enabled: boolean) => void) => {
      // Simple stub implementation
      watch(() => flags.value[flag], callback);
      return () => {}; // unsubscribe function
    }
  };
};

interface Props {
  componentName: string;
  componentProps?: Record<string, any>;
  showIndicator?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  componentProps: () => ({}),
  showIndicator: false
});

const emit = defineEmits<{
  'system-switched': [system: 'old' | 'new'];
  'component-error': [error: Error];
  'fallback-triggered': [reason: string];
}>();

const featureFlags = useFeatureFlags();
const { emit: storeEmit } = useStoreCommunication();

// State
const isNewSystem = ref(false);
const userVariant = ref<string>('control');
const componentKey = ref(0);
const loadError = ref<Error | null>(null);
const fallbackActive = ref(false);
const transitionInProgress = ref(false);

// Dynamic component refs
const currentComponent = shallowRef<Component | null>(null);
const legacyComponent = shallowRef<Component | null>(null);

// Computed
const systemLabel = computed(() => isNewSystem.value ? 'New Platform' : 'Legacy System');
const showSystemIndicator = computed(() => 
  props.showIndicator || import.meta.env.DEV
);

// Component mapping for new system
const newSystemComponents: Record<string, () => Promise<any>> = {
  'AppContent': () => import('../AppContent.vue'),
  'FileTree': () => import('@prompt-optimizer/ui').then(m => m.FileTree),
  'MarkdownEditor': () => import('@prompt-optimizer/ui').then(m => m.MarkdownEditor),
  'AppLayout': () => import('./AppLayout.vue'),
  // Add more component mappings as needed
};

// Component mapping for old system (legacy)
const oldSystemComponents: Record<string, () => Promise<any>> = {
  'AppContent': () => import('../legacy/AppContentLegacy.vue'),
  'FileTree': () => import('../legacy/FileTreeLegacy.vue'),
  'MarkdownEditor': () => import('../legacy/MarkdownEditorLegacy.vue'),
  'AppLayout': () => import('../legacy/AppLayoutLegacy.vue'),
  // Add more legacy component mappings as needed
};

// Watch for feature flag changes
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  checkSystemState();
  
  // Subscribe to feature flag changes
  unsubscribe = featureFlags.onFlagChange('new_platform_enabled', (enabled: boolean) => {
    handleSystemSwitch(enabled);
  });
  
  // Load initial components
  loadComponents();
  
  // Track initial system state
  trackSystemUsage();
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

// Check current system state
function checkSystemState() {
  isNewSystem.value = featureFlags.isNewPlatformEnabled();
  userVariant.value = featureFlags.getCutoverVariant();
  
  // Get A/B test variant for tracking
  const abVariant = featureFlags.getVariant('cutover_experiment');
  storeEmit('analytics', 'track', {
    event: 'system_state_checked',
    properties: {
      system: isNewSystem.value ? 'new' : 'old',
      variant: userVariant.value,
      abVariant,
      component: props.componentName
    }
  });
}

// Handle system switch
async function handleSystemSwitch(useNewSystem: boolean) {
  if (transitionInProgress.value) {
    console.warn('System switch already in progress');
    return;
  }
  
  transitionInProgress.value = true;
  const previousSystem = isNewSystem.value ? 'new' : 'old';
  
  try {
    // Update system state
    isNewSystem.value = useNewSystem;
    userVariant.value = featureFlags.getCutoverVariant();
    
    // Reload components for new system
    await loadComponents();
    
    // Increment key to force re-render
    componentKey.value++;
    
    // Emit system switch event
    emit('system-switched', isNewSystem.value ? 'new' : 'old');
    
    // Track system switch
    storeEmit('analytics', 'track', {
      event: 'system_switched',
      properties: {
        from: previousSystem,
        to: isNewSystem.value ? 'new' : 'old',
        component: props.componentName,
        timestamp: Date.now()
      }
    });
    
    // Log for monitoring
    console.log(`System switched from ${previousSystem} to ${isNewSystem.value ? 'new' : 'old'}`);
    
  } catch (error) {
    console.error('Error during system switch:', error);
    handleSwitchError(error as Error, previousSystem);
  } finally {
    transitionInProgress.value = false;
  }
}

// Load components based on current system
async function loadComponents() {
  try {
    if (isNewSystem.value) {
      // Load new system component
      const loader = newSystemComponents[props.componentName];
      if (loader) {
        currentComponent.value = defineAsyncComponent({
          loader,
          errorComponent: ErrorFallback,
          delay: 200,
          timeout: 10000,
          onError(error, retry, fail) {
            handleComponentError(error);
            fail();
          }
        });
      } else {
        throw new Error(`Component ${props.componentName} not found in new system`);
      }
    } else {
      // Load legacy component
      const loader = oldSystemComponents[props.componentName];
      if (loader) {
        legacyComponent.value = defineAsyncComponent({
          loader,
          errorComponent: ErrorFallback,
          delay: 200,
          timeout: 10000,
          onError(error, retry, fail) {
            handleLegacyError(error);
            fail();
          }
        });
      } else {
        // If legacy component doesn't exist, use new system component as fallback
        console.warn(`Legacy component ${props.componentName} not found, using new system`);
        await loadNewSystemFallback();
      }
    }
  } catch (error) {
    console.error('Failed to load components:', error);
    loadError.value = error as Error;
    emit('component-error', error as Error);
  }
}

// Load new system component as fallback
async function loadNewSystemFallback() {
  const loader = newSystemComponents[props.componentName];
  if (loader) {
    legacyComponent.value = defineAsyncComponent({
      loader,
      errorComponent: ErrorFallback,
      delay: 200,
      timeout: 10000
    });
  }
}

// Handle component load error
function handleComponentError(error: Error) {
  console.error('New system component error:', error);
  loadError.value = error;
  
  // Track error
  storeEmit('analytics', 'track', {
    event: 'component_load_error',
    properties: {
      system: 'new',
      component: props.componentName,
      error: error.message
    }
  });
  
  // Attempt fallback to old system
  if (!fallbackActive.value) {
    fallbackActive.value = true;
    emit('fallback-triggered', 'component_error');
    handleSystemSwitch(false);
  }
}

// Handle legacy component error
function handleLegacyError(error: Error) {
  console.error('Legacy system component error:', error);
  loadError.value = error;
  
  // Track error
  storeEmit('analytics', 'track', {
    event: 'component_load_error',
    properties: {
      system: 'old',
      component: props.componentName,
      error: error.message
    }
  });
  
  emit('component-error', error);
}

// Handle switch error
function handleSwitchError(error: Error, previousSystem: string) {
  // Revert to previous system
  isNewSystem.value = previousSystem === 'new';
  
  // Track error
  storeEmit('analytics', 'track', {
    event: 'system_switch_error',
    properties: {
      attemptedSystem: previousSystem === 'new' ? 'old' : 'new',
      error: error.message,
      component: props.componentName
    }
  });
  
  // Notify user
  storeEmit('notification', 'error', {
    message: 'Failed to switch system. Reverting to previous state.',
    duration: 5000
  });
}

// Transition handlers
function handleBeforeLeave() {
  // Track transition start
  storeEmit('analytics', 'track', {
    event: 'system_transition_start',
    properties: {
      from: isNewSystem.value ? 'old' : 'new',
      to: isNewSystem.value ? 'new' : 'old',
      component: props.componentName
    }
  });
}

function handleAfterEnter() {
  // Track transition complete
  storeEmit('analytics', 'track', {
    event: 'system_transition_complete',
    properties: {
      system: isNewSystem.value ? 'new' : 'old',
      component: props.componentName
    }
  });
}

// Track system usage
function trackSystemUsage() {
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      storeEmit('analytics', 'track', {
        event: 'system_usage',
        properties: {
          system: isNewSystem.value ? 'new' : 'old',
          component: props.componentName,
          duration: 30000 // 30 second intervals
        }
      });
    }
  }, 30000);
  
  onUnmounted(() => {
    clearInterval(interval);
  });
}

// Error fallback component
const ErrorFallback = {
  template: `
    <div class="error-fallback">
      <h3>Component Load Error</h3>
      <p>Failed to load {{ componentName }}</p>
      <button @click="$emit('retry')">Retry</button>
    </div>
  `,
  props: ['componentName']
};
</script>

<style scoped>
.system-router {
  position: relative;
  width: 100%;
  height: 100%;
}

.system-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.8;
  transition: opacity 0.3s;
}

.system-indicator:hover {
  opacity: 1;
}

.system-indicator.new-system {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.system-indicator.old-system {
  background: #6b7280;
  color: white;
}

.variant {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
}

/* Transition animations */
.system-switch-enter-active,
.system-switch-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.system-switch-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.system-switch-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.error-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  text-align: center;
}

.error-fallback h3 {
  color: #ef4444;
  margin-bottom: 10px;
}

.error-fallback button {
  margin-top: 20px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-fallback button:hover {
  background: #2563eb;
}
</style>