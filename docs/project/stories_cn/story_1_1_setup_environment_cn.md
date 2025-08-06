# 故事 1.1：设置开发环境和项目结构 - 棕地添加

## 用户故事

作为开发者，
我想要建立增强的项目结构和新包，
以便我可以构建新功能而不破坏现有功能。

## 故事背景

### 现有系统集成

- **集成对象：** 现有 Vue 3.4+ monorepo 结构
- **技术：** Vue 3.4+，TypeScript 5.0+，Vite 5.0+，Pinia 状态管理
- **遵循模式：** 当前 monorepo 包组织
- **接触点：** 构建系统，TypeScript 配置，现有优化包

## 验收标准

### 功能性需求

1. 在 monorepo 结构中创建 @prompt-manager/webdav 包，配置适当的 TypeScript
2. 在 monorepo 结构中创建 @prompt-manager/editor 包，配置适当的 TypeScript
3. 使用 Nextcloud Docker 设置开发 WebDAV 服务器用于测试
4. 更新根 package.json 以在工作区中包含新包
5. 配置 Vite 构建系统以处理新包，实现适当的代码分割

### 集成需求

6. 现有优化功能保持完全功能正常和可访问
7. 构建过程完成时所有包（包括现有包）无错误
8. TypeScript 配置正确扩展自根 tsconfig.json
9. 开发服务器成功启动，加载所有包
10. 现有优化功能无性能回归

### 质量需求

11. 新包遵循现有文件夹结构约定
12. ESLint 和 Prettier 配置扩展到新包
13. Git 钩子对所有包继续工作
14. 为每个新包创建 README 文件，记录用途和设置

## 技术说明

### 集成方法
- 通过向 packages/ 目录添加包来扩展现有 monorepo 结构
- 在适用的情况下通过根 package.json 共享通用依赖项
- 使用工作区协议处理包间依赖

### 现有模式参考
- 遵循现有 @prompt-manager/optimizer 包结构
- 使用相同的 TypeScript 严格模式设置
- 在各包间应用一致的 ESLint/Prettier 规则

### 关键约束
- 必须与现有构建过程保持向后兼容性
- 不能修改现有优化包结构
- WebDAV 服务器必须容器化以便于设置/拆除

## 实施详情

### 包结构
```
packages/
├── optimizer/ (existing - do not modify)
├── webdav/
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
└── editor/
    ├── src/
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

### WebDAV 测试服务器设置
```yaml
# docker-compose.dev.yml
version: '3'
services:
  webdav:
    image: nextcloud:latest
    ports:
      - "8080:80"
    environment:
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD=admin
    volumes:
      - ./test-data:/var/www/html/data
```

## 完成定义

- ✅ 两个新包都已创建并正确配置
- ✅ 所有包的 TypeScript 编译成功
- ✅ 开发 WebDAV 服务器可在 localhost:8080 访问
- ✅ 现有优化功能验证工作正常
- ✅ 构建过程在 30 秒内完成
- ✅ 所有现有测试通过且无需修改
- ✅ 新包 README 文件记录设置过程
- ✅ 运行开发服务器时无控制台错误
- ✅ Git 提交遵循现有提交消息约定

## 风险和兼容性检查

### 风险评估

**主要风险：** 包之间的构建系统冲突
- **缓解：** 每次添加包后测试构建过程
- **回滚：** 如果构建失败，从工作区中移除新包

**次要风险：** TypeScript 版本冲突
- **缓解：** 确保所有包使用相同的 TypeScript 版本
- **回滚：** 在根 package.json 中固定 TypeScript 版本

### 兼容性验证

- ✅ 对现有 API 无破坏性更改
- ✅ 不需要数据库更改
- ✅ 此故事中无 UI 更改
- ✅ 构建时间影响 < 5 秒
- ✅ 开发服务器内存使用增加 < 50MB

## 估算

**故事点：** 3
**估算小时：** 4-6 小时
**依赖：** 无（史诗中的第一个故事）

## 测试策略

1. 验证现有优化 UI 正确加载
2. 使用 `npm run build` 测试构建过程
3. 使用 `npm run type-check` 确认 TypeScript 编译
4. 验证 WebDAV 服务器在 localhost:8080 的连接
5. 运行现有测试套件确保无回归

## 开发者注意事项

- 从最小的 package.json 配置开始，根据需要添加依赖项
- 使用 `npm workspace` 命令进行包特定操作
- 在包 README 中记录与现有模式的任何偏差
- 如果构建性能成为问题，考虑使用 Turborepo
- 将 WebDAV 测试数据保存在 .gitignore 中