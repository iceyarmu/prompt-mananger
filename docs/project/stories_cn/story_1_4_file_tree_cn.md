# Story 1.4: 实现文件树组件 - 棕地项目增量开发

## 用户故事

作为用户，
我想以分层树形结构浏览我的提示文件，
以便我能够高效地组织和导航我的提示。

## 故事背景

### 现有系统集成

- **集成对象：** WebDAVService、现有 Vue 组件系统、左侧边栏布局
- **技术栈：** Vue 3.4+、TypeScript、Tailwind CSS、虚拟滚动库
- **遵循模式：** 当前组件组合模式、现有图标系统
- **接触点：** WebDAV 文件列表 API、主布局组件、路由导航

## 验收标准

### 功能需求

1. 显示来自 WebDAV 根目录的分层文件夹结构
2. 过滤仅显示 .md 文件及其父文件夹
3. 为文件夹实现带动画的展开/折叠功能
4. 支持单击选择，双击打开文件
5. 高亮显示当前选中/活动的文件
6. 为 .md 文件显示文件图标，为目录显示文件夹图标

### 集成需求

7. 组件适配现有的左侧边栏布局
8. 树状态在会话期间持久化（记住展开的文件夹）
9. WebDAV 操作期间显示加载状态
10. 超过 100 个项目时激活虚拟滚动
11. WebDAV 连接更改时组件更新

### 质量需求

12. 展开/折叠的平滑动画（60 FPS）
13. 键盘导航支持（方向键、Enter、Space）
14. 具备适当 ARIA 属性的可访问性
15. 快速查找文件的搜索/过滤功能
16. 响应侧边栏调整大小操作

## 技术说明

### 集成方法
- 使用 Vue 3 递归组件进行树渲染
- 与现有的 Pinia fileStore 集成进行状态管理
- 使用当前图标库中的现有图标组件
- 使用 vue-virtual-scroller 或类似的虚拟滚动

### 现有模式参考
- 遵循现有侧边栏组件模式
- 使用相同的加载指示器组件
- 应用一致的悬停和选择样式
- 匹配现有的键盘导航模式

### 关键约束
- 最大树深度：10 层
- 长文件名截断并显示工具提示
- 超过 50 个项目的文件夹延迟加载
- 对 10,000+ 文件内存高效

## 实现细节

### 组件结构
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

### 树节点接口
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

### 存储集成
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

## 完成定义

- ✅ 文件树正确显示 WebDAV 文件夹结构
- ✅ 仅显示 .md 文件及其文件夹
- ✅ 展开/折叠功能正常，动画平滑
- ✅ 文件选择和导航功能完备
- ✅ 大型树激活虚拟滚动
- ✅ 搜索/过滤功能高效运行
- ✅ 键盘导航完全实现
- ✅ 操作期间显示加载状态
- ✅ 组件响应侧边栏调整大小
- ✅ 单元测试覆盖树操作
- ✅ 通过 1000+ 文件的性能验证

## 风险和兼容性检查

### 风险评估

**主要风险：** 大型文件树的性能问题
- **缓解措施：** 实现虚拟滚动和延迟加载
- **回滚方案：** 添加分页或限制树深度

**次要风险：** WebDAV 延迟影响用户体验
- **缓解措施：** 积极缓存和乐观更新
- **回滚方案：** 分块加载树并渐进式显示

### 兼容性验证

- ✅ 不对现有布局产生破坏性更改
- ✅ 不需要数据库更改
- ✅ UI 更改仅限于左侧边栏
- ✅ 内存使用与树大小线性扩展
- ✅ 空闲状态时 CPU 使用最小

## 估算

**故事点数：** 8
**预估时间：** 12-16 小时
**依赖项：** Story 1.2 (WebDAV 服务)，Story 1.3 (配置)

## 测试策略

### 单元测试
1. 树节点展开/折叠逻辑
2. 文件过滤（仅 .md）
3. 搜索功能
4. 选择状态管理
5. 虚拟滚动阈值

### 集成测试
1. 从 WebDAV 服务加载树
2. 在文件夹层次结构中导航
3. 选择和打开文件
4. 在整个树中搜索
5. 优雅处理连接丢失

### 性能测试
1. 渲染 1000+ 节点无卡顿
2. 大型树的搜索性能
3. 深层嵌套的内存使用
4. 虚拟列表的滚动性能

## 开发人员注意事项

- 考虑使用 @tanstack/vue-virtual 进行虚拟滚动
- 实现防抖搜索以避免过度过滤
- 使用 CSS transforms 实现展开/折叠动画
- 考虑首次展开时延迟加载文件夹内容
- 为 Story 1.5 添加右键上下文菜单钩子
- 在 sessionStorage 中缓存树结构以便快速重新加载
- 添加面包屑导航作为增强功能
- 考虑拖放文件组织（未来功能）