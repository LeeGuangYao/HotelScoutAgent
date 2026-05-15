# 当前阶段状态

## 当前阶段

第 11 阶段：截图文件服务与证据预览增强 MVP

## 上一阶段完成情况

第 10 阶段：事件流与任务进度推送 MVP 已完成。

### 已完成产物

- backend/src/modules/task/task.types.ts
- backend/src/modules/task/task.service.ts
- backend/src/modules/task/task.controller.ts
- frontend/src/types/task.ts
- frontend/src/api/tasks.ts
- frontend/src/pages/TaskPage.vue
- plans/current-stage.md

### 第 10 阶段自测结果

通过。

自测内容：

1. 在 backend 目录执行 npm run typecheck，确认后端 TypeScript 类型检查通过。
2. 在 frontend 目录执行 npm run typecheck，确认 Vue/TypeScript 类型检查通过。
3. 在 frontend 目录执行 npm run build，确认前端生产构建通过。
4. 启动 backend dev server 后使用 curl 验证 POST /api/tasks 创建任务可用。
5. 使用 curl -N 验证 GET /api/tasks/:taskId/events 返回 text/event-stream 任务快照事件。
6. 在事件流连接期间触发 POST /api/tasks/:taskId/resume，验证事件流可观察 task_status_changed 事件。
7. 使用 curl 验证人工验证请求与恢复接口仍可用，并确认任务详情中的人工验证状态可从 waiting 更新为 resumed。

### 修改文件列表

- 更新 backend/src/modules/task/task.types.ts
- 更新 backend/src/modules/task/task.service.ts
- 更新 backend/src/modules/task/task.controller.ts
- 更新 frontend/src/types/task.ts
- 更新 frontend/src/api/tasks.ts
- 更新 frontend/src/pages/TaskPage.vue
- 更新 plans/current-stage.md

### 本阶段完成内容

- 新增 TaskEvent、TaskEventSnapshot、TaskEventResultsSummary 等事件流领域类型，用于统一描述任务快照、任务状态、平台状态、人工验证和结果数量变化。
- 后端 TaskService 增加单进程内存 EventEmitter 事件发布与订阅能力，保持单用户、本地运行、无复杂消息队列的 MVP 约束。
- 后端在任务状态变化时发布 task_status_changed 事件。
- 后端在平台状态变化时发布 platform_status_changed 事件，并附带当前结果数量摘要。
- 后端在人工验证请求和恢复时分别发布 manual_verification_requested 与 manual_verification_resumed 事件。
- 后端在创建 MVP 示例结果后发布 results_count_changed 事件，并为事件流初始快照提供结果数量摘要。
- 将 GET /api/tasks/:taskId/events 从 501 占位改为 SSE 事件流接口；连接后立即发送 task_snapshot，并通过 heartbeat 保持连接。
- 前端新增 createTaskEventSource API 客户端，并同步任务事件类型。
- 任务执行页进入后自动订阅当前 taskId 的事件流，收到任务快照后更新任务详情和结果数量。
- 任务执行页收到任务状态、平台状态、人工验证请求/恢复和结果数量变化事件后进行局部更新，减少手动刷新依赖。
- 任务执行页新增实时更新提示、最近事件时间和重新连接按钮；事件流断开或浏览器不支持 EventSource 时提示可手动刷新降级。
- 保持不实现复杂消息队列、不实现多用户权限隔离、不实现浏览器直播、不实现真实平台采集的阶段边界。

### 自测步骤

1. npm run typecheck（backend 目录）
2. npm run typecheck（frontend 目录）
3. npm run build（frontend 目录）
4. npm run dev（backend 目录）
5. curl smoke：创建任务并订阅 GET /api/tasks/:taskId/events
6. curl smoke：事件流连接期间触发 POST /api/tasks/:taskId/resume 并观察 task_status_changed
7. curl smoke：触发人工验证请求与恢复，并查询任务详情确认状态变更

### 自测结果

- backend npm run typecheck 通过。
- frontend npm run typecheck 通过。
- frontend npm run build 通过。
- curl smoke 验证任务创建成功。
- curl -N 验证 GET /api/tasks/:taskId/events 会返回 task_snapshot 事件，包含 detail 与 resultsSummary。
- curl smoke 验证事件流连接期间触发任务恢复后可观察 task_status_changed 事件。
- curl smoke 验证人工验证请求与恢复接口可用，最终任务详情中的人工验证记录状态为 resumed。

### 已知问题

- 当前事件流为单进程内存 EventEmitter，服务重启后连接和任务内存数据都会丢失。
- 当前结果数量来自第 9 阶段的 MVP 示例数据，不代表真实平台采集结果。
- 当前浏览器端通过 EventSource 自动重连，未实现断点事件重放或 Last-Event-ID 历史补偿。
- 当前仍不提供浏览器直播能力，仅推送任务状态与进度事件。

### 风险点

- 前端事件类型与后端事件类型目前为手工同步，后续如果事件结构变化，需要同步更新 frontend/src/types/task.ts。
- SSE 长连接依赖单个 Node.js 进程；后续如果扩展为多进程或多用户，需要引入更明确的会话、权限和事件分发机制。
- 当前任务页对事件进行局部更新；如果后续事件负载变复杂，需要补充全量刷新或版本号校验机制避免状态不一致。

## 阶段目标

实现截图文件服务与证据预览增强 MVP，让结果页和任务页可以通过受控接口预览本地截图证据，而不是只展示文件路径。

## 当前阶段要求

- 后端提供本地截图文件读取/预览 MVP 接口
- 接口必须限制在项目约定的 screenshots 目录内，避免任意文件读取
- 前端结果页截图证据弹窗可以展示图片预览
- 前端在截图不存在或不可访问时显示友好降级提示
- 保持单用户、本地运行约束
- 不实现云存储
- 不实现复杂权限系统
- 不实现真实平台采集

## 完成标准

- 截图证据可通过后端受控接口访问
- 结果页证据弹窗能展示截图预览或明确错误提示
- 路径安全检查通过自测
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 12 阶段：SQLite 持久化存储 MVP
