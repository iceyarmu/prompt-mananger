# Story 1.6: Integrate Markdown Editor - Brownfield Addition

## User Story

As a user,
I want to edit my prompt files with a rich markdown editor,
So that I can create and modify prompts efficiently.

## Story Context

### Existing System Integration

- **Integrates with:** Main content area, file tree selection, existing Vue component system
- **Technology:** Vue 3.4+, md-editor-v3, TypeScript, Tailwind CSS
- **Follows pattern:** Current component layout patterns, existing toolbar patterns
- **Touch points:** File selection from tree, WebDAV file loading, state management

## Acceptance Criteria

### Functional Requirements

1. Integrate md-editor-v3 component in the main content area
2. Load file content when file selected in tree
3. Display markdown syntax highlighting for all standard markdown
4. Provide preview mode toggle (edit/preview/split)
5. Include formatting toolbar with common markdown operations
6. Support code block syntax highlighting for common languages

### Integration Requirements

7. Editor fills available space in main content area
8. Editor theme matches existing application theme
9. File content loads from WebDAV when selected
10. Unsaved changes tracked in state management
11. Editor performance maintains 60 FPS during typing

### Quality Requirements

12. No lag during typing (< 50ms input latency)
13. Large files (up to 1MB) load within 2 seconds
14. Syntax highlighting doesn't block typing
15. Undo/redo functionality with Ctrl+Z/Ctrl+Y
16. Search and replace with Ctrl+F/Ctrl+H

## Technical Notes

### Integration Approach
- Use md-editor-v3 Vue 3 component
- Configure for compatibility with existing styles
- Integrate with Pinia editorStore for state
- Use existing file loading patterns

### Existing Pattern Reference
- Follow existing content area component structure
- Use same loading states and spinners
- Apply consistent toolbar styling
- Match existing keyboard shortcut patterns

### Key Constraints
- Maximum file size: 10MB
- Supported languages for syntax highlighting: 20+
- Must support tables, checkboxes, and mermaid diagrams
- Auto-save draft every 30 seconds (Story 1.7)

## Implementation Details

### Editor Integration
```vue
<template>
  <div class="editor-container h-full flex flex-col">
    <\!-- Editor Toolbar -->
    <div class="editor-toolbar border-b px-4 py-2 flex items-center gap-2">
      <span class="text-sm text-gray-600">{{ currentFile?.name || 'Untitled' }}</span>
      <span v-if="hasUnsavedChanges" class="text-xs text-orange-500">• Unsaved</span>
      <div class="ml-auto flex gap-2">
        <Button size="sm" variant="ghost" @click="togglePreview">
          <Icon :name="previewIcon" />
        </Button>
      </div>
    </div>
    
    <\!-- Markdown Editor -->
    <div class="flex-1 overflow-hidden">
      <MdEditor
        v-model="content"
        :theme="appTheme"
        :language="locale"
        :preview="previewMode"
        :toolbars="toolbarConfig"
        @onChange="handleContentChange"
        @onSave="handleSave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import MdEditor from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';

const toolbarConfig = [
  'bold', 'italic', 'strikeThrough', '|',
  'title', 'sub', 'sup', 'quote', 'unorderedList', 'orderedList', 'task', '|',
  'codeRow', 'code', 'link', 'image', 'table', 'mermaid', '|',
  'revoke', 'next', 'save', '|',
  '=',
  'pageFullscreen', 'fullscreen', 'preview', 'htmlPreview', 'catalog'
];
</script>
```

### Editor Configuration
```typescript
// editorConfig.ts
export const editorConfig = {
  // Theme configuration
  theme: {
    light: {
      primaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      textColor: '#1f2937'
    },
    dark: {
      primaryColor: '#60a5fa',
      backgroundColor: '#1f2937',
      textColor: '#f3f4f6'
    }
  },
  
  // Editor options
  options: {
    lineNumbers: true,
    wordWrap: 'on',
    fontSize: 14,
    tabSize: 2,
    insertSpaces: true,
    renderWhitespace: 'selection',
    minimap: { enabled: false },
    scrollBeyondLastLine: false
  },
  
  // Syntax highlighting languages
  languages: [
    'javascript', 'typescript', 'python', 'java', 'csharp',
    'cpp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
    'sql', 'html', 'css', 'json', 'yaml', 'markdown',
    'bash', 'powershell'
  ]
};
```

### State Management
```typescript
// editorStore.ts
interface EditorStore {
  currentFile: FileInfo | null;
  content: string;
  originalContent: string;
  hasUnsavedChanges: boolean;
  previewMode: 'edit' | 'preview' | 'split';
  cursorPosition: { line: number; column: number };
  
  // Actions
  loadFile(file: FileInfo): Promise<void>;
  updateContent(content: string): void;
  saveFile(): Promise<void>;
  togglePreview(): void;
  resetChanges(): void;
}
```

## Definition of Done

- ✅ md-editor-v3 successfully integrated and configured
- ✅ Files load in editor when selected from tree
- ✅ Markdown syntax highlighting working
- ✅ Preview mode toggle functional
- ✅ Formatting toolbar operations working
- ✅ Code blocks have syntax highlighting
- ✅ Theme matches application theme
- ✅ 60 FPS performance during typing
- ✅ Large files load within 2 seconds
- ✅ Undo/redo working properly
- ✅ Search/replace functional
- ✅ Unit tests for editor operations

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Editor performance with large files
- **Mitigation:** Implement virtual rendering for large documents
- **Rollback:** Set file size limit with warning

**Secondary Risk:** Theme compatibility issues
- **Mitigation:** Custom CSS overrides for consistent styling
- **Rollback:** Use editor default theme

### Compatibility Verification

- ✅ No breaking changes to existing layout
- ✅ No database changes required
- ✅ UI changes confined to main content area
- ✅ Memory usage acceptable for large files
- ✅ CPU usage minimal during idle

## Estimation

**Story Points:** 5
**Estimated Hours:** 8-10 hours
**Dependencies:** Story 1.4 (File Tree for file selection)

## Testing Strategy

### Unit Tests
1. Content loading and display
2. Change detection logic
3. Preview mode toggling
4. Toolbar operations

### Integration Tests
1. File selection triggers content load
2. Content changes tracked properly
3. Theme switching works
4. Keyboard shortcuts functional

### Performance Tests
1. Typing latency < 50ms
2. Large file loading < 2s
3. Memory usage with large files
4. CPU usage during editing

## Notes for Developer

- Review md-editor-v3 documentation for configuration options
- Consider lazy-loading editor to improve initial load
- Add custom toolbar buttons for prompt-specific operations
- Implement markdown linting in future iteration
- Consider adding split view for dual file editing
- Add markdown snippets for common prompt patterns
- Monitor bundle size impact of editor library
