# 后端架构设计

## 1. 后端目标

后端负责接收查询条件、创建采集任务、调度平台 Adapter、管理浏览器 Agent、持久化结果与证据，并通过事件通道让前端实时观察进度。

## 2. 模块规划

```txt
backend/src/
├── app.ts
├── config/
├── modules/
│   ├── task/
│   │   ├── task.controller.ts
│   │   ├── task.service.ts
│   │   ├── task.repository.ts
│   │   └── task.types.ts
│   ├── browser/
│   │   ├── browser-manager.ts
│   │   ├── browser-session.ts
│   │   └── manual-verification.ts
│   ├── platforms/
│   │   ├── platform-adapter.ts
│   │   ├── ctrip.adapter.ts
│   │   ├── booking.adapter.ts
│   │   ├── fliggy.adapter.ts
│   │   └── meituan.adapter.ts
│   ├── extractor/
│   ├── evidence/
│   │   ├── evidence.service.ts
│   │   └── evidence.repository.ts
│   ├── trust/
│   │   └── trust.service.ts
│   └── events/
│       ├── event-bus.ts
│       └── sse.controller.ts
├── db/
│   ├── schema.sql
│   └── sqlite.ts
└── shared/
```

> 当前阶段仅设计模块，不创建 TypeScript 业务代码。

## 3. API 边界

### 任务 API

| 方法 | 路径 | 职责 |
| --- | --- | --- |
| `POST` | `/api/tasks` | 校验查询条件，创建主任务和平台子任务。 |
| `GET` | `/api/tasks/:taskId` | 返回任务详情、平台进度和聚合统计。 |
| `POST` | `/api/tasks/:taskId/pause` | 暂停任务或请求任务进入暂停中。 |
| `POST` | `/api/tasks/:taskId/resume` | 恢复等待人工验证或暂停的任务。 |
| `POST` | `/api/tasks/:taskId/platforms/:platform/skip` | 跳过单个平台任务。 |
| `GET` | `/api/tasks/:taskId/results` | 返回酒店结果与证据元数据。 |
| `GET` | `/api/tasks/:taskId/events` | 建立 SSE 事件流。 |

### 创建任务请求草案

```json
{
  "destination": "东京",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-02",
  "adults": 2,
  "keywords": ["新宿", "近地铁"],
  "priceMin": 0,
  "priceMax": 500,
  "platforms": ["ctrip", "booking"],
  "sortBy": "price"
}
```

## 4. 服务分层

| 层级 | 说明 |
| --- | --- |
| Controller | HTTP 参数解析、鉴权预留、响应格式，不写业务流程。 |
| Service | 编排任务创建、调度、继续、跳过、结果聚合。 |
| Repository | 封装 SQLite 读写，避免 SQL 散落。 |
| Adapter | 平台独立采集流程，实现统一接口。 |
| Event Bus | 内部事件广播，并桥接到 SSE。 |

## 5. 数据库表设计草案

### tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text primary key | 主任务 ID。 |
| name | text | 任务名称。 |
| status | text | 主任务状态。 |
| criteria_json | text | 查询条件快照。 |
| created_at | text | 创建时间。 |
| updated_at | text | 更新时间。 |
| completed_at | text nullable | 完成时间。 |

### platform_tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text primary key | 平台子任务 ID。 |
| task_id | text | 所属主任务。 |
| platform | text | 平台代码。 |
| status | text | 平台状态。 |
| current_step | text | 当前步骤。 |
| collected_count | integer | 已采集数量。 |
| issue | text nullable | 当前问题。 |
| updated_at | text | 更新时间。 |

### hotel_results

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text primary key | 结果 ID。 |
| task_id | text | 主任务 ID。 |
| platform | text | 平台代码。 |
| hotel_name | text | 酒店名。 |
| location_text | text nullable | 位置描述。 |
| list_price | integer nullable | 列表页价格，最小货币单位。 |
| detail_price | integer nullable | 详情页确认价格，最小货币单位。 |
| currency | text | 货币。 |
| source_url | text | 来源 URL。 |
| trust_level | text | 可信度。 |
| is_lowest_detail_price | integer | 是否当前最低详情价。 |
| collected_at | text | 采集时间。 |

### evidences

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text primary key | 证据 ID。 |
| task_id | text | 主任务 ID。 |
| result_id | text nullable | 对应酒店结果。 |
| platform | text | 平台代码。 |
| type | text | `list_page` 或 `detail_page`。 |
| file_path | text | 截图相对路径。 |
| page_url | text | 截图时 URL。 |
| captured_at | text | 截图时间。 |

### task_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer primary key autoincrement | 事件序号。 |
| task_id | text | 主任务 ID。 |
| type | text | 事件类型。 |
| payload_json | text | 事件内容。 |
| created_at | text | 创建时间。 |

## 6. 调度策略

MVP 建议按平台串行执行，原因：

- 降低浏览器资源占用。
- 降低多个平台同时触发验证的复杂度。
- 更容易保证状态机正确。

后续可扩展为有限并发：同一任务最多 1-2 个平台并发，全局浏览器 context 数量受配置限制。

## 7. 平台 Adapter 接口草案

```ts
interface PlatformAdapter {
  platform: PlatformCode;
  run(input: PlatformRunInput): Promise<PlatformRunResult>;
  resume(input: PlatformResumeInput): Promise<void>;
  stop(input: PlatformStopInput): Promise<void>;
}
```

Adapter 必须通过统一回调报告：

- 当前步骤。
- 已采集数量。
- 人工验证需求。
- 酒店结果。
- 截图证据。
- 可恢复错误或不可恢复错误。

## 8. 错误处理原则

- 单个平台失败不立即让主任务失败，除非所有平台都失败或任务级资源不可用。
- 登录、验证码、滑块不视为失败，进入 `waiting_manual_verification`。
- 超时、选择器失效、页面结构变化视为平台错误，并记录 `issue`。
- 写入数据库或证据文件失败视为任务级错误，需要停止当前任务并提示用户。

## 9. 后端阶段边界

当前阶段不实现：

- Fastify 应用代码。
- SQLite schema 文件。
- Playwright 调用。
- 平台 Adapter 选择器。
- SSE 运行代码。
