<template>
  <div class="legacy-app-content">
    <!-- Legacy component implementation -->
    <div class="deprecation-notice" v-if="showDeprecationNotice">
      ⚠️ This component is using the legacy system and will be removed in v3.0.0
    </div>
    <div class="content">
      <!-- Simplified legacy content -->
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @deprecated Since version 2.0.0. Will be removed in version 3.0.0. Use AppContent instead.
 * @see {@link /docs/migration/app-content.md} for migration guide
 */
import { ref, onMounted } from 'vue';
import { deprecationManager } from '../utils/deprecation';

const showDeprecationNotice = ref(import.meta.env.DEV);

onMounted(() => {
  // Log deprecation warning
  deprecationManager.checkDeprecation('AppContentLegacy');
  
  // Add console warning for developers
  if (import.meta.env.DEV) {
    console.warn(
      '%c⚠️ DEPRECATED COMPONENT',
      'background: #ff6b6b; color: white; padding: 2px 6px; border-radius: 3px;',
      '\nAppContentLegacy is deprecated and will be removed in v3.0.0.',
      '\nPlease migrate to the new AppContent component.',
      '\nMigration guide: /docs/migration/app-content.md'
    );
  }
});
</script>

<style scoped>
.legacy-app-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.deprecation-notice {
  background: #fff3cd;
  color: #856404;
  padding: 10px;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 14px;
}

.content {
  padding: 20px;
}
</style>