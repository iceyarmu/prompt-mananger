# Story 1.8: Connect Optimization Engine to Editor - Brownfield Addition

## User Story

As a user,
I want to optimize my prompts directly from the editor,
So that I can improve them without switching contexts.

## Story Context

### Existing System Integration

- **Integrates with:** Existing optimization engine, markdown editor, toolbar system
- **Technology:** Vue 3.4+, TypeScript, existing optimization service APIs
- **Follows pattern:** Current optimization workflow, API call patterns, result display
- **Touch points:** Editor content, optimization service, results panel, toolbar

## Acceptance Criteria

### Functional Requirements

1. Add "Optimize" button to editor toolbar
2. Button sends current editor content to optimization engine
3. Display optimization results in modal or side panel
4. Show before/after comparison view
5. Provide "Apply" button to replace content with optimized version
6. Preserve original version for undo capability

### Integration Requirements

7. Use existing optimization service without modifications
8. Optimization API calls follow existing patterns
9. Loading states consistent with current optimization UI
10. Error handling uses existing notification system
11. Performance characteristics unchanged from current implementation

### Quality Requirements

12. Optimization completes within current time limits
13. UI remains responsive during optimization
14. Clear indication of what will be optimized
15. Diff view highlights changes clearly
16. Original content recoverable via undo

## Technical Notes

### Integration Approach
- Call existing OptimizationService.optimize() method
- Use existing modal/panel components for results
- Preserve existing optimization configuration options
- Maintain backward compatibility with optimization API

### Existing Pattern Reference
- Follow current optimization UI workflow
- Use same loading spinners and progress indicators
- Apply consistent result formatting
- Match existing API error handling

### Key Constraints
- Cannot modify existing optimization engine
- Must preserve all current optimization options
- Response time must match current performance
- UI must not block during optimization

## Implementation Details

### Toolbar Integration
```vue
<template>
  <div class="editor-toolbar">
    <\!-- Other toolbar items -->
    
    <Button
      variant="primary"
      size="sm"
      @click="optimizeContent"
      :disabled="\!content || optimizing"
    >
      <Icon name="sparkles" />
      <span>Optimize</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
const optimizeContent = async () => {
  if (\!editorStore.content) return;
  
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

### Results Modal Component
```vue
<template>
  <BaseModal
    v-model="showResults"
    title="Optimization Results"
    size="xl"
  >
    <div class="optimization-results">
      <\!-- Stats Section -->
      <div class="stats-bar mb-4 p-3 bg-gray-50 rounded">
        <div class="flex justify-between text-sm">
          <span>Original: {{ originalLength }} chars</span>
          <span>Optimized: {{ optimizedLength }} chars</span>
          <span class="font-medium">
            {{ percentChange }}% {{ changeDirection }}
          </span>
        </div>
      </div>
      
      <\!-- Comparison View -->
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
      
      <\!-- Action Buttons -->
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

### Optimization Service Integration
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

### Optimization Options Panel
```vue
<template>
  <CollapsiblePanel title="Optimization Options" :collapsed="collapsed">
    <div class="optimization-options p-3">
      <\!-- Reuse existing optimization options UI -->
      <OptimizationOptionsForm
        v-model="options"
        :compact="true"
      />
    </div>
  </CollapsiblePanel>
</template>
```

## Definition of Done

- ✅ Optimize button added to editor toolbar
- ✅ Current content sent to optimization engine
- ✅ Results displayed in modal with comparison
- ✅ Split view and diff view working
- ✅ Apply button replaces editor content
- ✅ Original content preserved for undo
- ✅ Loading states during optimization
- ✅ Error handling with notifications
- ✅ Optimization options accessible
- ✅ Performance matches current implementation
- ✅ Unit tests for optimization flow
- ✅ Integration tests with real optimization service

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Breaking existing optimization functionality
- **Mitigation:** Use existing service without modifications
- **Rollback:** Remove toolbar button, retain original UI

**Secondary Risk:** User confusion with two optimization interfaces
- **Mitigation:** Clear labeling and consistent behavior
- **Rollback:** Hide one interface based on context

### Compatibility Verification

- ✅ No changes to optimization engine
- ✅ No database changes required
- ✅ UI changes additive only
- ✅ Performance unchanged
- ✅ Existing optimization UI still functional

## Estimation

**Story Points:** 3
**Estimated Hours:** 6-8 hours
**Dependencies:** Story 1.6 (Editor), Existing optimization service

## Testing Strategy

### Unit Tests
1. Optimization request formatting
2. Result processing logic
3. Undo/redo functionality
4. Options persistence

### Integration Tests
1. Optimize button triggers service
2. Results display correctly
3. Apply updates editor content
4. Undo restores original
5. Error handling works

### E2E Tests
1. Complete optimization workflow
2. Various content types optimized
3. Options affect optimization
4. Comparison views functional

## Notes for Developer

- Ensure optimization service is properly mocked in tests
- Consider caching optimization results
- Add keyboard shortcut for optimize (Ctrl+Shift+O)
- Consider inline optimization for selected text
- Add optimization history in future iteration
- Monitor API usage to prevent rate limiting
- Consider streaming results for large content
