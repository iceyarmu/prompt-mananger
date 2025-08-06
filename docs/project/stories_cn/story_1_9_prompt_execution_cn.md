# Story 1.9: 实现提示执行功能 - 棕地项目增量开发

## 用户故事

作为用户，
我想直接从编辑器执行提示，
以便我可以立即测试它们。

## 故事背景

### 现有系统集成

- **集成对象：** 现有 AI 模型 API、markdown 编辑器、结果面板
- **技术栈：** Vue 3.4+、TypeScript、现有 AI 服务集成
- **遵循模式：** 当前 API 调用模式、结果显示模式
- **接触点：** 编辑器内容、AI 模型服务、结果显示区域

## 验收标准

### 功能需求

1. 向编辑器工具栏添加带模型选择器下拉菜单的"执行"按钮
2. 将当前编辑器内容发送到选定的 AI 模型
3. 在右面板或模态中显示执行结果
4. 执行期间显示加载状态
5. 支持多个 AI 模型（OpenAI、Anthropic 等）
6. 显示令牌使用量和执行时间

### 集成需求

7. 使用现有的 AI 模型服务集成
8. API 调用遵循现有身份验证模式
9. 错误处理与当前实现一致
10. 结果面板匹配现有 UI 模式
11. 模型选择在会话间持久化

### 质量需求

12. 在 API 时间限制内执行响应
13. 清楚指示正在使用哪个模型
14. API 故障的适当错误消息
15. 结果可复制和导出
16. 优雅处理速率限制

## 技术说明

### 集成方法
- 利用现有的 AI 服务集成
- 使用现有的身份验证/API 密钥管理
- 遵循当前结果显示模式
- 保持与优化功能的一致性

### 现有模式参考
- 遵循现有 AI API 调用模式
- 使用相同的加载和错误状态
- 应用一致的结果格式化
- 匹配现有模型选择 UI

### 关键约束
- 尊重 API 速率限制
- 各模型的最大提示大小限制
- 长输出的响应流式传输
- API 使用成本跟踪

## 实现细节

### 执行工具栏组件
```vue
<template>
  <div class="execution-toolbar flex items-center gap-2">
    <!-- Model Selector -->
    <Select
      v-model="selectedModel"
      :options="availableModels"
      class="w-40"
    >
      <template #option="{ option }">
        <div class="flex items-center gap-2">
          <Icon :name="option.icon" class="w-4 h-4" />
          <span>{{ option.label }}</span>
        </div>
      </template>
    </Select>
    
    <!-- Execute Button -->
    <Button
      variant="primary"
      size="sm"
      @click="executePrompt"
      :disabled="!content || executing"
      :loading="executing"
    >
      <Icon name="play" />
      <span>Execute</span>
    </Button>
    
    <!-- Execution Options -->
    <Button
      variant="ghost"
      size="sm"
      @click="showOptions = !showOptions"
    >
      <Icon name="settings" />
    </Button>
  </div>
</template>
```

### 执行服务
```typescript
interface ExecutionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

class PromptExecutionService {
  async executePrompt(
    prompt: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get appropriate service based on model
      const service = this.getServiceForModel(options.model);
      
      // Execute with streaming support
      if (options.stream) {
        return await this.executeStreaming(service, prompt, options);
      }
      
      // Standard execution
      const response = await service.complete({
        prompt,
        model: options.model,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        system: options.systemPrompt
      });
      
      return {
        content: response.content,
        model: options.model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          cost: this.calculateCost(response.usage, options.model)
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };
      
    } catch (error) {
      return this.handleExecutionError(error);
    }
  }
  
  private async executeStreaming(
    service: AIService,
    prompt: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const stream = await service.streamComplete({
      prompt,
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.maxTokens
    });
    
    let content = '';
    for await (const chunk of stream) {
      content += chunk.content;
      // Emit partial results for UI update
      this.emit('partial', content);
    }
    
    return { content, /* ... other fields */ };
  }
}
```

### 结果面板组件
```vue
<template>
  <div class="execution-results h-full flex flex-col">
    <!-- Results Header -->
    <div class="results-header p-3 border-b flex justify-between">
      <div class="flex items-center gap-2">
        <Icon :name="modelIcon" class="w-4 h-4" />
        <span class="font-medium">{{ result.model }}</span>
        <span class="text-xs text-gray-500">
          {{ formatTime(result.executionTime) }}
        </span>
      </div>
      
      <div class="flex gap-2">
        <Button size="xs" variant="ghost" @click="copyResult">
          <Icon name="copy" />
        </Button>
        <Button size="xs" variant="ghost" @click="exportResult">
          <Icon name="download" />
        </Button>
      </div>
    </div>
    
    <!-- Results Content -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="streaming" class="streaming-content">
        <MarkdownRenderer :content="partialContent" />
        <span class="cursor-blink">▊</span>
      </div>
      
      <div v-else class="prose max-w-none">
        <MarkdownRenderer :content="result.content" />
      </div>
    </div>
    
    <!-- Results Footer -->
    <div class="results-footer p-3 border-t text-xs text-gray-600">
      <div class="flex justify-between">
        <span>Tokens: {{ result.usage.totalTokens }}</span>
        <span>Cost: ${{ result.usage.cost.toFixed(4) }}</span>
        <span>{{ formatTimestamp(result.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>
```

### 模型配置
```typescript
const modelConfigurations = {
  'gpt-4': {
    label: 'GPT-4',
    icon: 'openai',
    maxTokens: 8192,
    costPer1k: { prompt: 0.03, completion: 0.06 }
  },
  'gpt-3.5-turbo': {
    label: 'GPT-3.5 Turbo',
    icon: 'openai',
    maxTokens: 4096,
    costPer1k: { prompt: 0.001, completion: 0.002 }
  },
  'claude-3-opus': {
    label: 'Claude 3 Opus',
    icon: 'anthropic',
    maxTokens: 200000,
    costPer1k: { prompt: 0.015, completion: 0.075 }
  },
  'claude-3-sonnet': {
    label: 'Claude 3 Sonnet',
    icon: 'anthropic',
    maxTokens: 200000,
    costPer1k: { prompt: 0.003, completion: 0.015 }
  }
};
```

## 完成定义

- ✅ 工具栏中的执行按钮带模型选择器
- ✅ 提示执行与多个模型正常工作
- ✅ 结果在面板中显示并格式化
- ✅ 长响应的流式传输支持
- ✅ 令牌使用和成本跟踪
- ✅ 执行期间的加载状态
- ✅ 带清晰消息的错误处理
- ✅ 复制和导出功能
- ✅ 模型选择持久化
- ✅ 优雅处理速率限制
- ✅ 执行逻辑的单元测试
- ✅ 与模拟 API 的集成测试

## 风险和兼容性检查

### 风险评估

**主要风险：** API 速率限制和成本
- **缓解措施：** 使用跟踪、大提示警告
- **回滚方案：** 暂时禁用执行

**次要风险：** API 密钥安全性
- **缓解措施：** 使用现有安全密钥存储
- **回滚方案：** 每次会话需要密钥

### 兼容性验证

- ✅ 不更改现有 AI 服务
- ✅ 不需要数据库更改
- ✅ UI 更改仅为附加性质
- ✅ 性能影响最小
- ✅ 保留现有 API 集成

## 估算

**故事点数：** 5
**预估时间：** 8-10 小时
**依赖项：** Story 1.6 (编辑器)，现有 AI 服务

## 测试策略

### 单元测试
1. 执行服务逻辑
2. 模型选择和配置
3. 令牌计数和成本计算
4. 结果格式化

### 集成测试
1. 与不同模型执行
2. 流式响应处理
3. 错误场景（速率限制、身份验证）
4. 结果面板更新

### E2E 测试
1. 完整执行工作流
2. 模型切换和持久化
3. 复制和导出功能
4. 长响应处理

## 开发人员注意事项

- 确保 API 密钥永远不会被记录
- 为快速执行实现请求防抖
- 考虑添加执行历史
- 添加温度和最大令牌控制
- 考虑为常见用例添加提示模板
- 监控 API 成本并添加预算警报
- 添加多模型比较模式
- 考虑将来支持本地模型