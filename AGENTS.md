# AGENTS.md

## 协作规则

1. 每次开始任务前，必须先阅读：
   - docs/product.md
   - docs/ai-dev-flow.md
   - plans/current-stage.md

2. 当前执行阶段以 `plans/current-stage.md` 为准。

3. 每次只允许执行一个阶段。

4. 阶段完成后，必须：
   - 自测
   - 写明修改了哪些文件
   - 写明自测结果
   - 更新 `plans/current-stage.md`

5. 如果当前阶段自测通过，可以把 `plans/current-stage.md` 自动推进到下一阶段。

6. 如果当前阶段自测失败，不允许推进阶段。

7. 不允许跳过阶段。

8. 不允许跨阶段实现功能。