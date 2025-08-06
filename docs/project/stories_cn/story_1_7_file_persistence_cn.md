# Story 1.7: 实现文件持久化和自动保存 - 棕地项目增量开发

## 用户故事

作为用户，
我想让我的更改能够自动和手动保存，
以便我不会丢失我的工作。

## 故事背景

### 现有系统集成

- **集成对象：** Markdown 编辑器、WebDAVService、现有通知系统
- **技术栈：** Vue 3.4+、TypeScript、Pinia stores、WebDAV API
- **遵循模式：** 当前保存模式、通知模式、键盘快捷键
- **接触点：** 编辑器内容变更、WebDAV 保存操作、UI 反馈

## 验收标准

### 功能需求

1. 通过 Ctrl+S（Mac 上为 Cmd+S）键盘快捷键触发手动保存
2. 通过工具栏按钮进行手动保存
3. 在非活动状态 30 秒后触发自动保存（可配置）
4. 保存操作期间显示"正在保存..."指示器
5. 成功保存后显示"已保存"确认
6. 在 UI 中显示未保存更改指示器（点或星号）

### 集成需求

7. 保存操作使用 WebDAVService.putFile 方法
8. 编辑器内容与保存操作同步
9. 通过最后修改检查进行并发编辑检测
10. 保存错误在现有通知系统中显示
11. 自动保存可在设置中禁用

### 质量需求

12. 对于 < 1MB 的文件，保存操作在 2 秒内完成
13. 保存失败期间无数据丢失（保留本地副本）
14. 网络故障的重试逻辑（3 次尝试）
15. 防抖自动保存以防止过度保存
16. UI 中同步状态的清晰指示

## 技术说明

### 集成方法
- 使用 Pinia store 进行保存状态管理
- 与现有键盘快捷键系统集成
- 使用 WebDAVService 进行文件操作
- 应用现有通知模式进行反馈

### 现有模式参考
- 遵循优化功能的现有保存模式
- 使用相同的加载/成功指示器
- 应用一致的键盘快捷键注册
- 匹配现有错误通知样式

### 关键约束
- 自动保存间隔：30-300 秒（用户可配置）
- 最大重试次数：3 次
- 冲突解决：最后写入获胜（MVP）
- 保留本地备份直到确认保存

## 实现细节

### 保存管理器实现
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
        if (!proceed) return;
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
      if (editorStore.hasUnsavedChanges && !this.saveInProgress) {
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

### 自动保存配置
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

### 键盘快捷键注册
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

### UI 状态指示器
```vue
<template>
  <div class="save-status flex items-center gap-2">
    <!-- Unsaved indicator -->
    <span
      v-if="hasUnsavedChanges"
      class="text-orange-500"
      title="Unsaved changes"
    >
      •
    </span>
    
    <!-- Save status -->
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
    
    <!-- Last saved time -->
    <span v-if="lastSaved" class="text-xs text-gray-400">
      Last saved: {{ formatRelativeTime(lastSaved) }}
    </span>
  </div>
</template>
```

## 完成定义

- ✅ 通过 Ctrl+S 手动保存正常工作
- ✅ 通过工具栏按钮手动保存正常工作
- ✅ 非活动后触发自动保存
- ✅ 保存状态指示器正确显示
- ✅ 未保存更改指示器正常工作
- ✅ 并发编辑检测已实现
- ✅ 保存失败的重试逻辑
- ✅ 保存失败时的本地备份
- ✅ 自动保存在设置中可配置
- ✅ 保存操作期间无数据丢失
- ✅ 保存逻辑的单元测试
- ✅ 保存工作流的集成测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 保存失败期间的数据丢失
- **缓解措施：** 本地备份、重试逻辑、清晰错误消息
- **回滚方案：** 仅手动保存，禁用自动保存

**次要风险：** 并发编辑冲突
- **缓解措施：** 最后修改检查、冲突对话框
- **回滚方案：** 简单的最后写入获胜方法

### 兼容性验证

- ✅ 不对编辑器功能产生破坏性更改
- ✅ 不需要数据库更改
- ✅ UI 更改最小（仅状态指示器）
- ✅ 性能影响可忽略不计
- ✅ 保留现有快捷键

## 估算

**故事点数：** 5
**预估时间：** 8-10 小时
**依赖项：** Story 1.6 (Markdown 编辑器)，Story 1.2 (WebDAV 服务)

## 测试策略

### 单元测试
1. 保存管理器逻辑
2. 自动保存计时器功能
3. 失败时的重试逻辑
4. 冲突检测逻辑
5. 本地备份创建

### 集成测试
1. Ctrl+S 触发保存
2. 非活动后自动保存
3. 保存状态正确更新
4. 错误处理和恢复
5. 设置持久化

### E2E 测试
1. 完整保存工作流
2. 与真实 WebDAV 的自动保存
3. 冲突解决流程
4. 网络故障恢复

## 开发人员注意事项

- 考虑实现乐观 UI 更新
- 为将来的离线支持添加保存队列
- 考虑为大文件实现基于差异的保存
- 在活跃打字期间添加自动保存暂停
- 在将来的迭代中实现版本历史
- 考虑将保存快捷键添加到上下文菜单
- 监控自动保存对 WebDAV 服务器负载的影响