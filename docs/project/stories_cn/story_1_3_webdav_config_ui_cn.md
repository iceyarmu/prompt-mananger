# Story 1.3: 创建 WebDAV 配置 UI - 棕地项目增量开发

## 用户故事

作为用户，
我想通过 UI 配置我的 WebDAV 连接，
以便我可以连接到我首选的存储提供商。

## 故事背景

### 现有系统集成

- **集成对象：** 现有 Vue 3 模态系统、Tailwind CSS 设计系统、WebDAVService
- **技术栈：** Vue 3.4+ Composition API、TypeScript、Tailwind CSS、Pinia stores
- **遵循模式：** 当前模态组件模式、表单验证方法
- **接触点：** 主 UI 工具栏、浏览器本地存储、现有通知系统

## 验收标准

### 功能需求

1. 创建带有 WebDAV 连接字段的配置模态对话框：
   - 服务器 URL（必需，带 URL 验证）
   - 用户名（可选）
   - 密码（可选，掩码输入）
   - 连接名称/配置文件（用于多个端点）
2. 实现带加载状态和结果反馈的"测试连接"按钮
3. 将配置安全地保存在加密的浏览器存储中
4. 支持多个保存的配置文件并快速切换
5. 在 UI 中显示当前连接状态（已连接/已断开指示器）

### 集成需求

6. 模态遵循现有模态组件模式和动画
7. 表单验证使用现有验证实用程序
8. 样式与当前 Tailwind CSS 类保持一致
9. 与 WebDAVService 集成进行连接测试
10. 模态打开时现有 UI 保持功能（非阻塞）

### 质量需求

11. 密码字段实现适当的掩码与显示/隐藏切换
12. URL 验证包括协议检查（首选 https）
13. 必需字段有效之前禁用表单提交
14. 连接失败的清晰错误消息
15. 所有异步操作的加载状态

## 技术说明

### 集成方法
- 扩展现有的 BaseModal 组件
- 使用现有的表单验证可组合项
- 将配置存储在现有的 Pinia 配置存储中
- 使用现有通知服务显示成功/错误消息

### 现有模式参考
- 遵循现有 SettingsModal 组件结构
- 使用相同的表单字段组件和样式
- 应用一致的按钮样式和间距

### 关键约束
- 凭据在存储到浏览器之前必须加密
- 模态必须在移动设备上响应式（最小 320px）
- 连接测试超时：10 秒
- 最多 5 个保存的配置文件

## 实现细节

### 组件结构
```vue
<template>
  <BaseModal
    v-model="isOpen"
    title="WebDAV Configuration"
    size="md"
  >
    <form @submit.prevent="handleSubmit">
      <!-- Server URL Field -->
      <FormField
        v-model="config.url"
        label="WebDAV Server URL"
        type="url"
        placeholder="https://webdav.example.com"
        :error="errors.url"
        required
      />
      
      <!-- Username Field -->
      <FormField
        v-model="config.username"
        label="Username (Optional)"
        type="text"
        :error="errors.username"
      />
      
      <!-- Password Field -->
      <FormField
        v-model="config.password"
        label="Password (Optional)"
        type="password"
        :show-toggle="true"
        :error="errors.password"
      />
      
      <!-- Profile Name -->
      <FormField
        v-model="config.profileName"
        label="Profile Name"
        placeholder="My WebDAV Server"
      />
      
      <!-- Action Buttons -->
      <div class="flex gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          @click="testConnection"
          :loading="testing"
        >
          Test Connection
        </Button>
        
        <Button
          type="submit"
          variant="primary"
          :disabled="!isValid"
        >
          Save Configuration
        </Button>
      </div>
    </form>
    
    <!-- Saved Profiles Section -->
    <div v-if="savedProfiles.length" class="mt-6 border-t pt-4">
      <h3 class="text-sm font-medium mb-2">Saved Profiles</h3>
      <ProfileList
        :profiles="savedProfiles"
        @select="loadProfile"
        @delete="deleteProfile"
      />
    </div>
  </BaseModal>
</template>
```

### 存储结构
```typescript
// webdavStore.ts
interface WebDAVProfile {
  id: string;
  name: string;
  url: string;
  username?: string;
  // password stored separately in secure storage
  lastUsed: Date;
  isActive: boolean;
}

interface WebDAVStore {
  profiles: WebDAVProfile[];
  activeProfile: WebDAVProfile | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  
  // Actions
  saveProfile(profile: WebDAVProfile): Promise<void>;
  deleteProfile(id: string): void;
  setActiveProfile(id: string): Promise<void>;
  testConnection(config: WebDAVConfig): Promise<boolean>;
}
```

### 安全实现
```typescript
// Credential encryption using Web Crypto API
class CredentialManager {
  private async getKey(): Promise<CryptoKey> {
    // Derive key from user-specific salt
  }
  
  async encrypt(password: string): Promise<string> {
    // Encrypt using AES-GCM
  }
  
  async decrypt(encrypted: string): Promise<string> {
    // Decrypt stored credentials
  }
}
```

## 完成定义

- ✅ 配置模态完全功能，包含所有字段
- ✅ 测试连接功能正常工作并有适当反馈
- ✅ 可以保存和切换多个配置文件
- ✅ 凭据在浏览器存储中加密
- ✅ UI 遵循现有 Tailwind CSS 设计模式
- ✅ 表单验证正常工作，错误消息清晰
- ✅ 连接状态指示器在主 UI 中可见
- ✅ 模态在移动设备上响应式
- ✅ 配置逻辑的单元测试
- ✅ 配置工作流的 E2E 测试

## 风险和兼容性检查

### 风险评估

**主要风险：** 浏览器存储中的凭据安全性
- **缓解措施：** 使用 Web Crypto API 进行加密
- **回滚方案：** 选择不保存凭据，每次会话手动输入

**次要风险：** 连接测试期间的 CORS 问题
- **缓解措施：** 清晰的错误消息和设置说明
- **回滚方案：** 跳过测试，允许手动配置

### 兼容性验证

- ✅ 不对现有 UI 组件产生破坏性更改
- ✅ 不需要数据库更改
- ✅ UI 更改遵循现有模式
- ✅ 性能影响可忽略不计
- ✅ 现有模态继续正常运行

## 估算

**故事点数：** 5
**预估时间：** 8-10 小时
**依赖项：** Story 1.2 (WebDAV 服务)

## 测试策略

### 单元测试
1. 表单验证逻辑
2. 配置文件管理（CRUD 操作）
3. 凭据加密/解密
4. 存储操作和变更

### 集成测试
1. 模态打开/关闭行为
2. 表单提交流程
3. 与 WebDAVService 的连接测试
4. 配置文件切换功能
5. 错误处理场景

### E2E 测试
1. 完整配置工作流
2. 保存和加载配置文件
3. 与真实服务器的连接测试
4. 跨会话的凭据持久化

## 开发人员注意事项

- 使用现有的 BaseModal 和 FormField 组件
- 利用现有验证可组合项（useFormValidation）
- 考虑添加"从 URL 导入"功能进行自动配置
- 添加键盘快捷键（Escape 关闭，Enter 提交）
- 在列表顶部显示最近使用的配置文件
- 考虑在可折叠部分添加高级选项
- 为配置字段添加帮助文本/工具提示
- 清除提交中的任何测试凭据