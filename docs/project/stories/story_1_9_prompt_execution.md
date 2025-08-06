# Story 1.9: Implement Prompt Execution Feature - Brownfield Addition

## User Story

As a user,
I want to execute prompts directly from the editor,
So that I can test them immediately.

## Story Context

### Existing System Integration

- **Integrates with:** Existing AI model APIs, markdown editor, results panel
- **Technology:** Vue 3.4+, TypeScript, existing AI service integrations
- **Follows pattern:** Current API call patterns, result display patterns
- **Touch points:** Editor content, AI model services, results display area

## Acceptance Criteria

### Functional Requirements

1. Add "Execute" button to editor toolbar with model selector dropdown
2. Send current editor content to selected AI model
3. Display execution results in right panel or modal
4. Show loading state during execution
5. Support multiple AI models (OpenAI, Anthropic, etc.)
6. Display token usage and execution time

### Integration Requirements

7. Use existing AI model service integrations
8. API calls follow existing authentication patterns
9. Error handling consistent with current implementation
10. Results panel matches existing UI patterns
11. Model selection persists between sessions

### Quality Requirements

12. Execution response within API time limits
13. Clear indication of which model is being used
14. Proper error messages for API failures
15. Results are copyable and exportable
16. Handle rate limiting gracefully

## Technical Notes

### Integration Approach
- Leverage existing AI service integrations
- Use existing authentication/API key management
- Follow current result display patterns
- Maintain consistency with optimization feature

### Existing Pattern Reference
- Follow existing AI API call patterns
- Use same loading and error states
- Apply consistent result formatting
- Match existing model selection UI

### Key Constraints
- Respect API rate limits
- Maximum prompt size per model limits
- Response streaming for long outputs
- Cost tracking for API usage

## Implementation Details

### Execution Toolbar Component
```vue
<template>
  <div class="execution-toolbar flex items-center gap-2">
    <\!-- Model Selector -->
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
    
    <\!-- Execute Button -->
    <Button
      variant="primary"
      size="sm"
      @click="executePrompt"
      :disabled="\!content || executing"
      :loading="executing"
    >
      <Icon name="play" />
      <span>Execute</span>
    </Button>
    
    <\!-- Execution Options -->
    <Button
      variant="ghost"
      size="sm"
      @click="showOptions = \!showOptions"
    >
      <Icon name="settings" />
    </Button>
  </div>
</template>
```

### Execution Service
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

### Results Panel Component
```vue
<template>
  <div class="execution-results h-full flex flex-col">
    <\!-- Results Header -->
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
    
    <\!-- Results Content -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="streaming" class="streaming-content">
        <MarkdownRenderer :content="partialContent" />
        <span class="cursor-blink">▊</span>
      </div>
      
      <div v-else class="prose max-w-none">
        <MarkdownRenderer :content="result.content" />
      </div>
    </div>
    
    <\!-- Results Footer -->
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

### Model Configuration
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

## Definition of Done

- ✅ Execute button with model selector in toolbar
- ✅ Prompt execution working with multiple models
- ✅ Results display in panel with formatting
- ✅ Streaming support for long responses
- ✅ Token usage and cost tracking
- ✅ Loading states during execution
- ✅ Error handling with clear messages
- ✅ Copy and export functionality
- ✅ Model selection persistence
- ✅ Rate limiting handled gracefully
- ✅ Unit tests for execution logic
- ✅ Integration tests with mock APIs

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** API rate limiting and costs
- **Mitigation:** Usage tracking, warnings for large prompts
- **Rollback:** Disable execution temporarily

**Secondary Risk:** API key security
- **Mitigation:** Use existing secure key storage
- **Rollback:** Require key per session

### Compatibility Verification

- ✅ No changes to existing AI services
- ✅ No database changes required
- ✅ UI changes additive only
- ✅ Performance impact minimal
- ✅ Existing API integrations preserved

## Estimation

**Story Points:** 5
**Estimated Hours:** 8-10 hours
**Dependencies:** Story 1.6 (Editor), Existing AI services

## Testing Strategy

### Unit Tests
1. Execution service logic
2. Model selection and configuration
3. Token counting and cost calculation
4. Result formatting

### Integration Tests
1. Execute with different models
2. Streaming response handling
3. Error scenarios (rate limit, auth)
4. Results panel updates

### E2E Tests
1. Complete execution workflow
2. Model switching and persistence
3. Copy and export functionality
4. Long response handling

## Notes for Developer

- Ensure API keys are never logged
- Implement request debouncing for rapid executions
- Consider adding execution history
- Add temperature and max tokens controls
- Consider prompt templates for common use cases
- Monitor API costs and add budget alerts
- Add comparison mode for multiple models
- Consider local model support in future
