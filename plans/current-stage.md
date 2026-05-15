# 当前阶段状态

## 当前阶段

第 8 阶段：前后端联调

## 上一阶段完成情况

第 7 阶段：人工验证流程 MVP 已完成。

### 已完成产物

- backend/src/modules/task/task.types.ts
- backend/src/modules/task/task.repository.ts
- backend/src/modules/task/task.service.ts
- backend/src/modules/task/task.controller.ts
- backend/src/modules/state-machine/task-state-machine.ts
- backend/src/modules/browser/browser-agent.ts
- plans/current-stage.md

### 第 7 阶段自测结果

通过（存在环境限制）。

自测内容：

1. 使用 Node 解析 backend/package.json，确认 JSON 格式有效。
2. 使用 TypeScript 6.0.3 与临时类型桩执行后端源码静态类型检查，验证本阶段 TypeScript 代码结构与类型关系可通过检查。
3. 尝试在 backend 目录执行 npm install --package-lock-only --ignore-scripts；受当前 npm registry/proxy 策略影响，访问 @fastify/cors 返回 403 Forbidden，未生成 package-lock。该项判定为环境限制。
4. 尝试通过 npx 下载 TypeScript 5.7.2 执行静态类型检查；受当前 npm registry/proxy 策略影响，访问 typescript 返回 403 Forbidden。该项判定为环境限制。
5. 尝试在 backend 目录执行 npm run typecheck；由于依赖未安装，TypeScript 无法找到 @types/node，未完成编译检查。该项由依赖安装环境限制导致。

### 修改文件列表

- 更新 backend/src/modules/task/task.types.ts
- 更新 backend/src/modules/task/task.repository.ts
- 更新 backend/src/modules/task/task.service.ts
- 更新 backend/src/modules/task/task.controller.ts
- 更新 backend/src/modules/state-machine/task-state-machine.ts
- 更新 backend/src/modules/browser/browser-agent.ts
- 更新 plans/current-stage.md

### 本阶段完成内容

- 扩展任务状态机，允许任务从 created 或 running 进入 waiting_manual_verification，并允许人工验证完成后恢复到 running。
- 扩展平台子任务记录，增加 manualVerificationId，用于关联当前人工验证记录。
- 新增内存版人工验证记录存储，记录任务、平台、原因、状态、截图路径、恢复上下文、请求时间、恢复时间、验证前任务状态和验证前平台状态。
- 扩展 TaskDetail，返回当前任务关联的人工验证记录，便于查询验证原因与平台信息。
- 实现 TaskService.requestManualVerification，可将主任务与平台子任务切换到 waiting_manual_verification，并在存在同任务同平台浏览器会话时衔接 BrowserAgent.requestManualVerification。
- 实现 TaskService.resumeManualVerification，可恢复 BrowserAgent 等待状态，将人工验证记录标记为 resumed，并将主任务恢复到 running、平台子任务恢复到验证前状态。
- 新增 HTTP MVP：POST /api/tasks/:taskId/platforms/:platform/manual-verification 用于登记人工验证暂停；POST /api/tasks/:taskId/platforms/:platform/manual-verification/resume 用于人工处理后恢复。
- 不破解验证码、不绕过滑块验证、不伪造登录态、不实现真实平台采集、不实现多平台 Adapter 业务逻辑、不自动下单、不实现前端联调。

### 自测步骤

1. node -e "JSON.parse(require('fs').readFileSync('backend/package.json','utf8')); console.log('backend/package.json ok')"
2. npm install --package-lock-only --ignore-scripts（backend 目录）
3. npx -y -p typescript@5.7.2 tsc -p /tmp/hotel-scout-tsconfig.json
4. tsc -p /tmp/hotel-scout-tsconfig.json（使用 /tmp/hotel-scout-typecheck-stubs.d.ts 临时类型桩）
5. npm run typecheck（backend 目录）

### 自测结果

- backend/package.json JSON 解析通过。
- npm install 受 registry/proxy 策略影响失败，返回 403 Forbidden，未生成 package-lock，判定为环境限制。
- npx 下载 TypeScript 5.7.2 受 registry/proxy 策略影响失败，返回 403 Forbidden，判定为环境限制。
- 使用系统已安装 TypeScript 6.0.3 与临时类型桩执行静态类型检查通过。
- npm run typecheck 因 node_modules 未安装失败，缺少 @types/node，判定为环境限制。

### 已知问题

- 当前环境访问 npm registry 时返回 403 Forbidden，依赖未能安装，因此未生成 package-lock，也无法完成项目原生 npm run typecheck。
- 当前任务、平台子任务、人工验证记录仍为内存 MVP，进程重启后数据会丢失，后续可替换为 SQLite。
- 人工验证恢复后仅将任务恢复到 running、平台子任务恢复到验证前状态，真实平台采集循环仍需后续阶段接入。
- 结果查询与事件流仍返回 501，留待后续结果汇总与事件推送阶段实现。

### 风险点

- 人工验证记录为内存存储，仅适合本地单用户 MVP。
- 如果后续真实采集循环同时触发多次同平台人工验证，需要补充更严格的活动验证去重策略。
- 当前 BrowserAgent 衔接仅在已存在同任务同平台浏览器会话时执行；无浏览器会话时只记录任务侧人工验证信息。

## 阶段目标

开展前后端联调，使已有首页查询页、任务执行页与后端任务创建、查询、暂停、恢复和人工验证接口完成 MVP 级打通。

## 当前阶段要求

- 前端可以调用后端 POST /api/tasks 创建任务
- 前端可以进入任务页并查询 GET /api/tasks/:taskId
- 前端可以展示任务状态、平台子任务状态和人工验证信息
- 前端可以调用暂停、恢复、平台跳过接口
- 前端可以在人工验证状态下调用恢复接口
- 保持单用户、本地运行、单平台优先的 MVP 约束
- 不实现真实平台采集
- 不实现浏览器直播
- 不实现多用户
- 不实现自动验证码
- 不自动下单

## 完成标准

- 首页提交查询后能创建任务并跳转任务页
- 任务页能展示后端返回的任务详情
- 暂停、恢复、跳过、人工验证恢复的接口调用路径可用
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 9 阶段：结果汇总与证据展示 MVP
