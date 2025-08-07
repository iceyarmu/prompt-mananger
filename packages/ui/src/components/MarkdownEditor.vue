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
          
          <!-- Optimize Button -->
          <div class="ml-2 pl-2 border-l border-gray-300 dark:border-gray-600 flex items-center gap-1">
            <button
              :class="[
                'px-3 py-1 text-xs rounded transition-colors flex items-center gap-1',
                !content || optimizing
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              ]"
              :disabled="!content || optimizing"
              :aria-label="$t('editor.optimize', 'Optimize')"
              @click="openOptimizationModal"
            >
              <svg v-if="!optimizing" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <svg v-else class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ optimizing ? $t('editor.optimizing', 'Optimizing...') : $t('editor.optimize', 'Optimize') }}</span>
            </button>
            
            <!-- Optimization Options -->
            <OptimizationOptionsPopover
              :optimizationMode="optimizationMode"
              :selectedModel="selectedModel"
              :selectedTemplate="selectedTemplate"
              @update:optimizationMode="setOptimizationMode"
              @update:selectedModel="setSelectedModel"
              @update:selectedTemplate="setSelectedTemplate"
            />
          </div>
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
    
    <!-- Optimization Results Modal -->
    <OptimizationResultsModal
      v-if="showOptimizationModal"
      :visible="showOptimizationModal"
      :result="optimizationResult"
      @update:visible="showOptimizationModal = $event"
      @apply="applyOptimization"
    />
  </EditorErrorBoundary>
</template>

<script setup lang="ts">
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { ref } from 'vue';
import { useMarkdownEditor } from '../composables/useMarkdownEditor';
import { useEditorOptimization } from '../composables/useEditorOptimization';
import EditorErrorBoundary from './EditorErrorBoundary.vue';
import OptimizationResultsModal from './OptimizationResultsModal.vue';
import OptimizationOptionsPopover from './OptimizationOptionsPopover.vue';

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

// Optimization integration
const {
  optimizing,
  showOptimizationModal,
  optimizationResult,
  optimizationMode,
  selectedModel,
  selectedTemplate,
  openOptimizationModal,
  applyOptimization,
  setOptimizationMode,
  setSelectedModel,
  setSelectedTemplate
} = useEditorOptimization(content);
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