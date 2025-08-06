# Story 1.10: 添加文件树工具栏和状态 - 棕地项目增量开发

## 用户故事

作为用户，
我想快速访问文件树操作和连接状态，
以便我能够高效地管理我的 WebDAV 连接。

## 故事背景

### 现有系统集成

- **集成对象：** 文件树组件、WebDAV 配置模态、WebDAVService
- **技术栈：** Vue 3.4+、TypeScript、Tailwind CSS、Pinia stores
- **遵循模式：** 当前工具栏模式、状态指示器模式
- **接触点：** 文件树页脚区域、WebDAV 连接状态、配置模态

## 验收标准

### 功能需求

1. 在文件树面板底部添加工具栏
2. 包含打开 WebDAV 设置模态的"配置"按钮
3. 包含从服务器重新加载文件树的"刷新"按钮
4. 显示连接状态指示器（绿色=已连接，红色=已断开，黄色=连接中）
5. 连接时显示当前连接配置文件名称
6. 悬停时提供带连接详细信息的工具提示

### 集成需求

7. 工具栏与文件树组件无缝集成
8. 配置按钮打开现有的 WebDAV 配置模态
9. 刷新触发根目录的 WebDAVService.listFolder()
10. 状态在连接更改时自动更新
11. 所有操作的视觉反馈（加载指示器）

### 质量需求

12. 状态在状态更改后 500ms 内更新
13. 典型树的刷新在 3 秒内完成
14. 工具栏在树滚动期间保持可见
15. 窄侧边栏的响应式设计
16. 支持键盘导航的可访问性

## 技术说明

### 集成方法
- 将工具栏定位为文件树容器中的粘性页脚
- 使用现有的按钮和图标组件
- 连接到 webdavStore 获取连接状态
- 触发现有的模态和服务方法

### 现有模式参考
- 遵循现有工具栏组件模式
- 使用相同的按钮样式和间距
- 应用一致的状态指示器颜色
- 匹配现有的加载指示器模式

### 关键约束
- 工具栏高度：最大 40px
- 必须适用于侧边栏宽度 200px-400px
- 状态轮询间隔：30 秒
- 仅快速操作（无复杂操作）

## 实现细节

### 工具栏组件
```vue
<template>
  <div class="file-tree-toolbar sticky bottom-0 bg-white dark:bg-gray-800 border-t p-2">
    <div class="flex items-center justify-between gap-2">
      <!-- Left Section: Status -->
      <div class="flex items-center gap-2 min-w-0">
        <ConnectionStatus
          :status="connectionStatus"
          :profile="activeProfile"
        />
      </div>
      
      <!-- Right Section: Actions -->
      <div class="flex items-center gap-1">
        <!-- Refresh Button -->
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                @click="refreshTree"
                :disabled="!isConnected || refreshing"
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
        
        <!-- Configure Button -->
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

### 连接状态组件
```vue
<template>
  <div class="connection-status flex items-center gap-2">
    <!-- Status Indicator -->
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
    
    <!-- Status Text -->
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

### 自动刷新逻辑
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
    if (!this.activeProfile) return;
    
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

### 响应式工具栏样式
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

## 完成定义

- ✅ 工具栏定位在文件树底部
- ✅ 配置按钮打开 WebDAV 设置模态
- ✅ 刷新按钮重新加载文件树
- ✅ 连接状态指示器正常工作
- ✅ 状态自动更新
- ✅ 连接时显示配置文件名称
- ✅ 工具提示显示连接详细信息
- ✅ 操作期间的加载状态
- ✅ 窄侧边栏的响应式设计
- ✅ 支持键盘导航
- ✅ 自动刷新机制正常工作
- ✅ 工具栏逻辑的单元测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 工具栏与树内容重叠
- **缓解措施：** 使用适当 z-index 的粘性定位
- **回滚方案：** 将工具栏移至树上方

**次要风险：** 状态轮询影响性能
- **缓解措施：** 30 秒间隔，防抖更新
- **回滚方案：** 仅手动刷新

### 兼容性验证

- ✅ 不对文件树产生破坏性更改
- ✅ 不需要数据库更改
- ✅ UI 更改仅限于工具栏区域
- ✅ 性能影响最小
- ✅ 保留现有文件树功能

## 估算

**故事点数：** 3
**预估时间：** 4-6 小时
**依赖项：** Story 1.4 (文件树)，Story 1.3 (配置模态)

## 测试策略

### 单元测试
1. 状态指示器逻辑
2. 刷新功能
3. 连接状态管理
4. 自动刷新计时器

### 集成测试
1. 配置按钮打开模态
2. 刷新更新文件树
3. 状态反映连接状态
4. 工具提示正确显示

### E2E 测试
1. 完整工具栏工作流
2. 连接状态更改
3. 大型树的刷新
4. 响应式行为

## 开发人员注意事项

- 考虑添加连接重试按钮
- 添加最后同步时间戳显示
- 考虑带宽使用指示器
- 将来添加全部折叠/展开按钮
- 考虑搜索框集成
- 监控自动刷新对服务器的影响
- 添加连接历史日志
- 考虑离线模式指示器