# Story 1.5: Add File Operations Context Menu - Brownfield Addition

## User Story

As a user,
I want to perform file operations through right-click menus,
So that I can manage my prompt files intuitively.

## Story Context

### Existing System Integration

- **Integrates with:** File tree component, WebDAVService, existing modal system
- **Technology:** Vue 3.4+, TypeScript, Tailwind CSS, Floating UI for positioning
- **Follows pattern:** Current context menu patterns (if any), modal confirmation patterns
- **Touch points:** File tree nodes, WebDAV CRUD operations, notification system

## Acceptance Criteria

### Functional Requirements

1. Right-click on files shows context menu with options:
   - Open
   - Rename
   - Delete
   - Copy Path
2. Right-click on folders shows context menu with options:
   - New File
   - New Folder
   - Rename
   - Delete
   - Refresh
3. "New File" prompts for filename with .md extension validation
4. "Rename" enables inline editing with validation
5. "Delete" shows confirmation dialog with file/folder name

### Integration Requirements

6. Context menu positioning stays within viewport boundaries
7. Operations trigger WebDAV service methods
8. Tree updates automatically after operations
9. Success/error notifications use existing notification system
10. Keyboard shortcuts work (Delete key, F2 for rename)

### Quality Requirements

11. Context menu appears within 100ms of right-click
12. Inline editing has proper focus management
13. Operations show loading state during execution
14. Error messages are specific and actionable
15. Undo notification for delete operations (5 seconds)

## Technical Notes

### Integration Approach
- Use Floating UI for context menu positioning
- Leverage existing modal components for confirmations
- Use existing form validation for filename validation
- Integrate with fileTreeStore for state updates

### Existing Pattern Reference
- Follow existing modal confirmation patterns
- Use same notification toast components
- Apply consistent form field styling
- Match existing loading spinner patterns

### Key Constraints
- Filename validation: alphanumeric, dash, underscore only
- Maximum filename length: 255 characters
- Cannot rename/delete root folders
- Batch operations not supported in MVP

## Implementation Details

### Context Menu Component
```vue
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="context-menu"
      :style="menuStyle"
      @click="handleMenuClick"
    >
      <div
        v-for="item in menuItems"
        :key="item.id"
        class="menu-item"
        :class="{ disabled: item.disabled }"
        @click="() => handleAction(item)"
      >
        <Icon :name="item.icon" class="w-4 h-4" />
        <span>{{ item.label }}</span>
        <kbd v-if="item.shortcut" class="ml-auto">
          {{ item.shortcut }}
        </kbd>
      </div>
    </div>
  </Teleport>
  
  <!-- Inline Rename Input -->
  <InlineEdit
    v-if="renaming"
    :value="renamingNode.name"
    :validator="validateFilename"
    @save="handleRename"
    @cancel="cancelRename"
  />
  
  <!-- Delete Confirmation Modal -->
  <ConfirmModal
    v-model="showDeleteConfirm"
    title="Delete Confirmation"
    :message="deleteMessage"
    danger
    @confirm="confirmDelete"
  />
  
  <!-- New File/Folder Modal -->
  <PromptModal
    v-model="showNewItemModal"
    :title="newItemTitle"
    placeholder="Enter name..."
    :validator="validateFilename"
    @submit="createNewItem"
  />
</template>
```

### Menu Configuration
```typescript
interface ContextMenuItem {
  id: string;
  label: string;
  icon: string;
  action: () => void | Promise<void>;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

const fileMenuItems: ContextMenuItem[] = [
  {
    id: 'open',
    label: 'Open',
    icon: 'file-open',
    action: () => openFile(),
    shortcut: 'Enter'
  },
  {
    id: 'rename',
    label: 'Rename',
    icon: 'edit',
    action: () => startRename(),
    shortcut: 'F2'
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    action: () => showDeleteConfirm(),
    shortcut: 'Del'
  },
  { divider: true },
  {
    id: 'copyPath',
    label: 'Copy Path',
    icon: 'copy',
    action: () => copyPath()
  }
];
```

### File Operations Handler
```typescript
class FileOperationsHandler {
  async createFile(parentPath: string, name: string): Promise<void> {
    const fullPath = `${parentPath}/${name}.md`;
    await webdavService.putFile(fullPath, '# ' + name);
    await fileTreeStore.refreshNode(parentPath);
    showNotification('File created successfully', 'success');
  }
  
  async renameItem(oldPath: string, newName: string): Promise<void> {
    const newPath = oldPath.replace(/[^/]+$/, newName);
    await webdavService.moveFile(oldPath, newPath);
    await fileTreeStore.refreshNode(dirname(oldPath));
    showNotification('Renamed successfully', 'success');
  }
  
  async deleteItem(path: string): Promise<void> {
    const isFolder = await webdavService.isFolder(path);
    if (isFolder) {
      await webdavService.deleteFolder(path);
    } else {
      await webdavService.deleteFile(path);
    }
    await fileTreeStore.refreshNode(dirname(path));
    showUndoNotification('Deleted successfully', 5000);
  }
}
```

## Definition of Done

- ✅ Context menu appears on right-click for files and folders
- ✅ All menu actions functional with WebDAV integration
- ✅ Inline rename with validation working
- ✅ Delete confirmation modal prevents accidental deletion
- ✅ New file/folder creation with name validation
- ✅ Tree automatically updates after operations
- ✅ Keyboard shortcuts functional
- ✅ Loading states shown during operations
- ✅ Success/error notifications displayed
- ✅ Context menu positioning correct near edges
- ✅ Unit tests for all operations

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Accidental file deletion
- **Mitigation:** Confirmation dialog, undo notification
- **Rollback:** Implement soft delete with trash folder

**Secondary Risk:** Filename conflicts
- **Mitigation:** Validation and duplicate checking
- **Rollback:** Auto-append number to duplicates

### Compatibility Verification

- ✅ No breaking changes to file tree component
- ✅ No database changes required
- ✅ UI changes additive only
- ✅ Performance impact minimal
- ✅ Existing shortcuts preserved

## Estimation

**Story Points:** 5
**Estimated Hours:** 8-10 hours
**Dependencies:** Story 1.4 (File Tree Component)

## Testing Strategy

### Unit Tests
1. Context menu positioning logic
2. Filename validation rules
3. Path manipulation functions
4. Menu item enable/disable logic

### Integration Tests
1. Right-click triggers menu display
2. Each operation completes successfully
3. Tree updates after operations
4. Error handling for failed operations
5. Keyboard shortcuts trigger actions

### E2E Tests
1. Complete file creation workflow
2. Rename file and verify update
3. Delete file with confirmation
4. Create nested folder structure

## Notes for Developer

- Use @floating-ui/vue for menu positioning
- Consider adding "Duplicate" option in future
- Add "Move to..." for file organization later
- Implement keyboard navigation in context menu
- Consider adding multi-select for batch operations
- Add recent operations to undo stack
- Escape key should close context menu
- Click outside should close menu