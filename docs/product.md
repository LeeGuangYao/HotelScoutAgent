# Hotel Scout Agent 酒店比价采集助手

## 一句话定位

输入城市、日期、人数和筛选条件，系统自动打开携程 / Booking / 飞猪 / 美团等平台，模拟人工搜索酒店，采集列表价和详情页确认价，保存截图证据，最后生成比价结果。

---

# 一、产品边界

## 做什么

1. 用户在前端输入查询条件。
2. 后端创建采集任务。
3. 后端启动 Playwright 浏览器。
4. Agent 打开各个平台网站。
5. 自动搜索城市、日期、人数。
6. 读取酒店列表。
7. 进入详情页确认价格。
8. 截图保存。
9. 汇总成表格。
10. 标记最低价。
11. 标记可信度。
12. 遇到登录 / 验证码 / 滑块时暂停，等待用户手动处理。

## 不做什么

1. 不破解验证码。
2. 不绕过滑块验证。
3. 不伪造登录态。
4. 不保证“全网最低”。
5. 不承诺价格实时有效。
6. 不直接自动下单。
7. 不采集用户隐私数据。

---

# 二、核心流程

```txt
用户填写查询条件
        ↓
点击查询
        ↓
创建任务
        ↓
后端启动浏览器
        ↓
依次打开携程 / Booking / 飞猪 / 美团
        ↓
判断是否需要登录 / 验证
        ↓
需要人工处理 → 前端显示“等待人工验证”
        ↓
用户手动登录 / 验证
        ↓
点击继续
        ↓
Agent 执行搜索
        ↓
采集列表页价格
        ↓
进入详情页确认价格
        ↓
保存截图 / URL / 时间 / 条件
        ↓
生成结果列表
        ↓
标记最低价和可信度
```

---

# 三、前端产品设计

## 1. 首页：酒店查询页

### 查询区域

字段：

- 目的地：东京
- 入住日期：2026-06-01
- 离店日期：2026-06-02
- 人数：2人
- 关键词：新宿 / 银座 / 近地铁
- 价格范围：0 - 500 元
- 距离筛选：距离市中心 / 地铁站 / 指定地点
- 平台选择：携程 / Booking / 飞猪 / 美团
- 排序方式：价格优先 / 可信度优先 / 距离优先

### 目的地选择器

第一版不要自己维护全量城市库。

建议做成：

```txt
城市名称输入框 + 本地热门城市 + 后端城市映射
```

示例：

```json
{
  "cityName": "东京",
  "country": "日本",
  "platformMapping": {
    "ctrip": {
      "keyword": "东京",
      "cityId": "228"
    },
    "booking": {
      "keyword": "Tokyo"
    },
    "fliggy": {
      "keyword": "东京"
    },
    "meituan": {
      "keyword": "东京"
    }
  }
}
```

MVP 阶段可以先不做复杂城市 ID，只输入关键词，让网站自己联想，再由 Agent 点击第一个匹配项。

---

## 2. 任务执行页

点击查询后进入任务页。

### 顶部状态

```txt
任务名称：东京酒店比价
状态：运行中 / 等待人工验证 / 已完成 / 失败
查询条件：东京，2026-06-01 至 2026-06-02，2人，500元以内
```

### 平台任务卡片

```txt
携程
状态：正在打开页面
当前步骤：搜索酒店列表
已采集：12 家酒店
问题：无
按钮：查看浏览器 / 暂停 / 跳过
```

```txt
Booking
状态：等待人工验证
当前步骤：检测到登录或验证页面
按钮：打开浏览器处理 / 我已完成，继续
```

---

## 3. 结果列表页

每个酒店展示：

- 酒店图片
- 酒店名称
- 位置
- 平台来源
- 列表页价格
- 详情页确认价格
- 是否最低价
- 可信度
- 截图证据
- 采集时间

示例：

```txt
三井花园酒店东京银座
位置：东京 · 银座
来源：携程
列表价：¥486
详情确认价：¥502
可信度：高
证据：查看截图
标签：当前最低详情价
```

---

# 四、后端模块设计

推荐技术：

- Node.js + Express / Fastify
- Playwright
- SQLite
- WebSocket / SSE
- 本地文件存储 screenshots/

后端目录结构：

```txt
server/
├── modules/
│   ├── task/
│   ├── browser/
│   ├── platforms/
│   │   ├── ctrip.js
│   │   ├── booking.js
│   │   ├── fliggy.js
│   │   └── meituan.js
│   ├── extractor/
│   ├── evidence/
│   └── trust/
├── data/
│   └── app.sqlite
├── screenshots/
└── browser-profiles/
```

---

# 五、如何打开携程 / Booking / 飞猪 / 美团

方案：后端启动真实浏览器。

不是直接调用隐藏接口，而是通过 Playwright 启动真实 Chromium 浏览器，模拟人工操作。

示例：

```js
const context = await chromium.launchPersistentContext(
  './browser-profiles/ctrip',
  {
    headless: false,
    viewport: { width: 1440, height: 900 }
  }
);

const page = await context.newPage();
await page.goto('https://www.ctrip.com/');
```

使用持久化 Context 可以保存 Cookie、localStorage 和登录状态。

---

# 六、如何查询酒店

统一 Adapter 接口：

```js
class PlatformAdapter {
  async openHome(page) {}
  async detectAuthState(page) {}
  async searchHotels(page, query) {}
  async extractList(page) {}
  async openDetail(page, hotel) {}
  async extractDetailPrice(page) {}
  async saveEvidence(page, hotel) {}
}
```

携程搜索流程：

1. 打开网站
2. 判断页面状态
3. 输入城市
4. 选择日期
5. 点击搜索
6. 读取列表
7. 进入详情页
8. 提取最终价格
9. 保存截图

---

# 七、如何判断是否登录 / 是否需要人工验证

页面状态：

- READY
- NEED_LOGIN
- NEED_CAPTCHA
- NEED_SMS
- ACCESS_BLOCKED
- SEARCH_NO_RESULT
- UNKNOWN

判断方式：

1. URL 判断
2. 页面文案判断
3. 页面元素判断
4. 主功能元素判断

示例：

- URL 包含 login / verify / captcha
- 页面包含“请完成验证”
- 页面出现密码输入框
- 页面不存在酒店列表

则进入人工处理流程。

---

# 八、遇到登录 / 验证怎么办

流程：

1. Agent 检测 NEED_LOGIN / NEED_CAPTCHA
2. 暂停任务
3. WebSocket 通知前端
4. 前端提示用户处理
5. 用户手动登录 / 验证
6. 用户点击“继续”
7. Agent 重新检测状态
8. READY 后继续采集

MVP 建议：

```js
headless: false
```

直接弹出真实浏览器，由用户处理登录和验证。

---

# 九、数据可信度设计

## 高可信

- 进入详情页
- 提取最终价格
- 保存详情页截图
- 保存 URL
- 保存时间和条件

## 中可信

- 只读取列表页价格
- 保存列表页截图

## 低可信

- 只有文本价格
- 没有截图
- 条件不完整

最低价只在同条件下比较。

---

# 十、数据库设计

## task 表

```sql
CREATE TABLE task (
  id TEXT PRIMARY KEY,
  city_name TEXT,
  checkin_date TEXT,
  checkout_date TEXT,
  adults INTEGER,
  min_price INTEGER,
  max_price INTEGER,
  keyword TEXT,
  platforms TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

## hotel_result 表

```sql
CREATE TABLE hotel_result (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  platform TEXT,
  hotel_name TEXT,
  image_url TEXT,
  location TEXT,
  list_price REAL,
  detail_price REAL,
  currency TEXT,
  detail_url TEXT,
  trust_level TEXT,
  is_lowest INTEGER,
  screenshot_path TEXT,
  collected_at TEXT
);
```

## task_event 表

```sql
CREATE TABLE task_event (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  platform TEXT,
  event_type TEXT,
  message TEXT,
  created_at TEXT
);
```

---

# 十一、接口设计

## 创建任务

```http
POST /api/tasks
```

## 查询任务状态

```http
GET /api/tasks/:id
```

## 查询结果

```http
GET /api/tasks/:id/results
```

## 继续任务

```http
POST /api/tasks/:id/resume
```

## 跳过平台

```http
POST /api/tasks/:id/platforms/:platform/skip
```

---

# 十二、任务状态机

```txt
CREATED
  ↓
RUNNING
  ↓
WAITING_HUMAN
  ↓
RUNNING
  ↓
COMPLETED
```

也可能：

- RUNNING → FAILED
- WAITING_HUMAN → SKIPPED
- RUNNING → PARTIAL_COMPLETED

---

# 十三、MVP 版本建议

## V0.1：只做携程

目标：

- 输入城市、日期、人数
- 打开携程
- 搜索酒店
- 采集列表页前 10 个酒店
- 进入详情页确认价格
- 保存截图
- 展示结果

## V0.2：加人工验证

- 检测登录 / 验证
- 暂停任务
- 前端提示
- 用户手动处理
- 继续任务

## V0.3：加 Booking

独立实现 Booking Adapter。

## V0.4：多平台汇总

- 携程
- Booking
- 飞猪
- 美团

统一可信度和最低价。

---

# 十四、最终推荐项目形态

带人工介入的酒店价格采集 Agent。

核心价值：

- 浏览器自动操作
- 页面状态识别
- 人工验证暂停 / 恢复
- 价格证据保存
- 可信度评分
- 多平台 Adapter

这是一个有实用性、技术深度和 Agent 特性的项目。
