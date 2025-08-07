<template>
  <Suspense>
    <template #default>
      <component 
        :is="editorComponent"
        v-bind="$attrs"
      />
    </template>
    <template #fallback>
      <div class="editor-loading">
        <div class="loading-spinner"></div>
        <p>{{ $t('editor.loadingEditor', 'Loading editor...') }}</p>
      </div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import { defineAsyncComponent, computed } from 'vue';
import { useEditorStore } from '../composables/editorStore';

// Check if we need virtual scrolling based on file size
const editorStore = useEditorStore();

const useVirtualScrolling = computed(() => {
  // Use virtual scrolling for files with more than 1000 lines
  const lineCount = editorStore.content.split('\n').length;
  return lineCount > 1000;
});

// Lazy load the appropriate editor component
const editorComponent = computed(() => {
  if (useVirtualScrolling.value) {
    // Lazy load virtual editor for large files
    return defineAsyncComponent({
      loader: () => import('./VirtualMarkdownEditor.vue'),
      delay: 200,
      timeout: 10000,
      onError(error, retry, fail) {
        console.error('Failed to load virtual editor:', error);
        // Fallback to regular editor on error
        return import('./MarkdownEditor.vue');
      }
    });
  } else {
    // Lazy load regular editor for normal files
    return defineAsyncComponent({
      loader: () => import('./MarkdownEditor.vue'),
      delay: 200,
      timeout: 10000
    });
  }
});
</script>

<style scoped>
.editor-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.editor-loading p {
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}

.dark .editor-loading p {
  color: #aaa;
}

.dark .loading-spinner {
  border-color: #444;
  border-top-color: #3498db;
}
</style>