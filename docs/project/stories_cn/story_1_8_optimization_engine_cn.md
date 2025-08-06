# Story 1.8: 将优化引擎连接到编辑器 - 棕地项目增量开发

## 用户故事

作为用户，
我想直接从编辑器优化我的提示，
以便我可以在不切换上下文的情况下改进它们。

## 故事背景

### 现有系统集成

- **集成对象：** 现有优化引擎、markdown 编辑器、工具栏系统
- **技术栈：** Vue 3.4+、TypeScript、现有优化服务 API
- **遵循模式：** 当前优化工作流、API 调用模式、结果显示
- **接触点：** 编辑器内容、优化服务、结果面板、工具栏

## 验收标准

### 功能需求

1. 向编辑器工具栏添加"优化"按钮
2. 按钮将当前编辑器内容发送到优化引擎
3. 在模态或侧面板中显示优化结果
4. 显示前后对比视图
5. 提供"应用"按钮以用优化版本替换内容
6. 保留原始版本以便撤销

### 集成需求

7. 不修改现有优化服务
8. 优化 API 调用遵循现有模式
9. 加载状态与当前优化 UI 一致
10. 错误处理使用现有通知系统
11. 性能特征与当前实现保持不变

### 质量需求

12. 优化在当前时间限制内完成
13. 优化期间 UI 保持响应
14. 清楚指示将被优化的内容
15. 差异视图清晰突出更改
16. 通过撤销可恢复原始内容

## 技术说明

### 集成方法
- 调用现有的 OptimizationService.optimize() 方法
- 使用现有的模态/面板组件显示结果
- 保留现有的优化配置选项
- 保持与优化 API 的向后兼容性

### 现有模式参考
- 遵循当前优化 UI 工作流
- 使用相同的加载指示器和进度指示器
- 应用一致的结果格式
- 匹配现有的 API 错误处理

### 关键约束
- 不能修改现有优化引擎
- 必须保留所有当前优化选项
- 响应时间必须匹配当前性能
- UI 在优化期间不得阻塞

## 实现细节

### 工具栏集成
```vue
<template>
  <div class="editor-toolbar">
    <!-- Other toolbar items -->
    
    <Button
      variant="primary"
      size="sm"
      @click="optimizeContent"
      :disabled="!content || optimizing"
    >
      <Icon name="sparkles" />
      <span>Optimize</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
const optimizeContent = async () => {
  if (!editorStore.content) return;
  
  optimizing.value = true;
  originalContent.value = editorStore.content;
  
  try {
    const result = await optimizationService.optimize({
      content: editorStore.content,
      type: 'prompt',
      options: optimizationStore.currentOptions
    });
    
    showOptimizationResults(result);
  } catch (error) {
    showNotification('Optimization failed', 'error');
  } finally {
    optimizing.value = false;
  }
};
</script>
```

### 结果模态组件
```vue
<template>
  <BaseModal
    v-model="showResults"
    title="Optimization Results"
    size="xl"
  >
    <div class="optimization-results">
      <!-- Stats Section -->
      <div class="stats-bar mb-4 p-3 bg-gray-50 rounded">
        <div class="flex justify-between text-sm">
          <span>Original: {{ originalLength }} chars</span>
          <span>Optimized: {{ optimizedLength }} chars</span>
          <span class="font-medium">
            {{ percentChange }}% {{ changeDirection }}
          </span>
        </div>
      </div>
      
      <!-- Comparison View -->
      <div class="comparison-view">
        <Tabs v-model="viewMode">
          <TabList>
            <Tab value="split">Split View</Tab>
            <Tab value="diff">Diff View</Tab>
            <Tab value="optimized">Optimized Only</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel value="split">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <h3 class="font-medium mb-2">Original</h3>
                  <div class="prose max-w-none">
                    {{ original }}
                  </div>
                </div>
                <div>
                  <h3 class="font-medium mb-2">Optimized</h3>
                  <div class="prose max-w-none">
                    {{ optimized }}
                  </div>
                </div>
              </div>
            </TabPanel>
            
            <TabPanel value="diff">
              <DiffViewer
                :original="original"
                :modified="optimized"
                :inline="true"
              />
            </TabPanel>
            
            <TabPanel value="optimized">
              <div class="prose max-w-none">
                {{ optimized }}
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex justify-end gap-3 mt-6">
        <Button variant="secondary" @click="closeResults">
          Cancel
        </Button>
        <Button variant="primary" @click="applyOptimization">
          Apply Optimization
        </Button>
      </div>
    </div>
  </BaseModal>
</template>
```

### 优化服务集成
```typescript
// Wrapper for existing optimization service
class EditorOptimizationHandler {
  private originalContent: string = '';
  
  async optimizeCurrentContent(): Promise<OptimizationResult> {
    const content = editorStore.content;
    this.originalContent = content;
    
    // Use existing optimization service
    const result = await optimizationService.optimize({
      text: content,
      mode: optimizationStore.mode,
      model: optimizationStore.selectedModel,
      options: {
        preserveFormatting: true,
        maintainLength: optimizationStore.maintainLength,
        tone: optimizationStore.tone,
        ...optimizationStore.advancedOptions
      }
    });
    
    return {
      original: this.originalContent,
      optimized: result.optimizedText,
      metrics: result.metrics,
      suggestions: result.suggestions
    };
  }
  
  applyOptimization(optimizedContent: string): void {
    // Store original for undo
    editorStore.pushToUndoStack(this.originalContent);
    
    // Apply optimized content
    editorStore.updateContent(optimizedContent);
    editorStore.markAsModified();
    
    showNotification('Optimization applied', 'success');
  }
  
  revertOptimization(): void {
    editorStore.updateContent(this.originalContent);
    showNotification('Reverted to original', 'info');
  }
}
```

### 优化选项面板
```vue
<template>
  <CollapsiblePanel title="Optimization Options" :collapsed="collapsed">
    <div class="optimization-options p-3">
      <!-- Reuse existing optimization options UI -->
      <OptimizationOptionsForm
        v-model="options"
        :compact="true"
      />
    </div>
  </CollapsiblePanel>
</template>
```

## 完成定义

- ✅ 编辑器工具栏添加优化按钮
- ✅ 当前内容发送到优化引擎
- ✅ 结果在模态中显示并带对比
- ✅ 分割视图和差异视图正常工作
- ✅ 应用按钮替换编辑器内容
- ✅ 保留原始内容以供撤销
- ✅ 优化期间的加载状态
- ✅ 带通知的错误处理
- ✅ 优化选项可访问
- ✅ 性能匹配当前实现
- ✅ 优化流程的单元测试
- ✅ 与真实优化服务的集成测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 破坏现有优化功能
- **缓解措施：** 不修改现有服务
- **回滚方案：** 移除工具栏按钮，保留原始 UI

**次要风险：** 用户对两个优化界面感到困惑
- **缓解措施：** 清晰标注和一致行为
- **回滚方案：** 根据上下文隐藏一个界面

### 兼容性验证

- ✅ 不更改优化引擎
- ✅ 不需要数据库更改
- ✅ UI 更改仅为附加性质
- ✅ 性能未改变
- ✅ 现有优化 UI 仍然功能正常

## 估算

**故事点数：** 3
**预估时间：** 6-8 小时
**依赖项：** Story 1.6 (编辑器)，现有优化服务

## 测试策略

### 单元测试
1. 优化请求格式化
2. 结果处理逻辑
3. 撤销/重做功能
4. 选项持久化

### 集成测试
1. 优化按钮触发服务
2. 结果正确显示
3. 应用更新编辑器内容
4. 撤销恢复原始内容
5. 错误处理正常工作

### E2E 测试
1. 完整优化工作流
2. 优化各种内容类型
3. 选项影响优化
4. 对比视图功能正常

## 开发人员注意事项

- 确保在测试中正确模拟优化服务
- 考虑缓存优化结果
- 为优化添加键盘快捷键（Ctrl+Shift+O）
- 考虑为选中文本进行内联优化
- 在将来的迭代中添加优化历史
- 监控 API 使用以防止速率限制
- 考虑为大内容实现流式结果