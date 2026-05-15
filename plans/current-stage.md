# 当前阶段状态

## 当前阶段

第 9 阶段：结果汇总与证据展示 MVP

## 上一阶段完成情况

第 8 阶段：前后端联调已完成。

### 已完成产物

- frontend/src/types/task.ts
- frontend/src/api/tasks.ts
- frontend/src/pages/HomePage.vue
- frontend/src/pages/TaskPage.vue
- frontend/vite.config.ts
- plans/current-stage.md

### 第 8 阶段自测结果

通过（存在截图环境限制）。

自测内容：

1. 在 frontend 目录执行 npm run typecheck，确认 Vue/TypeScript 类型检查通过。
2. 在 backend 目录执行 npm run typecheck，确认后端 TypeScript 类型检查通过。
3. 在 frontend 目录执行 npm run build，确认前端生产构建通过。
4. 启动 backend dev server 后使用 curl 验证 POST /api/tasks、GET /api/tasks/:taskId、POST /api/tasks/:taskId/resume、POST /api/tasks/:taskId/pause、POST /api/tasks/:taskId/platforms/:platform/skip 调用路径可用。
5. 使用 curl 验证 POST /api/tasks/:taskId/platforms/:platform/manual-verification 与 POST /api/tasks/:taskId/platforms/:platform/manual-verification/resume 调用路径可用。
6. 尝试使用 Playwright 对前端页面截图；当前环境缺少 Playwright 浏览器可执行文件，截图未生成，该项判定为环境限制。

### 修改文件列表

- 新增 frontend/src/types/task.ts
- 新增 frontend/src/api/tasks.ts
- 更新 frontend/src/pages/HomePage.vue
- 更新 frontend/src/pages/TaskPage.vue
- 更新 frontend/vite.config.ts
- 更新 plans/current-stage.md

### 本阶段完成内容

- 新增前端任务领域类型，和后端 TaskDetail、PlatformTask、ManualVerificationRecord、SearchCriteria 等 MVP 数据结构对齐。
- 新增前端任务 API 客户端，封装创建任务、查询任务详情、暂停、恢复、平台跳过、人工验证恢复等接口调用。
- 将首页占位改造为可提交的酒店查询表单，支持目的地、入住/离店日期、人数、关键词、价格范围、距离筛选、平台选择和排序方式。
- 首页提交成功后调用 POST /api/tasks 创建任务，并自动跳转到 /tasks/:taskId。
- 将任务执行页占位改造为任务详情页，可通过 GET /api/tasks/:taskId 展示任务状态、查询条件、平台子任务状态、当前步骤、问题信息和人工验证信息。
- 任务执行页新增刷新、开始/恢复、暂停、平台跳过和人工验证完成后继续按钮，打通第 8 阶段要求的前后端调用路径。
- 为 Vite dev server 增加 /api 与 /health 代理到本地后端 http://localhost:3100，便于本地联调。
- 保持单用户、本地运行、单平台优先 MVP 约束；不实现真实平台采集、不实现浏览器直播、不实现多用户、不实现自动验证码、不自动下单。

### 自测步骤

1. npm run typecheck（frontend 目录）
2. npm run typecheck（backend 目录）
3. npm run build（frontend 目录）
4. npm run dev（backend 目录）
5. curl smoke：创建任务、查询任务、恢复任务、暂停任务、跳过平台
6. curl smoke：登记人工验证、恢复人工验证
7. npm run dev -- --host 127.0.0.1（frontend 目录）
8. node -e "const { chromium } = require('playwright'); ..."（backend 目录，尝试截图）

### 自测结果

- frontend npm run typecheck 通过。
- backend npm run typecheck 通过。
- frontend npm run build 通过。
- curl smoke 验证任务创建、详情查询、恢复、暂停、平台跳过接口均可用。
- curl smoke 验证人工验证登记和人工验证恢复接口均可用。
- 前端 dev server 可启动，Vite 本地地址为 http://127.0.0.1:5173/。
- Playwright 截图失败，原因是当前环境缺少 chromium_headless_shell 浏览器可执行文件，提示需要运行 npx playwright install；该项判定为环境限制。

### 已知问题

- 当前前端结果页仍为占位，结果汇总与证据展示留待第 9 阶段实现。
- 当前任务、平台子任务、人工验证记录仍为内存 MVP，进程重启后数据会丢失，后续可替换为 SQLite。
- 当前前端“查看浏览器”仅展示后续阶段占位，不实现浏览器直播。
- 当前阶段不实现真实平台采集，因此平台子任务状态需要通过后端已有 MVP 接口或后续采集流程推进。

### 风险点

- 前端类型与后端类型目前为手工同步，后续如果 API 结构变化，需要同步更新 frontend/src/types/task.ts。
- 人工验证恢复按钮依赖后端返回 waiting 状态的人工验证记录；真实采集接入后需要继续验证多平台并发状态展示。
- Vite 代理默认指向 http://localhost:3100，若后端端口变更需要同步调整或引入环境变量。

## 阶段目标

实现任务结果汇总与证据展示 MVP，让任务结果页能够展示各平台采集结果、详情确认价、最低价标记、可信度和截图/URL/采集时间等证据信息。

## 当前阶段要求

- 前端可以进入结果页并查询任务结果
- 后端提供任务结果查询 MVP 接口
- 结果列表展示酒店名称、位置、平台来源、列表页价格、详情页确认价格、是否最低价、可信度、截图证据、采集时间
- 结果汇总应能标记当前最低详情价
- 证据展示保持本地文件/路径 MVP，不实现云存储
- 保持单用户、本地运行、单平台优先的 MVP 约束
- 不实现真实平台采集
- 不实现自动下单
- 不实现价格实时有效承诺
- 不采集用户隐私数据

## 完成标准

- GET /api/tasks/:taskId/results 返回任务结果 MVP 数据
- 结果页能根据 taskId 展示后端返回的结果列表
- 结果页能展示最低价、可信度和证据信息
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 10 阶段：事件流与任务进度推送 MVP
