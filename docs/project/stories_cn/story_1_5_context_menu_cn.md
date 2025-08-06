# Story 1.5: 添加文件操作上下文菜单 - 棕地项目增量开发

## 用户故事

作为用户，
我想通过右键菜单执行文件操作，
以便我能够直观地管理我的提示文件。

## 故事背景

### 现有系统集成

- **集成对象：** 文件树组件、WebDAVService、现有模态系统
- **技术栈：** Vue 3.4+、TypeScript、Tailwind CSS、Floating UI 用于定位
- **遵循模式：** 当前上下文菜单模式（如有）、模态确认模式
- **接触点：** 文件树节点、WebDAV CRUD 操作、通知系统

## 验收标准

### 功能需求

1. 右键点击文件显示带有以下选项的上下文菜单：
   - 打开
   - 重命名
   - 删除
   - 复制路径
2. 右键点击文件夹显示带有以下选项的上下文菜单：
   - 新建文件
   - 新建文件夹
   - 重命名
   - 删除
   - 刷新
3. "新建文件"提示输入文件名并验证 .md 扩展名
4. "重命名"启用带验证的内联编辑
5. "删除"显示带文件/文件夹名称的确认对话框

### 集成需求

6. 上下文菜单定位保持在视口边界内
7. 操作触发 WebDAV 服务方法
8. 操作后树自动更新
9. 成功/错误通知使用现有通知系统
10. 键盘快捷键正常工作（Delete 键，F2 重命名）

### 质量需求

11. 上下文菜单在右键点击后 100ms 内出现
12. 内联编辑具有适当的焦点管理
13. 操作在执行期间显示加载状态
14. 错误消息具体且可操作
15. 删除操作的撤销通知（5 秒）

## 技术说明

### 集成方法
- 使用 Floating UI 进行上下文菜单定位
- 利用现有模态组件进行确认
- 使用现有表单验证进行文件名验证
- 与 fileTreeStore 集成进行状态更新

### 现有模式参考
- 遵循现有模态确认模式
- 使用相同的通知提示组件
- 应用一致的表单字段样式
- 匹配现有的加载指示器模式

### 关键约束
- 文件名验证：仅字母数字、短横线、下划线
- 最大文件名长度：255 个字符
- 无法重命名/删除根文件夹
- MVP 中不支持批量操作

## 实现细节

### 上下文菜单组件
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

### 菜单配置
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

### 文件操作处理器
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

## 完成定义

- ✅ 右键点击文件和文件夹出现上下文菜单
- ✅ 所有菜单操作功能完备且与 WebDAV 集成
- ✅ 带验证的内联重命名正常工作
- ✅ 删除确认模态防止意外删除
- ✅ 带名称验证的新文件/文件夹创建
- ✅ 操作后树自动更新
- ✅ 键盘快捷键功能完备
- ✅ 操作期间显示加载状态
- ✅ 显示成功/错误通知
- ✅ 边缘附近的上下文菜单定位正确
- ✅ 所有操作的单元测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 意外文件删除
- **缓解措施：** 确认对话框、撤销通知
- **回滚方案：** 实现带垃圾箱文件夹的软删除

**次要风险：** 文件名冲突
- **缓解措施：** 验证和重复检查
- **回滚方案：** 自动为重复项追加数字

### 兼容性验证

- ✅ 不对文件树组件产生破坏性更改
- ✅ 不需要数据库更改
- ✅ UI 更改仅为附加性质
- ✅ 性能影响最小
- ✅ 保留现有快捷键

## 估算

**故事点数：** 5
**预估时间：** 8-10 小时
**依赖项：** Story 1.4 (文件树组件)

## 测试策略

### 单元测试
1. 上下文菜单定位逻辑
2. 文件名验证规则
3. 路径操作函数
4. 菜单项启用/禁用逻辑

### 集成测试
1. 右键点击触发菜单显示
2. 每个操作成功完成
3. 操作后树更新
4. 失败操作的错误处理
5. 键盘快捷键触发操作

### E2E 测试
1. 完整文件创建工作流
2. 重命名文件并验证更新
3. 带确认的删除文件
4. 创建嵌套文件夹结构

## 开发人员注意事项

- 使用 @floating-ui/vue 进行菜单定位
- 考虑将来添加"复制"选项
- 稍后添加"移动到..."用于文件组织
- 在上下文菜单中实现键盘导航
- 考虑为批量操作添加多选
- 将最近操作添加到撤销堆栈
- Escape 键应关闭上下文菜单
- 点击外部应关闭菜单