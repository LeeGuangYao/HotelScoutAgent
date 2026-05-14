# Hotel Scout Agent - AI 开发流程规范

# 一、文档定位

本文档不是产品需求文档。

本文档用于约束 AI（Codex / Claude / GPT）如何分阶段开发 Hotel Scout Agent 项目。

目标：

- 控制 AI 开发节奏
- 避免架构混乱
- 降低上下文漂移
- 提高代码稳定性
- 强制阶段化开发
- 强制自测
- 强制阶段总结

---

# 二、核心开发原则

## 1. 不允许一次性实现整个项目

禁止：

```txt
帮我实现整个 Hotel Scout Agent
```

原因：

- AI 会失控扩展
- 架构容易漂移
- 前后端强耦合
- Playwright 与 UI 混杂
- 状态机缺失
- 目录结构混乱

正确方式：

AI 必须严格分阶段开发。

---

## 2. 一次只允许做一个阶段

例如：

当前阶段是：

```txt
阶段 2：UI 设计
```

则 AI 不允许：

- 提前实现前端代码
- 提前实现后端
- 提前实现 Playwright
- 提前实现 WebSocket

必须只完成：

```txt
UI 结构设计
组件拆分
交互设计
视觉方案
```

---

## 3. 每个阶段结束后必须自测

AI 每完成一个阶段，必须：

1. 执行自测
2. 输出测试结果
3. 输出风险点
4. 输出修改文件
5. 更新当前阶段状态

未自测：

禁止进入下一阶段。

---

## 4. 当前阶段由 plans/current-stage.md 控制

AI 必须始终读取：

```txt
plans/current-stage.md
```

当前允许执行什么，以该文件为准。

AI 不允许自行跳过阶段。

---

# 三、推荐项目目录结构

```txt
hotel-scout-agent/

├── AGENTS.md
│
├── docs/
│   ├── product.md
│   ├── ai-dev-flow.md
│   └── ui-design.md
│
├── architecture/
│   ├── project.md
│   ├── frontend.md
│   ├── backend.md
│   ├── browser-agent.md
│   ├── task-state-machine.md
│   └── websocket.md
│
├── specs/
│   ├── 001-首页查询页.md
│   ├── 002-任务执行页.md
│   ├── 003-结果列表页.md
│   ├── 004-浏览器Agent.md
│   ├── 005-人工验证流程.md
│   └── 006-平台适配器.md
│
├── plans/
│   ├── current-stage.md
│   ├── stage-001.md
│   ├── stage-002.md
│   └── stage-003.md
│
├── frontend/
├── backend/
└── screenshots/
```

---

# 四、AGENTS.md 推荐规则

AGENTS.md 只放长期规则。

不要放：

```txt
当前任务
当前阶段
```

因为这些内容会频繁变化。

AGENTS.md 应该包含：

- AI 协作规则
- 开发约束
- 项目技术栈
- 阶段执行规范
- 自测规范
- 文档读取顺序

---

# 五、AI 启动时必须执行的流程

AI 每次开始工作前，必须按顺序读取：

```txt
1. AGENTS.md
2. docs/product.md
3. docs/ai-dev-flow.md
4. plans/current-stage.md
```

读取后：

- 输出当前阶段理解
- 输出当前阶段目标
- 输出当前阶段限制
- 输出阶段执行计划

然后才允许开始实现。

---

# 六、阶段执行标准流程

每个阶段必须遵循以下流程：

```txt
读取文档
    ↓
分析当前阶段
    ↓
输出阶段计划
    ↓
开始实现
    ↓
执行自测
    ↓
输出测试结果
    ↓
更新 current-stage.md
    ↓
停止执行
```

禁止：

```txt
连续自动实现多个阶段
```

---

# 七、推荐开发阶段

---

# 阶段 1：技术架构设计

目标：

建立稳定架构。

当前阶段禁止：

- 写业务代码
- 写 Vue 页面
- 写 Playwright
- 写 WebSocket

只允许：

- architecture 文档
- 目录结构
- 技术选型
- 状态机设计
- 数据结构设计

阶段产物：

```txt
architecture/*.md
```

完成标准：

- 架构文档完整
- 模块边界明确
- 状态机明确
- Adapter 结构明确

---

# 阶段 2：UI / 页面设计

目标：

完成产品 UI 设计。

禁止：

- 实现 Vue 页面
- 实现接口
- 实现 Playwright

只允许：

- 页面结构设计
- 组件拆分
- 交互流程
- 布局设计
- 暗黑主题设计

阶段产物：

```txt
docs/ui-design.md
```

完成标准：

- 首页结构完成
- 任务页结构完成
- 结果页结构完成
- 弹窗流程明确

---

# 阶段 3：前端静态页面

目标：

完成静态前端 UI。

禁止：

- 接真实接口
- 接 WebSocket
- 接 Playwright
- 写真实业务逻辑

允许：

- mock 数据
- 页面组件
- 响应式布局
- 深色主题

技术要求：

```txt
Vue3
Vite
TypeScript
Pinia
Tailwind / UnoCSS
```

完成标准：

- 页面可运行
- mock 数据完整
- UI 可交互

---

# 阶段 4：后端任务系统

目标：

实现任务系统基础能力。

禁止：

- 真实平台采集
- Playwright

允许：

- SQLite
- WebSocket
- 任务状态机
- 日志系统
- 调度器

完成标准：

- 任务创建成功
- 状态流转正常
- WebSocket 可推送

---

# 阶段 5：Browser Agent MVP

目标：

实现携程 Browser Agent。

只允许：

- 携程平台
- 本地浏览器
- 单用户
- 人工登录

禁止：

- 多平台
- Docker
- 云端浏览器
- 自动验证码破解

技术要求：

```txt
Playwright
Persistent Context
headless=false
```

完成标准：

- 能打开携程
- 能输入搜索条件
- 能读取酒店列表
- 能保存截图
- 能进入详情页
- 能提取价格

---

# 阶段 6：人工验证流程

目标：

实现登录 / 验证暂停恢复机制。

实现：

- 页面状态识别
- NEED_LOGIN
- NEED_CAPTCHA
- WAITING_HUMAN
- resume 机制

完成标准：

- 验证时能暂停
- 用户处理后能恢复

---

# 阶段 7：前后端联调

目标：

打通完整链路。

实现：

- 前端任务页
- 后端任务系统
- Browser Agent
- WebSocket 推送

完成标准：

- 能完整执行一次酒店搜索
- 能展示结果
- 能展示截图
- 能展示可信度

---

# 阶段 8：多平台扩展

目标：

扩展更多平台。

建议顺序：

```txt
1. 携程
2. Booking
3. 飞猪
4. 美团
```

禁止：

- 一开始同时做四个平台

原因：

每个平台：

- DOM 不同
- URL 不同
- 登录逻辑不同
- 反爬不同

---

# 八、自测规范

每个阶段完成后必须输出：

```md
## 本阶段完成内容

## 修改文件列表

## 自测步骤

## 自测结果

## 已知问题

## 风险点

## 下一阶段建议
```

---

# 九、MVP 约束

第一版严格限制：

```txt
本地运行
单用户
单平台（携程）
可见浏览器
人工登录
截图保存
结果展示
```

禁止提前实现：

- Docker
- 云端执行
- Remote Browser
- 多用户
- 自动验证码
- 浏览器直播
- 自动下单

---

# 十、最终目标

最终项目形态：

带人工介入的酒店价格采集 Agent。

核心能力：

- 浏览器自动操作
- 页面状态识别
- 人工验证暂停 / 恢复
- 截图证据保存
- 可信度评分
- 多平台 Adapter
- Agent 化任务编排

后续可扩展：

- MCP
- 多 Agent
- Browser Use
- 自动测试
- 云端任务
- AI 工作流
