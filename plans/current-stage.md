# 当前阶段状态

## 当前阶段

第 13 阶段：平台 Adapter 接口与 Mock 采集流程 MVP

## 上一阶段完成情况

第 12 阶段：SQLite 持久化存储 MVP 已完成。

### 已完成产物

- backend/.gitignore
- backend/src/shared/paths.ts
- backend/src/modules/task/task.repository.ts
- backend/src/modules/task/task.service.ts
- backend/src/modules/task/task.controller.ts
- plans/current-stage.md

### 第 12 阶段自测结果

通过。

自测内容：

1. 在 backend 目录执行 npm run typecheck，确认后端 TypeScript 类型检查通过。
2. 在 frontend 目录执行 npm run typecheck，确认 Vue/TypeScript 类型检查通过。
3. 在 frontend 目录执行 npm run build，确认前端生产构建通过。
4. 启动 backend dev server 后使用 curl 验证 GET /health 可用。
5. 使用 curl 验证 POST /api/tasks 创建任务可用，并写入 SQLite。
6. 使用 curl 验证 POST /api/tasks/:taskId/platforms/:platform/manual-verification 可持久化人工验证记录。
7. 使用 curl 验证 GET /api/tasks/:taskId/results 可读取持久化的 MVP 酒店结果。
8. 重启 backend dev server 后，使用 curl 验证 GET /api/tasks/:taskId 可恢复任务基础信息、平台任务与人工验证记录。
9. 重启 backend dev server 后，使用 curl 验证 GET /api/tasks/:taskId/results 可恢复酒店结果。

### 修改文件列表

- 更新 backend/.gitignore
- 更新 backend/src/shared/paths.ts
- 更新 backend/src/modules/task/task.repository.ts
- 更新 backend/src/modules/task/task.service.ts
- 更新 backend/src/modules/task/task.controller.ts
- 更新 plans/current-stage.md

### 本阶段完成内容

- 将任务仓储从进程内 Map 替换为 Node.js 内置 SQLite DatabaseSync 持久化实现。
- 新增 backend/data/app.sqlite 默认数据库路径解析，并在启动时自动创建 backend/data 目录与 SQLite 表结构。
- 新增 tasks、platform_tasks、manual_verifications、hotel_results 四张 MVP 表，覆盖任务基础信息、平台任务、人工验证记录和酒店结果。
- 使用 JSON 字段保存查询条件、价格对象、可信度原因和人工验证恢复上下文，保持现有任务 API 返回结构兼容。
- 为任务、平台任务、人工验证记录和酒店结果实现 upsert 保存与按任务 ID 查询，服务重启后可以恢复历史任务详情和结果。
- 保留现有任务状态流转、人工验证、结果汇总和 SSE 快照逻辑；SSE 仍使用进程内实时事件，连接时会从 SQLite 读取最新快照。
- Fastify 关闭时释放 SQLite 连接。
- 将 backend/data 加入 .gitignore，避免提交本地运行生成的 SQLite 数据库文件。
- 保持单用户、本地运行约束，不实现多用户权限系统、复杂迁移框架或真实平台采集。

### 自测步骤

1. npm run typecheck（backend 目录）
2. npm run typecheck（frontend 目录）
3. npm run build（frontend 目录）
4. npm run dev（backend 目录，PORT=3102 LOG_LEVEL=silent）
5. curl smoke：GET /health
6. curl smoke：POST /api/tasks 创建任务
7. curl smoke：POST /api/tasks/:taskId/platforms/:platform/manual-verification 创建人工验证记录
8. curl smoke：GET /api/tasks/:taskId/results 查询结果汇总
9. 重启 backend dev server
10. curl smoke：GET /api/tasks/:taskId 验证任务详情恢复
11. curl smoke：GET /api/tasks/:taskId/results 验证任务结果恢复

### 自测结果

- backend npm run typecheck 通过。
- frontend npm run typecheck 通过。
- frontend npm run build 通过。
- curl smoke 验证 GET /health 返回 200。
- curl smoke 验证 POST /api/tasks 返回 201，并返回 taskId。
- curl smoke 验证人工验证请求后任务状态为 waiting_manual_verification，manualVerifications 数量为 1。
- curl smoke 验证结果查询返回 totalResults=4、platformCount=2。
- 重启服务后，curl smoke 验证同一 taskId 可恢复 waiting_manual_verification 状态、2 个平台任务和 1 条人工验证记录。
- 重启服务后，curl smoke 验证同一 taskId 可恢复 4 条酒店结果。

### 已知问题

- 当前 SQLite schema 只在启动时 CREATE TABLE IF NOT EXISTS，不提供版本化复杂迁移框架。
- 当前仍是单用户、本地运行设计，未实现任务归属权限校验。
- 当前实时事件订阅仍是进程内 EventEmitter；服务重启后不会回放历史事件，但 SSE 首包快照会从 SQLite 返回当前状态。
- 当前酒店结果仍来自 MVP 示例数据，不实现真实平台采集。

### 风险点

- 如果后续 schema 发生破坏性变化，需要补充轻量迁移或数据重建策略。
- 如果后续支持多用户或远程部署，需要补充任务权限、数据库访问审计和更严格的数据隔离。
- 如果未来要支持多进程并发写入，需要评估 SQLite 写锁、WAL 策略和任务调度互斥。

## 阶段目标

定义统一平台 Adapter 接口，并实现 Mock 平台采集流程，让任务调度能够通过 Adapter 产生平台进度、人工验证和酒店结果。

## 当前阶段要求

- 定义平台 Adapter 接口
- 为携程 / Booking / 飞猪 / 美团建立 Mock Adapter 骨架
- 调度任务时通过 Adapter 更新平台任务状态
- Mock Adapter 可生成列表价、详情价、截图路径和来源 URL
- Mock Adapter 可模拟人工验证等待与恢复
- 保持 SQLite 持久化、现有任务 API、结果查询和事件流 MVP 不回归
- 保留单用户、本地运行约束
- 不实现真实平台采集
- 不破解验证码或绕过验证

## 完成标准

- 创建任务后可通过 Mock Adapter 推进平台任务状态
- 平台进度、人工验证记录和 Mock 酒店结果可持久化
- 前端任务页和结果页可继续展示任务进度、人工验证和结果
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 14 阶段：真实浏览器平台打开与登录态检测 MVP
