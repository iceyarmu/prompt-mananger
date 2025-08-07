<template>
  <EditorErrorBoundary>
    <div class="markdown-editor-container flex flex-col h-full">
      <!-- Editor Header -->
      <div class="editor-header flex items-center justify-between p-3 border-b theme-header">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ currentFileName }}</span>
          <span v-if="hasUnsavedChanges" class="text-orange-500 text-xs">● {{ $t('editor.unsavedIndicator') }}</span>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            v-for="mode in viewModes"
            :key="mode.value"
            :class="[
              'px-2 py-1 text-xs rounded transition-colors',
              currentViewMode === mode.value 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            ]"
            :aria-label="`Switch to ${mode.label} view`"
            :aria-pressed="currentViewMode === mode.value"
            @click="setViewMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>
      
      <!-- Loading Progress Bar -->
      <div v-if="loading && loadProgress > 0 && loadProgress < 100" class="loading-progress-bar px-3 py-2 bg-blue-50 dark:bg-blue-900/20">
        <div class="flex items-center gap-3">
          <span class="text-sm text-blue-700 dark:text-blue-300">{{ $t('editor.loadingFile', 'Loading file...') }}</span>
          <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-blue-500 transition-all duration-300 ease-out"
              :style="{ width: `${loadProgress}%` }"
            ></div>
          </div>
          <span class="text-sm font-medium text-blue-700 dark:text-blue-300">{{ loadProgress }}%</span>
        </div>
      </div>
      
      <!-- Editor Content -->
      <div class="flex-1 overflow-hidden">
        <MdEditor
          v-model="content"
          :theme="editorTheme"
          :language="currentLocale"
          :preview="currentViewMode !== 'edit'"
          :preview-only="currentViewMode === 'preview'"
          :toolbars="toolbarConfig"
          :code-theme="codeTheme"
          @on-change="handleContentChange"
          @on-save="handleSave"
          @on-upload-img="handleImageUpload"
        />
      </div>
    </div>
  </EditorErrorBoundary>
</template>

<script setup lang="ts">
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { useMarkdownEditor } from '../composables/useMarkdownEditor';
import EditorErrorBoundary from './EditorErrorBoundary.vue';

const {
  content,
  currentFileName,
  hasUnsavedChanges,
  currentViewMode,
  viewModes,
  editorTheme,
  codeTheme,
  currentLocale,
  toolbarConfig,
  loading,
  loadProgress,
  handleContentChange,
  handleSave,
  handleImageUpload,
  setViewMode
} = useMarkdownEditor();
</script>

<style scoped>
.markdown-editor-container {
  width: 100%;
  height: 100%;
  background: var(--color-background);
}

.editor-header {
  background: var(--color-background-secondary);
  border-color: var(--color-border);
}

:deep(.md-editor) {
  --md-color: var(--color-text-primary);
  --md-hover-color: var(--color-text-secondary);
  --md-bk-color: var(--color-background);
  --md-bk-hover-color: var(--color-background-secondary);
  --md-border-color: var(--color-border);
  height: 100%;
}

:deep(.md-editor-dark) {
  --md-color: var(--color-text-primary);
  --md-hover-color: var(--color-text-secondary);
  --md-bk-color: var(--color-background);
  --md-bk-hover-color: var(--color-background-secondary);
  --md-border-color: var(--color-border);
}
</style>