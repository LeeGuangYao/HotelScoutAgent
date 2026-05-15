# 当前阶段状态

## 当前阶段

第 10 阶段：事件流与任务进度推送 MVP

## 上一阶段完成情况

第 9 阶段：结果汇总与证据展示 MVP 已完成。

### 已完成产物

- backend/src/modules/task/task.types.ts
- backend/src/modules/task/task.repository.ts
- backend/src/modules/task/task.service.ts
- backend/src/modules/task/task.controller.ts
- frontend/src/types/task.ts
- frontend/src/api/tasks.ts
- frontend/src/router/index.ts
- frontend/src/pages/TaskPage.vue
- frontend/src/pages/ResultsPage.vue
- plans/current-stage.md

### 第 9 阶段自测结果

通过（存在截图环境限制）。

自测内容：

1. 在 backend 目录执行 npm run typecheck，确认后端 TypeScript 类型检查通过。
2. 在 frontend 目录执行 npm run typecheck，确认 Vue/TypeScript 类型检查通过。
3. 在 frontend 目录执行 npm run build，确认前端生产构建通过。
4. 启动 backend dev server 后使用 curl 验证 POST /api/tasks 创建任务可用。
5. 使用 curl 验证 GET /api/tasks/:taskId/results 返回结果汇总、最低详情价标记和酒店结果列表。
6. 启动 frontend dev server 并尝试使用 Playwright 打开 /tasks/:taskId/results 截图；当前环境缺少 Playwright 浏览器可执行文件，截图未生成，该项判定为环境限制。

### 修改文件列表

- 更新 backend/src/modules/task/task.types.ts
- 更新 backend/src/modules/task/task.repository.ts
- 更新 backend/src/modules/task/task.service.ts
- 更新 backend/src/modules/task/task.controller.ts
- 更新 frontend/src/types/task.ts
- 更新 frontend/src/api/tasks.ts
- 更新 frontend/src/router/index.ts
- 更新 frontend/src/pages/TaskPage.vue
- 更新 frontend/src/pages/ResultsPage.vue
- 更新 plans/current-stage.md

### 本阶段完成内容

- 新增 Money、TrustLevel、HotelResult、TaskResultsSummary、TaskResults 等任务结果领域类型。
- 后端内存仓库新增酒店结果保存与查询能力，保持单用户、本地运行、MVP 内存存储约束。
- 创建任务时生成与查询条件、平台选择关联的结果展示 MVP 示例数据，不接入真实平台采集。
- 新增 TaskService.getTaskResults，按详情页确认价计算当前最低详情价，并统计总结果数、详情价数量、平台数量和证据完整数量。
- 将 GET /api/tasks/:taskId/results 从 501 占位改为可用的 MVP 查询接口，任务不存在时返回 404。
- 前端新增 getTaskResults API 客户端并同步任务结果类型。
- 结果页从占位改为可按 taskId 加载后端结果，展示任务摘要、查询条件、结果统计、最低价、可信度、截图路径、来源 URL 和采集时间。
- 结果页支持平台筛选、可信度筛选、关键词搜索、仅看最低价、仅看有截图和清除筛选。
- 结果页新增截图证据弹窗，以本地文件/路径形式展示证据信息，不实现云存储或静态文件服务。
- 任务页新增“查看结果”入口，并新增 /tasks/:taskId/results 路由，同时保留 /results/:taskId 兼容入口。
- 保持不实现真实平台采集、不实现自动下单、不承诺价格实时有效、不采集用户隐私数据的阶段边界。

### 自测步骤

1. npm run typecheck（backend 目录）
2. npm run typecheck（frontend 目录）
3. npm run build（frontend 目录）
4. npm run dev（backend 目录）
5. curl smoke：创建任务并查询 GET /api/tasks/:taskId/results
6. npm run dev -- --host 127.0.0.1（frontend 目录）
7. node -e "const { chromium } = require('playwright'); ..."（backend 目录，尝试打开结果页截图）

### 自测结果

- backend npm run typecheck 通过。
- frontend npm run typecheck 通过。
- frontend npm run build 通过。
- curl smoke 验证任务创建成功，并验证 GET /api/tasks/:taskId/results 返回 totalResults、lowestDetailPrice、isLowestDetailPrice 和酒店名称等字段。
- 前端 dev server 可启动，Vite 本地地址为 http://127.0.0.1:5173/。
- Playwright 截图失败，原因是当前环境缺少 chromium_headless_shell 浏览器可执行文件，提示需要运行 npx playwright install；该项判定为环境限制。

### 已知问题

- 当前结果数据为 MVP 示例数据，来源于任务创建时的内存生成逻辑，不代表真实平台采集结果。
- 当前任务、平台子任务、人工验证记录和结果记录仍为内存 MVP，进程重启后数据会丢失，后续可替换为 SQLite。
- 当前截图证据仅展示本地路径，不提供静态文件服务，也不上传云存储。
- 当前结果页没有跨平台酒店去重合并算法，仅逐条展示平台结果。

### 风险点

- 前端类型与后端类型目前为手工同步，后续如果 API 结构变化，需要同步更新 frontend/src/types/task.ts。
- MVP 示例结果会让结果页在真实采集接入前可展示，但后续需要与真实采集流程的结果写入时机衔接。
- 结果页证据弹窗当前只展示路径，后续如果开放本地截图访问，需要额外处理路径安全和静态文件权限。

## 阶段目标

实现任务事件流与进度推送 MVP，让前端任务执行页可以接收后端任务状态、平台步骤、人工验证等待和结果数量变化的实时更新，减少手动刷新依赖。

## 当前阶段要求

- 后端提供任务事件流 MVP 接口
- 前端任务执行页可以订阅 taskId 对应事件流
- 事件至少覆盖任务状态变化、平台状态变化、人工验证请求/恢复、结果数量变化
- 前端收到事件后能刷新或局部更新任务详情
- 事件流保持单用户、本地运行约束
- 不实现复杂消息队列
- 不实现多用户权限隔离
- 不实现浏览器直播
- 不实现真实平台采集

## 完成标准

- GET /api/tasks/:taskId/events 返回可被前端订阅的事件流 MVP
- 任务执行页能根据事件流自动更新任务详情或进度提示
- 事件流断开时前端有降级提示或可手动刷新
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 11 阶段：截图文件服务与证据预览增强 MVP
