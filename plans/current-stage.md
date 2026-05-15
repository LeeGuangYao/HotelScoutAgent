# 当前阶段状态

## 当前阶段

第 12 阶段：SQLite 持久化存储 MVP

## 上一阶段完成情况

第 11 阶段：截图文件服务与证据预览增强 MVP 已完成。

### 已完成产物

- backend/src/app.ts
- backend/src/shared/paths.ts
- backend/src/modules/browser/browser-agent.ts
- backend/src/modules/evidence/evidence.controller.ts
- frontend/src/api/tasks.ts
- frontend/src/pages/ResultsPage.vue
- frontend/src/pages/TaskPage.vue
- plans/current-stage.md

### 第 11 阶段自测结果

通过。

自测内容：

1. 在 backend 目录执行 npm run typecheck，确认后端 TypeScript 类型检查通过。
2. 在 frontend 目录执行 npm run typecheck，确认 Vue/TypeScript 类型检查通过。
3. 在 frontend 目录执行 npm run build，确认前端生产构建通过。
4. 启动 backend dev server 后使用 curl 验证 GET /health 可用。
5. 使用 curl 验证 POST /api/tasks 创建任务仍可用。
6. 在项目 screenshots 目录创建临时 PNG 后，使用 curl 验证 GET /api/evidence/screenshots/preview?path=... 返回 200 与 image/png。
7. 使用 curl 验证 ../AGENTS.md.png 等越权路径返回 400，确认不会读取 screenshots 目录外文件。
8. 使用 curl 验证不存在的截图文件返回 404 与明确错误信息。

### 修改文件列表

- 新增 backend/src/shared/paths.ts
- 新增 backend/src/modules/evidence/evidence.controller.ts
- 更新 backend/src/app.ts
- 更新 backend/src/modules/browser/browser-agent.ts
- 更新 frontend/src/api/tasks.ts
- 更新 frontend/src/pages/ResultsPage.vue
- 更新 frontend/src/pages/TaskPage.vue
- 更新 plans/current-stage.md

### 本阶段完成内容

- 后端新增截图证据预览接口 GET /api/evidence/screenshots/preview，通过 query path 接收截图路径并以图片流返回。
- 截图预览接口仅允许访问项目约定的 screenshots 目录内文件，支持相对 screenshots 路径和目录内绝对路径，并通过 path.relative 做越权检查。
- 截图预览接口限制可预览文件类型为 png、jpg、jpeg、webp，并在响应中设置 no-store 与 X-Content-Type-Options: nosniff。
- 截图不存在、路径非法或文件格式不受支持时返回明确错误码，方便前端友好降级。
- 新增项目根目录与 screenshots 目录解析工具，避免从 backend 目录启动服务时截图目录漂移。
- BrowserAgent 默认截图根目录切换为项目 screenshots 目录，保持后续截图生成和预览接口路径一致。
- 前端 API 新增 getScreenshotPreviewUrl，统一构造受控截图预览接口 URL。
- 结果页截图证据弹窗从仅展示本地路径升级为图片预览；图片加载失败时显示友好降级提示，并继续保留原始路径。
- 任务页人工验证卡片新增截图预览缩略图；图片不存在或不可访问时显示友好提示。
- 保持单用户、本地运行约束，不实现云存储、复杂权限系统或真实平台采集。

### 自测步骤

1. npm run typecheck（backend 目录）
2. npm run typecheck（frontend 目录）
3. npm run build（frontend 目录）
4. npm run dev（backend 目录）
5. curl smoke：GET /health
6. curl smoke：POST /api/tasks 创建任务
7. curl smoke：GET /api/evidence/screenshots/preview?path=screenshots%2Fsmoke%2Fpreview.png 验证本地 PNG 可预览
8. curl smoke：GET /api/evidence/screenshots/preview?path=..%2FAGENTS.md.png 验证路径越权被拒绝
9. curl smoke：GET /api/evidence/screenshots/preview?path=screenshots%2Fsmoke%2Fmissing.png 验证缺失文件友好报错

### 自测结果

- backend npm run typecheck 通过。
- frontend npm run typecheck 通过。
- frontend npm run build 通过。
- curl smoke 验证 GET /health 返回 200。
- curl smoke 验证 POST /api/tasks 返回 201，任务创建接口未回归。
- curl smoke 验证项目 screenshots 目录内 PNG 返回 200，Content-Type 为 image/png。
- curl smoke 验证 ../AGENTS.md.png 越权路径返回 400 INVALID_SCREENSHOT_PATH。
- curl smoke 验证不存在的截图返回 404 SCREENSHOT_NOT_FOUND。

### 已知问题

- 当前截图预览接口仅服务本地文件，不提供云存储、签名 URL 或 CDN 缓存。
- 当前没有复杂权限系统；MVP 仍默认单用户、本地运行。
- 当前任务结果仍来自 MVP 示例数据，示例截图路径可能没有真实文件，因此前端会展示降级提示。
- 当前图片预览依赖浏览器 img 加载错误事件做降级，未实现单独的证据元数据探测接口。

### 风险点

- 如果后续引入多用户或远程部署，需要为截图证据接口增加任务归属校验、访问授权和更严格的审计。
- 如果后续截图存储路径迁移到 SQLite 或云存储，需要同步调整 getScreenshotsRoot、BrowserAgent 截图保存逻辑和前端预览 URL 生成逻辑。
- 目前前端结果页和任务页都手工引用截图预览 URL；后续可抽取 EvidencePreview 组件减少重复。

## 阶段目标

实现 SQLite 持久化存储 MVP，让任务、平台进度、人工验证记录和 MVP 结果在服务重启后可以恢复。

## 当前阶段要求

- 引入 SQLite 本地持久化存储
- 持久化任务基础信息、平台任务、人工验证记录和酒店结果
- 保持现有任务 API 返回结构兼容
- 服务启动后可以读取已有任务数据
- 保留单用户、本地运行约束
- 不实现多用户权限系统
- 不实现复杂迁移框架
- 不实现真实平台采集

## 完成标准

- 创建任务后数据写入 SQLite
- 服务重启后可通过任务 ID 查询任务详情和结果
- 现有任务控制、人工验证、结果查询与事件流 MVP 不回归
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 13 阶段：平台 Adapter 接口与 Mock 采集流程 MVP
