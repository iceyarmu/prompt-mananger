# Component Documentation

## Overview

This guide documents all major UI components in the Prompt Optimizer application. Each component follows Vue 3 Composition API patterns and is designed for reusability and maintainability.

## Component Structure

### Standard Component Template

```vue
<template>
  <div class="component-name">
    <!-- Component content -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ComponentProps } from './types'

// Props definition
const props = defineProps<ComponentProps>()

// Emits definition
const emit = defineEmits<{
  'update:modelValue': [value: any]
  'change': [value: any]
}>()

// Component logic
</script>

<style scoped>
/* Component styles */
</style>
```

## Core Components

### FileTree

**Purpose**: Display and manage file system hierarchy with WebDAV integration.

**Props**:
```typescript
interface FileTreeProps {
  rootPath?: string
  showHidden?: boolean
  readOnly?: boolean
  maxDepth?: number
  filter?: (file: FileNode) => boolean
}
```

**Events**:
- `select`: Emitted when a file is selected
- `open`: Emitted when a file is opened
- `contextmenu`: Emitted on right-click
- `drop`: Emitted when files are dropped

**Usage**:
```vue
<FileTree
  :root-path="/prompts"
  :show-hidden="false"
  @select="handleFileSelect"
  @open="handleFileOpen"
/>
```

**Features**:
- Virtual scrolling for performance
- Drag and drop support
- Context menu integration
- Keyboard navigation
- Search functionality

### MarkdownEditor

**Purpose**: Advanced markdown editing with syntax highlighting and live preview.

**Props**:
```typescript
interface MarkdownEditorProps {
  modelValue: string
  readOnly?: boolean
  language?: string
  theme?: 'light' | 'dark'
  lineNumbers?: boolean
  wordWrap?: boolean
  fontSize?: number
  autoSave?: boolean
  autoSaveInterval?: number
}
```

**Events**:
- `update:modelValue`: Content change
- `save`: Manual save triggered
- `change`: Any change event
- `blur`: Editor loses focus
- `focus`: Editor gains focus

**Usage**:
```vue
<MarkdownEditor
  v-model="content"
  :auto-save="true"
  :auto-save-interval="30000"
  @save="handleSave"
/>
```

**Keyboard Shortcuts**:
- `Ctrl/Cmd + S`: Save
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Y`: Redo
- `Ctrl/Cmd + F`: Find
- `Ctrl/Cmd + H`: Replace

### OutputDisplay

**Purpose**: Display optimized results with diff view and export options.

**Props**:
```typescript
interface OutputDisplayProps {
  original?: string
  optimized?: string
  mode?: 'split' | 'unified' | 'inline'
  showDiff?: boolean
  showLineNumbers?: boolean
  highlightSyntax?: boolean
}
```

**Events**:
- `copy`: Content copied
- `export`: Export triggered
- `fullscreen`: Fullscreen toggled

**Usage**:
```vue
<OutputDisplay
  :original="originalPrompt"
  :optimized="optimizedPrompt"
  mode="split"
  :show-diff="true"
/>
```

### TemplateManager

**Purpose**: Manage and apply prompt templates.

**Props**:
```typescript
interface TemplateManagerProps {
  selectedTemplate?: string
  allowCustom?: boolean
  category?: string
  showBuiltIn?: boolean
  showCustom?: boolean
}
```

**Events**:
- `select`: Template selected
- `create`: New template created
- `update`: Template updated
- `delete`: Template deleted
- `apply`: Template applied

**Usage**:
```vue
<TemplateManager
  v-model:selected-template="selectedTemplateId"
  :allow-custom="true"
  @apply="applyTemplate"
/>
```

### ModelSelect

**Purpose**: Select and configure AI models.

**Props**:
```typescript
interface ModelSelectProps {
  modelValue?: string
  provider?: string
  showConfig?: boolean
  allowTest?: boolean
  filter?: (model: Model) => boolean
}
```

**Events**:
- `update:modelValue`: Model changed
- `test`: Test model requested
- `configure`: Configuration opened

**Usage**:
```vue
<ModelSelect
  v-model="selectedModel"
  :show-config="true"
  :allow-test="true"
  @test="testModel"
/>
```

### HistoryDrawer

**Purpose**: Display and manage prompt history.

**Props**:
```typescript
interface HistoryDrawerProps {
  visible?: boolean
  position?: 'left' | 'right'
  width?: string | number
  filter?: HistoryFilter
  limit?: number
}
```

**Events**:
- `select`: History item selected
- `delete`: Item deletion requested
- `clear`: Clear all history
- `export`: Export history

**Usage**:
```vue
<HistoryDrawer
  v-model:visible="showHistory"
  position="right"
  :limit="50"
  @select="loadHistoryItem"
/>
```

## Layout Components

### MainLayout

**Purpose**: Primary application layout with resizable panels.

**Slots**:
- `sidebar`: Left sidebar content
- `main`: Main content area
- `panel`: Right panel content
- `footer`: Footer content

**Usage**:
```vue
<MainLayout>
  <template #sidebar>
    <FileTree />
  </template>
  <template #main>
    <MarkdownEditor />
  </template>
  <template #panel>
    <OutputDisplay />
  </template>
</MainLayout>
```

### Panel

**Purpose**: Resizable panel component.

**Props**:
```typescript
interface PanelProps {
  size?: string | number
  minSize?: string | number
  maxSize?: string | number
  resizable?: boolean
  collapsible?: boolean
  collapsed?: boolean
}
```

**Usage**:
```vue
<Panel
  :size="300"
  :min-size="200"
  :max-size="500"
  :resizable="true"
  :collapsible="true"
>
  <PanelContent />
</Panel>
```

## Modal Components

### Modal

**Purpose**: Base modal component for dialogs.

**Props**:
```typescript
interface ModalProps {
  visible?: boolean
  title?: string
  width?: string | number
  closable?: boolean
  maskClosable?: boolean
  footer?: boolean
  loading?: boolean
}
```

**Slots**:
- `default`: Modal body content
- `header`: Custom header
- `footer`: Custom footer

**Usage**:
```vue
<Modal
  v-model:visible="showModal"
  title="Settings"
  :width="600"
  :closable="true"
>
  <SettingsForm />
  <template #footer>
    <button @click="save">Save</button>
    <button @click="cancel">Cancel</button>
  </template>
</Modal>
```

### DeleteConfirmDialog

**Purpose**: Confirmation dialog for delete operations.

**Props**:
```typescript
interface DeleteConfirmDialogProps {
  visible?: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}
```

**Usage**:
```vue
<DeleteConfirmDialog
  v-model:visible="showDeleteConfirm"
  title="Delete File"
  message="Are you sure you want to delete this file?"
  @confirm="deleteFile"
/>
```

## Form Components

### InputWithSelect

**Purpose**: Input field with dropdown selection.

**Props**:
```typescript
interface InputWithSelectProps {
  modelValue?: string
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  allowCustom?: boolean
}
```

**Usage**:
```vue
<InputWithSelect
  v-model="apiEndpoint"
  :options="predefinedEndpoints"
  placeholder="Enter API endpoint"
  :allow-custom="true"
/>
```

### SaveButton

**Purpose**: Save button with status indication.

**Props**:
```typescript
interface SaveButtonProps {
  saving?: boolean
  saved?: boolean
  modified?: boolean
  autoSave?: boolean
  disabled?: boolean
}
```

**Usage**:
```vue
<SaveButton
  :saving="isSaving"
  :saved="isSaved"
  :modified="hasChanges"
  @click="save"
/>
```

## Utility Components

### Toast

**Purpose**: Show notification messages.

**API**:
```typescript
import { useToast } from '@/composables/useToast'

const toast = useToast()

// Show different types
toast.success('Operation successful')
toast.error('An error occurred')
toast.warning('Please note')
toast.info('Information')

// With options
toast.show({
  type: 'success',
  message: 'File saved',
  duration: 3000,
  closable: true
})
```

### ContextMenu

**Purpose**: Right-click context menu.

**Props**:
```typescript
interface ContextMenuProps {
  items?: MenuItem[]
  visible?: boolean
  x?: number
  y?: number
}
```

**Usage**:
```vue
<ContextMenu
  v-model:visible="showContextMenu"
  :items="menuItems"
  :x="mouseX"
  :y="mouseY"
  @select="handleMenuSelect"
/>
```

### ThemeToggle

**Purpose**: Toggle between light and dark themes.

**Usage**:
```vue
<ThemeToggle />
```

**Composable**:
```typescript
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme, setTheme } = useTheme()

// Toggle theme
toggleTheme()

// Set specific theme
setTheme('dark')
```

## Composables

### useServices

Access core services from components.

```typescript
import { useServices } from '@/composables/useServices'

const services = useServices()

// Access services
const result = await services.prompt.optimize(text)
const history = await services.history.getAll()
```

### useStorage

Manage local storage.

```typescript
import { useStorage } from '@/composables/useStorage'

const storage = useStorage()

// Save data
await storage.set('key', value)

// Retrieve data
const value = await storage.get('key')

// Remove data
await storage.remove('key')
```

### useWebDAV

WebDAV file operations.

```typescript
import { useWebDAV } from '@/composables/useWebDAV'

const webdav = useWebDAV()

// List files
const files = await webdav.list('/path')

// Read file
const content = await webdav.read('/path/file.md')

// Write file
await webdav.write('/path/file.md', content)

// Delete file
await webdav.delete('/path/file.md')
```

### usePromptOptimizer

Prompt optimization operations.

```typescript
import { usePromptOptimizer } from '@/composables/usePromptOptimizer'

const optimizer = usePromptOptimizer()

// Optimize prompt
const result = await optimizer.optimize({
  prompt: text,
  mode: 'general',
  model: 'gpt-4'
})

// Execute prompt
const response = await optimizer.execute({
  prompt: text,
  model: 'gpt-3.5-turbo'
})
```

## Styling Guidelines

### CSS Variables

```css
/* Theme colors */
--primary-color: #007bff;
--secondary-color: #6c757d;
--success-color: #28a745;
--danger-color: #dc3545;
--warning-color: #ffc107;
--info-color: #17a2b8;

/* Layout */
--sidebar-width: 250px;
--header-height: 60px;
--footer-height: 40px;

/* Typography */
--font-family: 'Inter', sans-serif;
--font-size-base: 14px;
--line-height-base: 1.5;
```

### Component Classes

```css
/* BEM naming convention */
.component-name { }
.component-name__element { }
.component-name--modifier { }

/* State classes */
.is-active { }
.is-disabled { }
.is-loading { }
.has-error { }
```

## Testing Components

### Unit Testing

```typescript
import { mount } from '@vue/test-utils'
import Component from './Component.vue'

describe('Component', () => {
  it('renders correctly', () => {
    const wrapper = mount(Component, {
      props: {
        title: 'Test'
      }
    })
    
    expect(wrapper.text()).toContain('Test')
  })
  
  it('emits event on click', async () => {
    const wrapper = mount(Component)
    
    await wrapper.find('button').trigger('click')
    
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
```

### E2E Testing

```typescript
describe('Component E2E', () => {
  it('interacts correctly', () => {
    cy.visit('/component-page')
    
    cy.get('[data-testid="component"]').should('be.visible')
    cy.get('[data-testid="button"]').click()
    cy.get('[data-testid="result"]').should('contain', 'Success')
  })
})
```

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- Proper ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatibility
- Sufficient color contrast

---

*Last Updated: 2025-08-14*
*Component Library Version: 2.0.0*