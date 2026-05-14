# 任务状态机设计

## 1. 状态机目标

任务状态机用于确保主任务、平台子任务、人工验证、失败与完成之间的流转清晰可控，避免前端显示、后端调度和浏览器 Agent 运行状态不一致。

## 2. 主任务状态

| 状态 | 含义 | 终态 |
| --- | --- | --- |
| `created` | 任务已创建，尚未开始调度。 | 否 |
| `running` | 至少一个平台正在执行或排队执行。 | 否 |
| `waiting_manual_verification` | 当前有平台需要用户处理登录、验证码或滑块。 | 否 |
| `paused` | 用户主动暂停任务。 | 否 |
| `completed` | 所有平台已完成、跳过或失败，并完成结果汇总。 | 是 |
| `failed` | 任务级错误导致无法继续。 | 是 |
| `cancelled` | 用户取消任务。 | 是 |

## 3. 平台子任务状态

| 状态 | 含义 | 终态 |
| --- | --- | --- |
| `pending` | 已创建，等待调度。 | 否 |
| `opening` | 正在打开平台页面。 | 否 |
| `searching` | 正在输入条件并搜索。 | 否 |
| `collecting_list` | 正在采集列表页酒店与列表价。 | 否 |
| `confirming_detail` | 正在进入详情页确认价格。 | 否 |
| `saving_evidence` | 正在保存截图和证据元数据。 | 否 |
| `waiting_manual_verification` | 等待用户手动处理验证。 | 否 |
| `skipped` | 用户跳过该平台。 | 是 |
| `completed` | 平台采集完成。 | 是 |
| `failed` | 平台采集失败。 | 是 |

## 4. 主任务状态流转

```txt
created
  -> running
  -> waiting_manual_verification
  -> running
  -> paused
  -> running
  -> completed

created -> cancelled
running -> cancelled
waiting_manual_verification -> cancelled
paused -> cancelled

created -> failed
running -> failed
waiting_manual_verification -> failed
paused -> failed
```

## 5. 平台子任务状态流转

```txt
pending
  -> opening
  -> searching
  -> collecting_list
  -> confirming_detail
  -> saving_evidence
  -> completed
```

任意非终态平台状态可进入：

```txt
waiting_manual_verification -> 原恢复点状态
```

任意非终态平台状态可进入：

```txt
skipped
failed
```

## 6. 主任务与平台状态聚合规则

主任务状态由平台状态聚合，但任务级错误优先级最高：

1. 如果任务被用户取消：`cancelled`。
2. 如果发生数据库、证据文件、调度器崩溃等任务级错误：`failed`。
3. 如果任一平台处于 `waiting_manual_verification`：`waiting_manual_verification`。
4. 如果用户主动暂停：`paused`。
5. 如果任一平台处于非终态运行状态：`running`。
6. 如果所有平台均为 `completed`、`skipped` 或 `failed`：`completed`。

> 注意：单个平台 `failed` 不等于主任务 `failed`。

## 7. 事件设计

状态机每次关键转换都写入 `task_events`，并推送给 SSE 订阅者。

事件字段草案：

```ts
type TaskEvent = {
  id: number;
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
```

常见事件：

| 事件 | 触发场景 |
| --- | --- |
| `task.created` | 创建主任务。 |
| `task.status_changed` | 主任务状态变化。 |
| `platform.status_changed` | 平台子任务状态变化。 |
| `platform.progress` | 已采集数量、当前步骤变化。 |
| `manual_verification.required` | 平台需要人工验证。 |
| `manual_verification.resumed` | 用户点击继续。 |
| `hotel_result.created` | 新增酒店结果。 |
| `evidence.created` | 新增截图证据。 |
| `platform.completed` | 单个平台完成。 |
| `platform.failed` | 单个平台失败。 |
| `task.completed` | 主任务完成。 |
| `task.failed` | 主任务失败。 |

## 8. 人工验证恢复点

平台进入 `waiting_manual_verification` 前必须记录恢复点：

- 当前平台。
- 当前步骤。
- 当前 URL。
- 当前酒店或列表分页上下文。
- 暂停原因。

用户点击继续后，平台 Adapter 不假设验证必然成功，而是重新检测当前页面：

- 如果验证已解除：恢复到原步骤或最近可安全重试步骤。
- 如果仍在验证：继续保持 `waiting_manual_verification`。
- 如果页面丢失或状态不可恢复：平台 `failed`，保存错误截图。

## 9. 结果汇总规则

当主任务进入 `completed` 前：

1. 汇总所有有效 `hotel_results`。
2. 仅比较存在 `detail_price` 的结果。
3. 标记最低详情价 `is_lowest_detail_price`。
4. 对缺少详情页确认价、缺少截图、页面疑似变化的结果降低可信度。
5. 生成最终 `task.completed` 事件。

## 10. 当前阶段边界

当前阶段不实现：

- 运行时状态机代码。
- 数据库迁移脚本。
- 事件推送代码。
- 前端状态消费代码。
