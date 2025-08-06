# Story 1.7: Implement File Persistence and Auto-save - Brownfield Addition

## User Story

As a user,
I want my changes to be saved automatically and manually,
So that I don't lose my work.

## Story Context

### Existing System Integration

- **Integrates with:** Markdown editor, WebDAVService, existing notification system
- **Technology:** Vue 3.4+, TypeScript, Pinia stores, WebDAV API
- **Follows pattern:** Current save patterns, notification patterns, keyboard shortcuts
- **Touch points:** Editor content changes, WebDAV save operations, UI feedback

## Acceptance Criteria

### Functional Requirements

1. Manual save triggered by Ctrl+S (Cmd+S on Mac) keyboard shortcut
2. Manual save available via toolbar button
3. Auto-save triggers after 30 seconds of inactivity (configurable)
4. Display "Saving..." indicator during save operation
5. Show "Saved" confirmation after successful save
6. Display unsaved changes indicator (dot or asterisk) in UI

### Integration Requirements

7. Save operations use WebDAVService.putFile method
8. Editor content syncs with save operations
9. Concurrent edit detection with last-modified checking
10. Save errors display in existing notification system
11. Auto-save can be disabled in settings

### Quality Requirements

12. Save operation completes within 2 seconds for files < 1MB
13. No data loss during save failures (keep local copy)
14. Retry logic for network failures (3 attempts)
15. Debounced auto-save to prevent excessive saves
16. Clear indication of sync status in UI

## Technical Notes

### Integration Approach
- Use Pinia store for save state management
- Integrate with existing keyboard shortcut system
- Use WebDAVService for file operations
- Apply existing notification patterns for feedback

### Existing Pattern Reference
- Follow existing save patterns from optimization feature
- Use same loading/success indicators
- Apply consistent keyboard shortcut registration
- Match existing error notification style

### Key Constraints
- Auto-save interval: 30-300 seconds (user configurable)
- Maximum retry attempts: 3
- Conflict resolution: Last write wins (MVP)
- Local backup kept until save confirmed

## Implementation Details

### Save Manager Implementation
```typescript
class SaveManager {
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private saveInProgress = false;
  private retryCount = 0;
  
  async saveFile(content: string, path: string): Promise<void> {
    if (this.saveInProgress) return;
    
    this.saveInProgress = true;
    editorStore.setSaveStatus('saving');
    
    try {
      // Check for concurrent modifications
      const fileInfo = await webdavService.getFileInfo(path);
      if (fileInfo.modified > editorStore.lastKnownModified) {
        const proceed = await this.handleConflict(fileInfo);
        if (\!proceed) return;
      }
      
      // Save to WebDAV
      await webdavService.putFile(path, content);
      
      // Update state
      editorStore.markAsSaved();
      editorStore.lastKnownModified = new Date();
      showNotification('File saved', 'success', 2000);
      
    } catch (error) {
      await this.handleSaveError(error, content, path);
    } finally {
      this.saveInProgress = false;
      editorStore.setSaveStatus('idle');
    }
  }
  
  setupAutoSave(interval: number = 30000): void {
    this.clearAutoSave();
    
    this.autoSaveTimer = setInterval(() => {
      if (editorStore.hasUnsavedChanges && \!this.saveInProgress) {
        this.saveFile(
          editorStore.content,
          editorStore.currentFile.path
        );
      }
    }, interval);
  }
  
  private async handleSaveError(
    error: Error,
    content: string,
    path: string
  ): Promise<void> {
    if (this.retryCount < 3) {
      this.retryCount++;
      showNotification('Save failed, retrying...', 'warning');
      await sleep(1000 * this.retryCount);
      return this.saveFile(content, path);
    }
    
    // Save to local storage as backup
    localStorage.setItem(`backup_${path}`, content);
    showNotification(
      'Save failed. Local backup created.',
      'error',
      0,
      [{
        label: 'Retry',
        action: () => this.saveFile(content, path)
      }]
    );
  }
}
```

### Auto-save Configuration
```vue
<template>
  <div class="auto-save-settings">
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        v-model="autoSaveEnabled"
        @change="toggleAutoSave"
      />
      <span>Enable auto-save</span>
    </label>
    
    <div v-if="autoSaveEnabled" class="mt-2">
      <label class="block text-sm">
        Auto-save interval (seconds):
        <input
          type="number"
          v-model.number="autoSaveInterval"
          min="30"
          max="300"
          step="30"
          @change="updateInterval"
          class="ml-2 w-20"
        />
      </label>
    </div>
  </div>
</template>
```

### Keyboard Shortcut Registration
```typescript
// Register save shortcut
useKeyboardShortcut({
  key: 's',
  ctrl: true,
  action: () => saveManager.saveFile(
    editorStore.content,
    editorStore.currentFile?.path
  ),
  description: 'Save file'
});
```

### UI Status Indicators
```vue
<template>
  <div class="save-status flex items-center gap-2">
    <\!-- Unsaved indicator -->
    <span
      v-if="hasUnsavedChanges"
      class="text-orange-500"
      title="Unsaved changes"
    >
      •
    </span>
    
    <\!-- Save status -->
    <span class="text-xs text-gray-500">
      <template v-if="saveStatus === 'saving'">
        <Spinner size="xs" /> Saving...
      </template>
      <template v-else-if="saveStatus === 'saved'">
        ✓ Saved
      </template>
      <template v-else-if="saveStatus === 'error'">
        ⚠ Save failed
      </template>
    </span>
    
    <\!-- Last saved time -->
    <span v-if="lastSaved" class="text-xs text-gray-400">
      Last saved: {{ formatRelativeTime(lastSaved) }}
    </span>
  </div>
</template>
```

## Definition of Done

- ✅ Manual save via Ctrl+S working
- ✅ Manual save via toolbar button working
- ✅ Auto-save triggers after inactivity
- ✅ Save status indicators display correctly
- ✅ Unsaved changes indicator working
- ✅ Concurrent edit detection implemented
- ✅ Retry logic for failed saves
- ✅ Local backup on save failure
- ✅ Auto-save configurable in settings
- ✅ No data loss during save operations
- ✅ Unit tests for save logic
- ✅ Integration tests for save workflow

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Data loss during save failures
- **Mitigation:** Local backup, retry logic, clear error messages
- **Rollback:** Manual save only, disable auto-save

**Secondary Risk:** Concurrent edit conflicts
- **Mitigation:** Last-modified checking, conflict dialog
- **Rollback:** Simple last-write-wins approach

### Compatibility Verification

- ✅ No breaking changes to editor functionality
- ✅ No database changes required
- ✅ UI changes minimal (status indicators only)
- ✅ Performance impact negligible
- ✅ Existing shortcuts preserved

## Estimation

**Story Points:** 5
**Estimated Hours:** 8-10 hours
**Dependencies:** Story 1.6 (Markdown Editor), Story 1.2 (WebDAV Service)

## Testing Strategy

### Unit Tests
1. Save manager logic
2. Auto-save timer functionality
3. Retry logic with failures
4. Conflict detection logic
5. Local backup creation

### Integration Tests
1. Ctrl+S triggers save
2. Auto-save after inactivity
3. Save status updates properly
4. Error handling and recovery
5. Settings persistence

### E2E Tests
1. Complete save workflow
2. Auto-save with real WebDAV
3. Conflict resolution flow
4. Network failure recovery

## Notes for Developer

- Consider implementing optimistic UI updates
- Add save queue for offline support in future
- Consider diff-based saves for large files
- Add auto-save pause during active typing
- Implement version history in future iteration
- Consider adding save shortcuts to context menu
- Monitor auto-save impact on WebDAV server load
