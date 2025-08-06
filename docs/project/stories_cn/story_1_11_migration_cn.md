# Story 1.11: 实现迁移和向后兼容性 - 棕地项目增量开发

## 用户故事

作为用户，
我想将现有的本地提示迁移到新系统，
以便我不会丢失之前的工作。

## 故事背景

### 现有系统集成

- **集成对象：** 现有本地存储、WebDAVService、新文件系统
- **技术栈：** Vue 3.4+、TypeScript、浏览器 API、WebDAV
- **遵循模式：** 数据迁移模式、备份/恢复模式
- **接触点：** 本地存储数据、WebDAV 文件创建、用户通知

## 验收标准

### 功能需求

1. 首次启动时检测本地存储中的现有提示
2. 提示用户进行迁移并提供清晰说明
3. 迁移前创建本地存储备份
4. 将每个本地提示转换为 .md 文件格式
5. 将转换后的文件上传到 WebDAV 存储
6. 在清除本地存储之前验证迁移成功
7. 如果迁移失败提供回滚选项

### 集成需求

8. 每个浏览器/用户仅运行一次迁移
9. 如果跳过迁移，现有应用保持功能正常
10. 迁移过程不阻塞 UI
11. 迁移期间的进度指示
12. 本地存储保持到迁移确认

### 质量需求

13. 迁移过程中零数据丢失
14. 迁移优雅处理中断
15. 迁移失败的清晰错误消息
16. 备份可下载为 JSON 文件
17. 100 个提示的迁移在 60 秒内完成

## 技术说明

### 集成方法
- 检查本地存储中的迁移标志
- 首次启动时运行迁移向导
- 创建 WebDAV 文件夹结构
- 批量转换和上传
- 维护迁移状态以便恢复

### 现有模式参考
- 遵循现有数据导出模式
- 使用相同的进度指示器
- 应用一致的备份格式
- 匹配现有向导 UI 模式

### 关键约束
- 每个浏览器一次性迁移
- 会话内可逆
- 自动迁移最多 1000 个提示
- 保留提示元数据（日期、标签）

## 实现细节

### 迁移检测
```typescript
class MigrationManager {
  private readonly MIGRATION_KEY = 'prompt_migration_v2';
  private readonly LEGACY_KEY = 'saved_prompts';
  
  async checkMigrationNeeded(): Promise<boolean> {
    // Check if migration already completed
    const migrationStatus = localStorage.getItem(this.MIGRATION_KEY);
    if (migrationStatus === 'completed') {
      return false;
    }
    
    // Check for legacy data
    const legacyData = localStorage.getItem(this.LEGACY_KEY);
    return legacyData !== null && legacyData !== '[]';
  }
  
  async getLegacyPrompts(): Promise<LegacyPrompt[]> {
    const data = localStorage.getItem(this.LEGACY_KEY);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse legacy prompts', error);
      return [];
    }
  }
}
```

### 迁移向导组件
```vue
<template>
  <BaseModal
    v-model="showMigration"
    title="Migrate Your Prompts"
    :closable="false"
    size="lg"
  >
    <div class="migration-wizard">
      <!-- Step Indicator -->
      <StepIndicator
        :steps="migrationSteps"
        :current="currentStep"
      />
      
      <!-- Step Content -->
      <div class="step-content mt-6">
        <!-- Step 1: Detection -->
        <div v-if="currentStep === 1">
          <h3 class="text-lg font-medium mb-2">
            Found {{ legacyPrompts.length }} Existing Prompts
          </h3>
          <p class="text-gray-600 mb-4">
            We've detected prompts stored locally in your browser. 
            Would you like to migrate them to your WebDAV storage for 
            better organization and sync across devices?
          </p>
          
          <div class="bg-blue-50 p-3 rounded mb-4">
            <p class="text-sm text-blue-800">
              <Icon name="info" class="inline w-4 h-4 mr-1" />
              Your original prompts will be backed up before migration.
            </p>
          </div>
          
          <div class="prompt-preview max-h-40 overflow-auto">
            <div
              v-for="prompt in previewPrompts"
              :key="prompt.id"
              class="border-b py-2"
            >
              <div class="font-medium">{{ prompt.title }}</div>
              <div class="text-xs text-gray-500">
                {{ formatDate(prompt.created) }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Step 2: Backup -->
        <div v-if="currentStep === 2">
          <h3 class="text-lg font-medium mb-2">Creating Backup</h3>
          <p class="text-gray-600 mb-4">
            Creating a backup of your prompts before migration...
          </p>
          
          <ProgressBar :value="backupProgress" />
          
          <div v-if="backupComplete" class="mt-4">
            <Button
              variant="secondary"
              size="sm"
              @click="downloadBackup"
            >
              <Icon name="download" />
              Download Backup ({{ backupSize }})
            </Button>
          </div>
        </div>
        
        <!-- Step 3: Migration -->
        <div v-if="currentStep === 3">
          <h3 class="text-lg font-medium mb-2">Migrating Prompts</h3>
          <p class="text-gray-600 mb-4">
            Uploading your prompts to WebDAV storage...
          </p>
          
          <ProgressBar 
            :value="migrationProgress"
            :label="`${migratedCount} / ${totalCount}`"
          />
          
          <div v-if="failedPrompts.length" class="mt-4">
            <Alert type="warning">
              {{ failedPrompts.length }} prompts failed to migrate.
              They will remain in local storage.
            </Alert>
          </div>
        </div>
        
        <!-- Step 4: Completion -->
        <div v-if="currentStep === 4">
          <div class="text-center py-8">
            <Icon 
              name="check-circle" 
              class="w-16 h-16 text-green-500 mx-auto mb-4"
            />
            <h3 class="text-lg font-medium mb-2">
              Migration Complete!
            </h3>
            <p class="text-gray-600">
              Successfully migrated {{ successCount }} prompts to your 
              WebDAV storage.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex justify-between mt-6">
        <Button
          v-if="currentStep === 1"
          variant="secondary"
          @click="skipMigration"
        >
          Skip for Now
        </Button>
        
        <Button
          v-if="currentStep === 1"
          variant="primary"
          @click="startMigration"
        >
          Start Migration
        </Button>
        
        <Button
          v-if="currentStep === 4"
          variant="primary"
          @click="completeMigration"
        >
          Continue to App
        </Button>
      </div>
    </div>
  </BaseModal>
</template>
```

### 迁移服务
```typescript
class PromptMigrationService {
  async migratePrompts(
    prompts: LegacyPrompt[],
    onProgress: (progress: number) => void
  ): Promise<MigrationResult> {
    const results: MigrationResult = {
      success: [],
      failed: [],
      skipped: []
    };
    
    // Create migration folder
    const migrationFolder = `/migrated_${Date.now()}`;
    await webdavService.createFolder(migrationFolder);
    
    // Migrate in batches
    const batchSize = 10;
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (prompt) => {
          try {
            const mdContent = this.convertToMarkdown(prompt);
            const fileName = this.sanitizeFileName(prompt.title);
            const filePath = `${migrationFolder}/${fileName}.md`;
            
            await webdavService.putFile(filePath, mdContent);
            results.success.push(prompt);
          } catch (error) {
            console.error(`Failed to migrate: ${prompt.title}`, error);
            results.failed.push(prompt);
          }
        })
      );
      
      onProgress((i + batch.length) / prompts.length * 100);
    }
    
    return results;
  }
  
  private convertToMarkdown(prompt: LegacyPrompt): string {
    return `# ${prompt.title}

*Created: ${prompt.created}*
*Last Modified: ${prompt.modified}*
${prompt.tags ? `*Tags: ${prompt.tags.join(', ')}*` : ''}

---

${prompt.content}

---

## Metadata
- Original ID: ${prompt.id}
- Migrated: ${new Date().toISOString()}
- Version: ${prompt.version || '1.0'}
`;
  }
  
  private sanitizeFileName(title: string): string {
    return title
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 100);
  }
}
```

### 回滚机制
```typescript
class MigrationRollback {
  async rollback(backup: BackupData): Promise<void> {
    // Restore local storage
    localStorage.setItem(this.LEGACY_KEY, JSON.stringify(backup.prompts));
    
    // Remove migration flag
    localStorage.removeItem(this.MIGRATION_KEY);
    
    // Optional: Remove migrated files from WebDAV
    if (backup.migrationFolder) {
      try {
        await webdavService.deleteFolder(backup.migrationFolder);
      } catch (error) {
        console.warn('Could not remove migrated files', error);
      }
    }
    
    showNotification('Migration rolled back', 'info');
  }
}
```

## 完成定义

- ✅ 首次启动时的迁移检测
- ✅ 迁移向导 UI 完成
- ✅ 迁移前创建备份
- ✅ 提示转换为 markdown 格式
- ✅ 文件成功上传到 WebDAV
- ✅ 迁移期间的进度指示
- ✅ 失败迁移的错误处理
- ✅ 回滚机制功能正常
- ✅ 跳过选项保留本地存储
- ✅ 迁移状态持久化
- ✅ 验证零数据丢失
- ✅ 迁移逻辑的单元测试
- ✅ 完整工作流的集成测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 迁移期间的数据丢失
- **缓解措施：** 强制备份、删除前验证
- **回滚方案：** 从备份 JSON 恢复

**次要风险：** 迁移期间 WebDAV 连接失败
- **缓解措施：** 重试逻辑、部分迁移支持
- **回滚方案：** 保留本地存储直到确认

### 兼容性验证

- ✅ 不对现有应用产生破坏性更改
- ✅ 跳过时保留本地存储
- ✅ 迁移期间 UI 保持功能正常
- ✅ 大数据集的性能可接受
- ✅ 维护浏览器兼容性

## 估算

**故事点数：** 8
**预估时间：** 12-14 小时
**依赖项：** Story 1.2 (WebDAV 服务)

## 测试策略

### 单元测试
1. 旧版提示检测
2. Markdown 转换逻辑
3. 文件名清理
4. 备份创建
5. 回滚功能

### 集成测试
1. 迁移向导流程
2. WebDAV 上传过程
3. 进度跟踪
4. 错误恢复
5. 跳过和继续路径

### E2E 测试
1. 完整迁移工作流
2. 大数据集迁移（100+ 提示）
3. 迁移中断恢复
4. 部分迁移后回滚

## 开发人员注意事项

- 使用各种旧版数据格式进行测试
- 优雅处理损坏的本地存储
- 考虑为大迁移实现分块上传
- 添加试运行模式进行测试
- 记录迁移指标以便分析
- 考虑增量迁移支持
- 添加迁移恢复功能
- 清楚记录回滚过程