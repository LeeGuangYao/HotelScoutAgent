# 当前阶段状态

## 当前阶段

第 6 阶段：任务系统与状态机 MVP

## 上一阶段完成情况

第 5 阶段：Browser Agent MVP 已完成。

### 已完成产物

- backend/package.json
- backend/src/modules/browser/index.ts
- backend/src/modules/browser/browser.types.ts
- backend/src/modules/browser/browser-agent.ts
- backend/src/modules/browser/browser-manager.ts
- backend/src/modules/task/task.service.ts

### 第 5 阶段自测结果

通过（存在环境限制）。

自测内容：

1. 使用 Node 解析 backend/package.json，确认 JSON 格式有效，且 Playwright 依赖已加入后端依赖清单。
2. 检查 backend/src/modules/browser 下文件列表，确认 Browser Agent、Browser Manager、类型定义与模块出口均已建立。
3. 尝试在 backend 目录执行 npm install --package-lock-only --ignore-scripts；受当前 npm registry/proxy 策略影响，访问 @fastify/cors 返回 403 Forbidden，未生成 package-lock。该项判定为环境限制。
4. 尝试在 backend 目录执行 npm run typecheck；由于依赖未安装，TypeScript 无法找到 @types/node，未完成编译检查。该项由依赖安装环境限制导致，不影响本阶段代码结构检查结论。

### 修改文件列表

- 更新 backend/package.json
- 新增 backend/src/modules/browser/index.ts
- 新增 backend/src/modules/browser/browser.types.ts
- 新增 backend/src/modules/browser/browser-agent.ts
- 新增 backend/src/modules/browser/browser-manager.ts
- 更新 backend/src/modules/task/task.service.ts
- 更新 plans/current-stage.md

### 本阶段完成内容

- Browser Agent MVP 模块已建立，提供统一出口 createBrowserAgent 与 BrowserAgent 类。
- Browser Manager 已实现基于 Playwright persistent context 的会话启动、关闭、复用与列表查询。
- 已按平台隔离 browser-profiles/{platform} 持久化目录，避免平台状态互相污染。
- 已预留通用导航、截图证据保存、人工验证请求、等待与恢复接口。
- TaskService 已注入 BrowserAgent，并暴露可供后续任务调度层调用的浏览器会话与人工验证方法。
- 未实现真实平台采集、未实现任何平台 Adapter 业务逻辑、未破解或绕过验证码、未实现前端联调。

### 自测步骤

1. node -e "JSON.parse(require('fs').readFileSync('backend/package.json','utf8')); console.log('backend/package.json ok')"
2. find backend/src/modules/browser -maxdepth 1 -type f -print | sort
3. npm install --package-lock-only --ignore-scripts（backend 目录）
4. npm run typecheck（backend 目录）

### 自测结果

- backend/package.json JSON 解析通过。
- browser 模块文件结构检查通过。
- npm install 受 registry/proxy 策略影响失败，返回 403 Forbidden，判定为环境限制。
- npm run typecheck 因 node_modules 未安装失败，缺少 @types/node，判定为环境限制。

### 已知问题

- 当前环境访问 npm registry 时返回 403 Forbidden，依赖未能安装，因此未生成 package-lock，也无法完成 TypeScript 编译验证。
- Playwright 首次真实运行仍需要在可联网或已缓存依赖的环境中安装 npm 依赖，并按需要安装浏览器二进制。

### 风险点

- 真实浏览器启动依赖本机图形环境、Playwright 浏览器二进制与 npm 依赖安装状态；在无图形界面环境下可能需要额外配置 xvfb 或改用 headless。
- Browser Agent 当前仅提供生命周期与暂停/恢复基础能力，尚未接入任务状态机、任务事件推送或平台 Adapter。

## 阶段目标

实现任务系统与状态机 MVP，使后端能够创建任务、保存任务、按合法状态流转，并为 Browser Agent 调度预留入口。

## 当前阶段要求

- 可以实现任务创建与查询的最小可用逻辑
- 可以实现任务状态机合法流转判断
- 可以实现内存或 SQLite 任务存储 MVP
- 可以实现调度器 enqueue / stop 的最小可用逻辑
- 可以将 Browser Agent 作为后续调度执行依赖注入
- 不实现真实平台采集
- 不实现多平台 Adapter 业务逻辑
- 不破解验证码
- 不绕过滑块验证
- 不自动下单
- 不实现前端联调

## 完成标准

- 任务创建成功
- 任务查询成功
- 状态流转边界清晰
- 调度器 MVP 可调用
- 自测通过

## 阶段完成后

如果自测通过，自动将当前阶段更新为：

第 7 阶段：人工验证流程 MVP
