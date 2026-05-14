# 浏览器 Agent 架构设计

## 1. 设计目标

浏览器 Agent 负责以真实浏览器模拟人工搜索流程，并为平台 Adapter 提供统一的浏览器会话、截图、暂停与恢复能力。它不是独立决策系统，而是后端任务调度器控制下的执行组件。

## 2. 核心原则

- 使用真实 Chromium 浏览器，MVP 默认 `headless: false`。
- 每个平台使用独立持久化 profile，避免跨平台状态污染。
- 不破解验证码、不绕过滑块、不伪造登录态。
- 遇到人工验证页面时只暂停并通知前端。
- 每个关键采集动作都可产生日志和证据。

## 3. 运行结构

```txt
Task Service
    |
    v
BrowserManager
    |
    +-- BrowserSession(ctrip, profile: browser-profiles/ctrip)
    +-- BrowserSession(booking, profile: browser-profiles/booking)
    +-- BrowserSession(fliggy, profile: browser-profiles/fliggy)
    +-- BrowserSession(meituan, profile: browser-profiles/meituan)
```

## 4. BrowserManager 职责

- 根据平台创建或复用浏览器会话。
- 限制全局浏览器会话数量。
- 管理 context、page 生命周期。
- 在任务结束后按策略关闭或保留浏览器。
- 提供截图和基础导航能力。
- 在人工验证时保持浏览器窗口打开。

## 5. BrowserSession 职责

每个 `BrowserSession` 绑定一个平台和一个持久化 profile：

```txt
backend/browser-profiles/{platform}/
```

会话内保存：

- platform code。
- Playwright context。
- 当前 page。
- 当前任务 ID。
- 是否处于人工验证等待。
- 最近一次活动时间。

## 6. 人工验证检测

平台 Adapter 负责提供平台相关检测条件，Browser Agent 只提供通用暂停能力。

常见检测信号：

- 页面出现验证码、滑块、登录二维码、短信验证等关键词。
- URL 跳转到登录或安全验证路径。
- 关键搜索结果容器长期不可见，但验证容器可见。
- 平台 Adapter 主动判断当前流程不能继续。

检测到后：

1. Adapter 调用 `requestManualVerification`。
2. 平台子任务状态变为 `waiting_manual_verification`。
3. 任务事件推送 `manual_verification.required`。
4. 浏览器窗口保持打开。
5. Adapter 挂起等待后端 resume 信号。

## 7. 截图策略

截图类型：

| 类型 | 触发点 | 用途 |
| --- | --- | --- |
| list_page | 列表页结果解析后 | 证明列表价来源。 |
| detail_page | 详情页确认价格后 | 证明详情确认价。 |
| manual_verification | 检测到验证时 | 帮助用户判断需要处理什么。 |
| error | 平台流程失败时 | 诊断选择器或页面变化。 |

建议文件命名：

```txt
screenshots/{taskId}/{platform}/{yyyyMMdd-HHmmss}-{type}-{safeHotelName}.png
```

## 8. 与平台 Adapter 的关系

Browser Agent 提供通用能力：

- `openPage(url)`
- `waitForStablePage()`
- `takeEvidenceScreenshot(metadata)`
- `pauseForManualVerification(reason)`
- `resumeAfterManualVerification()`
- `closeSession()`

平台 Adapter 负责：

- 打开什么 URL。
- 输入哪些搜索条件。
- 点击哪些页面元素。
- 解析哪些 DOM 字段。
- 判断哪些页面属于平台验证。

## 9. 超时与恢复

建议分层超时：

- 页面导航超时：30 秒。
- 关键元素等待：15 秒。
- 人工验证等待：不自动超时，由用户跳过或继续。
- 平台整体执行：可配置，MVP 建议 10-20 分钟。

恢复策略：

- 普通选择器超时：截图并标记平台失败。
- 人工验证：等待用户点击继续。
- 浏览器崩溃：尝试重建一次 session；仍失败则平台失败。

## 10. 当前阶段边界

当前阶段不实现：

- Playwright 依赖安装。
- 浏览器启动代码。
- 平台选择器。
- 真实截图保存代码。
