# Story 1.4: Implement File Tree Component - Brownfield Addition

## User Story

As a user,
I want to browse my prompt files in a hierarchical tree structure,
So that I can organize and navigate my prompts efficiently.

## Story Context

### Existing System Integration

- **Integrates with:** WebDAVService, existing Vue component system, left sidebar layout
- **Technology:** Vue 3.4+, TypeScript, Tailwind CSS, virtual scrolling library
- **Follows pattern:** Current component composition patterns, existing icon system
- **Touch points:** WebDAV file listing API, main layout component, router navigation

## Acceptance Criteria

### Functional Requirements

1. Display hierarchical folder structure from WebDAV root
2. Filter to show only .md files and their parent folders
3. Implement expand/collapse functionality for folders with animation
4. Support single-click to select, double-click to open file
5. Highlight currently selected/active file
6. Show file icons for .md files and folder icons for directories

### Integration Requirements

7. Component fits within existing left sidebar layout
8. Tree state persists during session (expanded folders remembered)
9. Loading states shown during WebDAV operations
10. Virtual scrolling activates for trees with >100 items
11. Component updates when WebDAV connection changes

### Quality Requirements

12. Smooth animations for expand/collapse (60 FPS)
13. Keyboard navigation support (arrow keys, Enter, Space)
14. Accessible with proper ARIA attributes
15. Search/filter capability for finding files quickly
16. Responsive to sidebar resize operations

## Technical Notes

### Integration Approach
- Use Vue 3 recursive component for tree rendering
- Integrate with existing Pinia fileStore for state management
- Use existing icon components from current icon library
- Apply virtual scrolling using vue-virtual-scroller or similar

### Existing Pattern Reference
- Follow existing sidebar component patterns
- Use same loading spinner components
- Apply consistent hover and selection styles
- Match existing keyboard navigation patterns

### Key Constraints
- Maximum tree depth: 10 levels
- File name truncation for long names with tooltip
- Lazy loading for folders with >50 items
- Memory efficient for 10,000+ files

## Implementation Details

### Component Structure
```vue
<template>
  <div class="file-tree h-full overflow-hidden flex flex-col">
    <!-- Search Bar -->
    <div class="p-2 border-b">
      <SearchInput
        v-model="searchQuery"
        placeholder="Search files..."
        @clear="clearSearch"
      />
    </div>
    
    <!-- Tree Container -->
    <div class="flex-1 overflow-auto">
      <VirtualList
        v-if="filteredTree.length > 100"
        :items="filteredTree"
        :item-height="28"
      >
        <template #default="{ item }">
          <TreeNode
            :node="item"
            :depth="0"
            @select="handleSelect"
            @toggle="handleToggle"
          />
        </template>
      </VirtualList>
      
      <div v-else class="p-2">
        <TreeNode
          v-for="node in filteredTree"
          :key="node.path"
          :node="node"
          :depth="0"
          @select="handleSelect"
          @toggle="handleToggle"
        />
      </div>
    </div>
    
    <!-- Loading Overlay -->
    <LoadingOverlay v-if="loading" />
  </div>
</template>
```

### Tree Node Interface
```typescript
interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  expanded?: boolean;
  selected?: boolean;
  loading?: boolean;
  icon?: string;
  metadata?: {
    size?: number;
    modified?: Date;
    permissions?: string;
  };
}
```

### Store Integration
```typescript
// fileTreeStore.ts
interface FileTreeStore {
  tree: TreeNode[];
  selectedNode: TreeNode | null;
  expandedPaths: Set<string>;
  searchQuery: string;
  loading: boolean;
  
  // Actions
  loadTree(): Promise<void>;
  selectNode(node: TreeNode): void;
  toggleNode(node: TreeNode): void;
  refreshNode(path: string): Promise<void>;
  searchFiles(query: string): void;
}
```

## Definition of Done

- ✅ File tree displays WebDAV folder structure correctly
- ✅ Only .md files and their folders are shown
- ✅ Expand/collapse works with smooth animation
- ✅ File selection and navigation functional
- ✅ Virtual scrolling activates for large trees
- ✅ Search/filter feature works efficiently
- ✅ Keyboard navigation fully implemented
- ✅ Loading states display during operations
- ✅ Component responsive to sidebar resize
- ✅ Unit tests cover tree operations
- ✅ Performance verified with 1000+ files

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Performance with large file trees
- **Mitigation:** Implement virtual scrolling and lazy loading
- **Rollback:** Add pagination or limit tree depth

**Secondary Risk:** WebDAV latency affecting UX
- **Mitigation:** Aggressive caching and optimistic updates
- **Rollback:** Load tree in chunks with progressive disclosure

### Compatibility Verification

- ✅ No breaking changes to existing layout
- ✅ No database changes required
- ✅ UI changes confined to left sidebar
- ✅ Memory usage scales linearly with tree size
- ✅ CPU usage minimal during idle state

## Estimation

**Story Points:** 8
**Estimated Hours:** 12-16 hours
**Dependencies:** Story 1.2 (WebDAV Service), Story 1.3 (Configuration)

## Testing Strategy

### Unit Tests
1. Tree node expansion/collapse logic
2. File filtering (.md only)
3. Search functionality
4. Selection state management
5. Virtual scrolling threshold

### Integration Tests
1. Load tree from WebDAV service
2. Navigate through folder hierarchy
3. Select and open files
4. Search across entire tree
5. Handle connection loss gracefully

### Performance Tests
1. Render 1000+ nodes without lag
2. Search performance with large trees
3. Memory usage with deep nesting
4. Scroll performance with virtual list

## Notes for Developer

- Consider using @tanstack/vue-virtual for virtual scrolling
- Implement debounced search to avoid excessive filtering
- Use CSS transforms for expand/collapse animations
- Consider lazy-loading folder contents on first expand
- Add right-click context menu hook for Story 1.5
- Cache tree structure in sessionStorage for quick reload
- Add breadcrumb navigation as enhancement
- Consider drag-and-drop for file organization (future)