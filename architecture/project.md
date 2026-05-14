# 项目总体架构

## 1. 架构目标

Hotel Scout Agent 的目标是把“人工在多个酒店平台搜索并核价”的流程拆成可观测、可暂停、可恢复的采集任务。系统需要同时满足：

- 前端可提交查询条件并跟踪任务进度。
- 后端可管理任务生命周期、平台子任务、结果和证据。
- 浏览器 Agent 可用真实浏览器执行搜索、详情页核价和截图。
- 遇到登录、验证码、滑块等人工验证场景时，系统只暂停并等待用户处理，不做绕过。
- 所有价格结果都保留来源 URL、采集时间、截图证据和可信度标记。

## 2. 推荐技术栈

| 层级 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | Vue 3 + Vite + TypeScript | 适合快速构建单页应用，后续可拆分查询页、任务页、结果页。 |
| 前端状态 | Pinia | 管理查询条件、任务状态、平台进度与结果列表。 |
| 后端 | Node.js + Fastify + TypeScript | Fastify 轻量、插件生态成熟，适合 API 与事件通道。 |
| 浏览器自动化 | Playwright | 启动真实 Chromium，支持持久化浏览器 profile 与截图。 |
| 数据库 | SQLite | MVP 本地部署简单，适合任务、酒店结果、证据元数据存储。 |
| 实时通信 | Server-Sent Events（SSE）优先 | MVP 只需要服务端推送状态，复杂双向控制再升级 WebSocket。 |
| 文件存储 | 本地 `screenshots/` | 存放证据截图；数据库只保存相对路径和元数据。 |

## 3. 顶层目录规划

```txt
HotelScoutAgent/
├── docs/                    # 产品、流程与阶段管理文档
├── architecture/            # 第 1 阶段架构设计文档
├── specs/                   # 后续阶段拆分的页面/模块规格
├── frontend/                # 前端应用，当前阶段仅保留目录
├── backend/                 # 后端应用，当前阶段仅保留目录
├── screenshots/             # 采集证据截图，当前阶段仅保留目录
└── plans/                   # 阶段状态与计划
```

> 当前阶段只建立目录与架构文档，不初始化框架、不写业务代码。

## 4. 运行时组件关系

```txt
[浏览器中的前端]
        |
        | HTTP: 创建任务 / 查询详情 / 控制暂停继续
        | SSE: 订阅任务事件
        v
[后端 API + 任务调度器]
        |
        | 调用平台 Adapter
        v
[浏览器 Agent / Playwright Context]
        |
        | 访问真实平台页面
        v
[携程 / Booking / 飞猪 / 美团]

[后端 API + 任务调度器]
        |                         |
        | 写入任务/结果/证据元数据       | 保存截图文件
        v                         v
[SQLite]                    [screenshots/]
```

## 5. 数据流概览

1. 前端提交查询条件：城市、日期、人数、关键词、价格范围、平台、排序方式。
2. 后端校验请求并创建主任务与平台子任务。
3. 前端进入任务页，通过 SSE 订阅任务事件。
4. 任务调度器按平台启动或排队执行 Adapter。
5. Browser Agent 创建平台专属持久化浏览器 profile。
6. 平台 Adapter 执行搜索、采集列表价、进入详情页核价、保存截图。
7. 后端写入酒店结果、证据、可信度与状态事件。
8. 前端展示平台卡片进度与结果列表。
9. 所有平台完成或被跳过后，后端标记任务结束并计算最低价标签。

## 6. 模块边界

| 模块 | 职责 | 不负责 |
| --- | --- | --- |
| Frontend | 表单输入、任务进度展示、人工验证操作入口、结果展示 | 直接采集平台页面、持久化真实数据 |
| API Server | 请求校验、任务创建、状态查询、控制指令、事件推送 | 操作页面 DOM、保存登录凭据 |
| Task Module | 主任务与平台子任务状态流转、队列调度 | 平台选择器细节 |
| Browser Module | Playwright context 生命周期、截图、人工验证暂停点 | 平台业务规则 |
| Platform Adapters | 各平台搜索、列表解析、详情核价流程 | 统一任务状态机、跨平台排序 |
| Evidence Module | 证据文件命名、保存、元数据记录 | 判断酒店价格高低 |
| Trust Module | 可信度规则与最低价标签 | 页面采集实现 |
| Persistence | SQLite 表结构、读写仓储 | 业务流程编排 |

## 7. 核心数据对象草案

### SearchCriteria

```ts
type SearchCriteria = {
  destination: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  keywords?: string[];
  priceMin?: number;
  priceMax?: number;
  distanceFilter?: string;
  platforms: PlatformCode[];
  sortBy: 'price' | 'trust' | 'distance';
};
```

### Task

```ts
type Task = {
  id: string;
  name: string;
  criteria: SearchCriteria;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
```

### HotelResult

```ts
type HotelResult = {
  id: string;
  taskId: string;
  platform: PlatformCode;
  hotelName: string;
  locationText?: string;
  listPrice?: number;
  detailPrice?: number;
  currency: string;
  sourceUrl: string;
  evidenceId?: string;
  trustLevel: 'high' | 'medium' | 'low';
  isLowestDetailPrice: boolean;
  collectedAt: string;
};
```

## 8. 非功能性约束

- 合规：不破解验证码、不绕过滑块、不伪造登录态、不自动下单。
- 可观测：每个平台子任务都必须产生日志和状态事件。
- 可暂停：检测到人工验证时，浏览器保持打开并暂停自动操作。
- 可追溯：结果必须绑定 URL、截图、采集时间和查询条件。
- 可扩展：新增平台只新增 Adapter，不修改核心任务状态机。
