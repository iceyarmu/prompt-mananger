# Story 1.10: Add File Tree Toolbar and Status - Brownfield Addition

## User Story

As a user,
I want quick access to file tree actions and connection status,
So that I can manage my WebDAV connection efficiently.

## Story Context

### Existing System Integration

- **Integrates with:** File tree component, WebDAV configuration modal, WebDAVService
- **Technology:** Vue 3.4+, TypeScript, Tailwind CSS, Pinia stores
- **Follows pattern:** Current toolbar patterns, status indicator patterns
- **Touch points:** File tree footer area, WebDAV connection state, configuration modal

## Acceptance Criteria

### Functional Requirements

1. Add toolbar at bottom of file tree panel
2. Include "Configure" button that opens WebDAV settings modal
3. Include "Refresh" button that reloads file tree from server
4. Display connection status indicator (green=connected, red=disconnected, yellow=connecting)
5. Show current connection profile name when connected
6. Provide tooltip with connection details on hover

### Integration Requirements

7. Toolbar integrates seamlessly with file tree component
8. Configure button opens existing WebDAV configuration modal
9. Refresh triggers WebDAVService.listFolder() for root
10. Status updates automatically on connection changes
11. Visual feedback for all operations (loading spinners)

### Quality Requirements

12. Status updates within 500ms of state change
13. Refresh completes within 3 seconds for typical tree
14. Toolbar remains visible during tree scrolling
15. Responsive design for narrow sidebars
16. Accessible with keyboard navigation

## Technical Notes

### Integration Approach
- Position toolbar as sticky footer in file tree container
- Use existing button and icon components
- Connect to webdavStore for connection state
- Trigger existing modal and service methods

### Existing Pattern Reference
- Follow existing toolbar component patterns
- Use same button styles and spacing
- Apply consistent status indicator colors
- Match existing loading spinner patterns

### Key Constraints
- Toolbar height: 40px maximum
- Must work with sidebar widths 200px-400px
- Status polling interval: 30 seconds
- Quick actions only (no complex operations)

## Implementation Details

### Toolbar Component
```vue
<template>
  <div class="file-tree-toolbar sticky bottom-0 bg-white dark:bg-gray-800 border-t p-2">
    <div class="flex items-center justify-between gap-2">
      <\!-- Left Section: Status -->
      <div class="flex items-center gap-2 min-w-0">
        <ConnectionStatus
          :status="connectionStatus"
          :profile="activeProfile"
        />
      </div>
      
      <\!-- Right Section: Actions -->
      <div class="flex items-center gap-1">
        <\!-- Refresh Button -->
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                @click="refreshTree"
                :disabled="\!isConnected || refreshing"
              >
                <Icon 
                  name="refresh-cw" 
                  :class="{ 'animate-spin': refreshing }"
                  class="w-4 h-4"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh file tree</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <\!-- Configure Button -->
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                @click="openConfiguration"
              >
                <Icon name="settings" class="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WebDAV settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const webdavStore = useWebDAVStore();
const fileTreeStore = useFileTreeStore();

const connectionStatus = computed(() => webdavStore.connectionStatus);
const activeProfile = computed(() => webdavStore.activeProfile);
const isConnected = computed(() => connectionStatus.value === 'connected');

const refreshing = ref(false);

const refreshTree = async () => {
  refreshing.value = true;
  try {
    await fileTreeStore.loadTree();
    showNotification('File tree refreshed', 'success');
  } catch (error) {
    showNotification('Failed to refresh tree', 'error');
  } finally {
    refreshing.value = false;
  }
};

const openConfiguration = () => {
  webdavStore.showConfigModal = true;
};
</script>
```

### Connection Status Component
```vue
<template>
  <div class="connection-status flex items-center gap-2">
    <\!-- Status Indicator -->
    <div class="relative">
      <div
        class="status-dot w-2 h-2 rounded-full"
        :class="statusClass"
      />
      <div
        v-if="status === 'connecting'"
        class="absolute inset-0 w-2 h-2 rounded-full animate-ping"
        :class="statusClass"
      />
    </div>
    
    <\!-- Status Text -->
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span class="text-xs truncate max-w-[120px]">
            <template v-if="profile">
              {{ profile.name }}
            </template>
            <template v-else-if="status === 'connecting'">
              Connecting...
            </template>
            <template v-else>
              Not connected
            </template>
          </span>
        </TooltipTrigger>
        
        <TooltipContent v-if="profile">
          <div class="text-xs">
            <div>{{ profile.name }}</div>
            <div class="text-gray-400">{{ profile.url }}</div>
            <div v-if="profile.lastSync" class="text-gray-400">
              Last sync: {{ formatRelativeTime(profile.lastSync) }}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  profile?: WebDAVProfile | null;
}>();

const statusClass = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-green-500';
    case 'disconnected':
      return 'bg-gray-400';
    case 'connecting':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
  }
});
</script>
```

### Auto-refresh Logic
```typescript
// webdavStore.ts additions
class WebDAVStore {
  private refreshInterval: NodeJS.Timeout | null = null;
  
  startAutoRefresh(interval: number = 30000): void {
    this.stopAutoRefresh();
    
    this.refreshInterval = setInterval(async () => {
      if (this.connectionStatus === 'connected') {
        try {
          await this.testConnection();
        } catch (error) {
          this.connectionStatus = 'error';
        }
      }
    }, interval);
  }
  
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
  
  async reconnect(): Promise<void> {
    if (\!this.activeProfile) return;
    
    this.connectionStatus = 'connecting';
    try {
      await this.connect(this.activeProfile);
      this.connectionStatus = 'connected';
      this.activeProfile.lastSync = new Date();
    } catch (error) {
      this.connectionStatus = 'error';
      throw error;
    }
  }
}
```

### Responsive Toolbar Styles
```css
.file-tree-toolbar {
  min-height: 40px;
  z-index: 10;
}

/* Narrow sidebar adjustments */
@media (max-width: 250px) {
  .connection-status .status-text {
    display: none;
  }
  
  .file-tree-toolbar .btn-text {
    display: none;
  }
}

/* Status dot animations */
.status-dot {
  transition: background-color 0.3s ease;
}

/* Refresh animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Definition of Done

- ✅ Toolbar positioned at bottom of file tree
- ✅ Configure button opens WebDAV settings modal
- ✅ Refresh button reloads file tree
- ✅ Connection status indicator working
- ✅ Status updates automatically
- ✅ Profile name displayed when connected
- ✅ Tooltips show connection details
- ✅ Loading states during operations
- ✅ Responsive design for narrow sidebars
- ✅ Keyboard navigation supported
- ✅ Auto-refresh mechanism working
- ✅ Unit tests for toolbar logic

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Toolbar overlapping tree content
- **Mitigation:** Sticky positioning with proper z-index
- **Rollback:** Move toolbar above tree

**Secondary Risk:** Status polling affecting performance
- **Mitigation:** 30-second interval, debounced updates
- **Rollback:** Manual refresh only

### Compatibility Verification

- ✅ No breaking changes to file tree
- ✅ No database changes required
- ✅ UI changes contained to toolbar area
- ✅ Performance impact minimal
- ✅ Existing file tree functionality preserved

## Estimation

**Story Points:** 3
**Estimated Hours:** 4-6 hours
**Dependencies:** Story 1.4 (File Tree), Story 1.3 (Configuration Modal)

## Testing Strategy

### Unit Tests
1. Status indicator logic
2. Refresh functionality
3. Connection state management
4. Auto-refresh timer

### Integration Tests
1. Configure button opens modal
2. Refresh updates file tree
3. Status reflects connection state
4. Tooltips display correctly

### E2E Tests
1. Complete toolbar workflow
2. Connection status changes
3. Refresh with large tree
4. Responsive behavior

## Notes for Developer

- Consider adding connection retry button
- Add last sync timestamp display
- Consider bandwidth usage indicator
- Add collapse/expand all buttons in future
- Consider search box integration
- Monitor auto-refresh impact on server
- Add connection history log
- Consider offline mode indicator
