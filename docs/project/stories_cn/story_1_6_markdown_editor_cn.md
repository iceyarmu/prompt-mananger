# Story 1.6: 集成 Markdown 编辑器 - 棕地项目增量开发

## 用户故事

作为用户，
我想用富 markdown 编辑器编辑我的提示文件，
以便我能够高效地创建和修改提示。

## 故事背景

### 现有系统集成

- **集成对象：** 主内容区域、文件树选择、现有 Vue 组件系统
- **技术栈：** Vue 3.4+、md-editor-v3、TypeScript、Tailwind CSS
- **遵循模式：** 当前组件布局模式、现有工具栏模式
- **接触点：** 从树中选择文件、WebDAV 文件加载、状态管理

## 验收标准

### 功能需求

1. 在主内容区域集成 md-editor-v3 组件
2. 在树中选择文件时加载文件内容
3. 为所有标准 markdown 显示语法高亮
4. 提供预览模式切换（编辑/预览/分割）
5. 包含常见 markdown 操作的格式化工具栏
6. 支持常见语言的代码块语法高亮

### 集成需求

7. 编辑器填充主内容区域的可用空间
8. 编辑器主题匹配现有应用程序主题
9. 选择时从 WebDAV 加载文件内容
10. 在状态管理中跟踪未保存的更改
11. 编辑器在打字期间保持 60 FPS 性能

### 质量需求

12. 打字期间无延迟（< 50ms 输入延迟）
13. 大文件（最多 1MB）在 2 秒内加载
14. 语法高亮不阻塞打字
15. 使用 Ctrl+Z/Ctrl+Y 的撤销/重做功能
16. 使用 Ctrl+F/Ctrl+H 的搜索和替换

## 技术说明

### 集成方法
- 使用 md-editor-v3 Vue 3 组件
- 配置与现有样式的兼容性
- 与 Pinia editorStore 集成进行状态管理
- 使用现有文件加载模式

### 现有模式参考
- 遵循现有内容区域组件结构
- 使用相同的加载状态和指示器
- 应用一致的工具栏样式
- 匹配现有的键盘快捷键模式

### 关键约束
- 最大文件大小：10MB
- 语法高亮支持的语言：20+
- 必须支持表格、复选框和 mermaid 图表
- 每 30 秒自动保存草稿（Story 1.7）

## 实现细节

### 编辑器集成
```vue
<template>
  <div class="editor-container h-full flex flex-col">
    <!-- Editor Toolbar -->
    <div class="editor-toolbar border-b px-4 py-2 flex items-center gap-2">
      <span class="text-sm text-gray-600">{{ currentFile?.name || 'Untitled' }}</span>
      <span v-if="hasUnsavedChanges" class="text-xs text-orange-500">• Unsaved</span>
      <div class="ml-auto flex gap-2">
        <Button size="sm" variant="ghost" @click="togglePreview">
          <Icon :name="previewIcon" />
        </Button>
      </div>
    </div>
    
    <!-- Markdown Editor -->
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

### 编辑器配置
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

### 状态管理
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

## 完成定义

- ✅ md-editor-v3 成功集成和配置
- ✅ 从树中选择时文件在编辑器中加载
- ✅ Markdown 语法高亮正常工作
- ✅ 预览模式切换功能正常
- ✅ 格式化工具栏操作正常工作
- ✅ 代码块具有语法高亮
- ✅ 主题匹配应用程序主题
- ✅ 打字期间 60 FPS 性能
- ✅ 大文件在 2 秒内加载
- ✅ 撤销/重做正常工作
- ✅ 搜索/替换功能正常
- ✅ 编辑器操作的单元测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 大文件的编辑器性能
- **缓解措施：** 为大文档实现虚拟渲染
- **回滚方案：** 设置文件大小限制并提供警告

**次要风险：** 主题兼容性问题
- **缓解措施：** 自定义 CSS 覆盖以保持样式一致性
- **回滚方案：** 使用编辑器默认主题

### 兼容性验证

- ✅ 不对现有布局产生破坏性更改
- ✅ 不需要数据库更改
- ✅ UI 更改仅限于主内容区域
- ✅ 大文件的内存使用可接受
- ✅ 空闲时 CPU 使用最小

## 估算

**故事点数：** 5
**预估时间：** 8-10 小时
**依赖项：** Story 1.4 (文件树用于文件选择)

## 测试策略

### 单元测试
1. 内容加载和显示
2. 变更检测逻辑
3. 预览模式切换
4. 工具栏操作

### 集成测试
1. 文件选择触发内容加载
2. 内容变更正确跟踪
3. 主题切换正常工作
4. 键盘快捷键功能正常

### 性能测试
1. 打字延迟 < 50ms
2. 大文件加载 < 2s
3. 大文件的内存使用
4. 编辑期间的 CPU 使用

## 开发人员注意事项

- 查看 md-editor-v3 文档了解配置选项
- 考虑延迟加载编辑器以改善初始加载
- 为提示特定操作添加自定义工具栏按钮
- 在未来迭代中实现 markdown 语法检查
- 考虑为双文件编辑添加分割视图
- 为常见提示模式添加 markdown 片段
- 监控编辑器库对打包大小的影响