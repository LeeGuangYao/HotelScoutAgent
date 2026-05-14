# 前端架构设计

## 1. 前端目标

前端负责让用户提交酒店比价条件、观察采集任务进度、处理人工验证暂停点，并查看带截图证据的比价结果。MVP 先按单页应用规划，后续根据阶段再实现具体页面。

## 2. 页面规划

| 页面 | 路由建议 | 核心职责 |
| --- | --- | --- |
| 首页查询页 | `/` | 输入目的地、日期、人数、筛选条件和平台，创建任务。 |
| 任务执行页 | `/tasks/:taskId` | 展示总任务状态、平台任务卡片、人工验证操作入口。 |
| 结果列表页 | `/tasks/:taskId/results` | 展示酒店结果、最低价标签、可信度和截图证据。 |

## 3. 组件拆分

```txt
frontend/src/
├── pages/
│   ├── SearchPage.vue
│   ├── TaskPage.vue
│   └── ResultsPage.vue
├── components/
│   ├── search/
│   │   ├── DestinationInput.vue
│   │   ├── DateRangeInput.vue
│   │   ├── GuestInput.vue
│   │   ├── PlatformSelector.vue
│   │   └── SearchFilters.vue
│   ├── task/
│   │   ├── TaskHeader.vue
│   │   ├── PlatformTaskCard.vue
│   │   ├── TaskEventTimeline.vue
│   │   └── ManualVerificationPanel.vue
│   └── results/
│       ├── HotelResultCard.vue
│       ├── PriceComparisonTable.vue
│       ├── TrustBadge.vue
│       └── EvidencePreview.vue
├── stores/
│   ├── searchStore.ts
│   ├── taskStore.ts
│   └── resultStore.ts
└── api/
    ├── client.ts
    ├── tasks.ts
    └── events.ts
```

> 第 1 阶段只设计结构，不创建 Vue 组件代码。

## 4. 前端状态模型

### Search Store

- 保存当前表单输入。
- 负责平台默认值和热门城市建议。
- 调用创建任务 API。

### Task Store

- 保存任务详情和平台子任务状态。
- 连接任务 SSE 事件流。
- 处理暂停、继续、跳过平台等控制动作。

### Result Store

- 保存酒店结果列表。
- 提供按平台、价格、可信度、最低价标签筛选排序。
- 管理截图预览弹窗状态。

## 5. API 交互设计

| 场景 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 创建任务 | `POST` | `/api/tasks` | 提交查询条件并返回 `taskId`。 |
| 查询任务 | `GET` | `/api/tasks/:taskId` | 获取主任务和平台任务状态。 |
| 订阅事件 | `GET` | `/api/tasks/:taskId/events` | SSE 事件流。 |
| 继续任务 | `POST` | `/api/tasks/:taskId/resume` | 用户完成验证后继续。 |
| 跳过平台 | `POST` | `/api/tasks/:taskId/platforms/:platform/skip` | 跳过异常平台。 |
| 查询结果 | `GET` | `/api/tasks/:taskId/results` | 获取酒店结果列表。 |

## 6. SSE 事件消费

前端只把 SSE 视为“服务端状态变化通知”，最终状态仍以查询接口为准。

建议事件类型：

- `task.created`
- `task.status_changed`
- `platform.status_changed`
- `platform.progress`
- `manual_verification.required`
- `hotel_result.created`
- `evidence.created`
- `task.completed`
- `task.failed`

## 7. 人工验证交互

当后端推送 `manual_verification.required`：

1. 平台卡片切换为“等待人工验证”。
2. 显示平台、原因、当前步骤和处理说明。
3. 用户点击“打开浏览器处理”后，真实浏览器窗口应已在后端保持打开。
4. 用户手动完成登录或验证。
5. 用户点击“我已完成，继续”，前端调用继续任务 API。
6. 后端恢复该平台 Adapter 的执行。

## 8. 错误与空状态

- 表单错误：在本地提示日期、人数、平台数量等基础校验。
- 平台失败：只影响对应平台卡片，主任务可继续执行其他平台。
- 无结果：明确说明平台未返回可确认价格，不显示“最低价”。
- 证据缺失：结果可信度降级，并展示“缺少截图证据”。

## 9. 前端阶段边界

当前阶段不实现：

- Vue 项目初始化。
- 页面样式与组件代码。
- API client 代码。
- SSE 连接代码。
- 截图预览实现。
