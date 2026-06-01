# 五、调度器（Scheduler）

React 调度器最容易让人误解的地方，不是优先级名字，而是这几个问题：

- render 是不是在 JS 空闲时才执行？
- 时间切片是不是等于“页面就不会卡”？
- 为什么有时输入很顺，但列表结果会慢半拍？
- 为什么有时 React 明明用了并发，页面还是会掉帧？

这一章只做一件事：把 **任务优先级、时间切片、MessageChannel、React 与 Scheduler 的分工** 一次讲透。

---

## 1. 先给结论

### 1.1 调度器解决的是“怎么安排工作”，不是“怎么修改 DOM”

调度器主要负责：

- 给任务分优先级
- 决定先做谁后做谁
- 决定当前这段 render 要不要先暂停
- 决定什么时候恢复

它不直接负责：

- diff 细节
- DOM 插入 / 删除 / 更新
- 浏览器 layout / paint

### 1.2 可中断的是 render 工作，不是所有 React 代码

最重要的一句是：

> **Scheduler 主要让 render 阶段更容易被拆开，不代表 commit、长任务 JS、浏览器布局绘制都能随时暂停。**

所以：

- render 可能暂停
- commit 不能暂停
- 你自己的重循环 / 大排序 / JSON 解析也不会被 React 神奇切开

### 1.3 “时间切片”优化的是响应性，不是把工作量消灭

页面体感变好，通常不是因为 React 少做了工作，而是因为：

- 先处理更紧急的输入 / 点击
- 稍后再做不那么急的那部分 render

也就是说：

> **顺序变好了，不代表成本没了。**

---

## 2. 为什么 React 需要调度器

浏览器主线程要同时负责：

- 执行 JS
- 处理输入事件
- 样式计算
- 布局
- 绘制

如果 React 每次更新都长时间独占线程，用户就会看到：

- 输入不跟手
- 滚动掉帧
- 点击后界面长时间无响应

所以调度器的目标不是“让 React 更会算”，而是：

> **在主线程有限的前提下，让重要工作优先发生。**

---

## 3. 时间切片（Time Slicing）到底是什么

时间切片可以粗略理解成：

```text
开始一段 render 工作
  ↓
先做一小段
  ↓
看看要不要先让出线程
  ↓
如果该让
  ↓
暂停，稍后继续
```

常见的简化理解是“一次先做大约 5ms 左右的工作，再判断要不要让出”。

关键判断函数可以近似看成：

```js
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime
  return timeElapsed >= frameInterval
}
```

### 一个页面现象：为什么搜索结果慢一点，但输入框还是顺的

这通常就是时间切片最直观的体感：

- 输入框更新优先级更高
- 列表 render 成本更高、优先级更低
- 低优先级那部分 render 可以先暂停
- React 先把线程机会让给更紧急的交互

所以用户看到的是：

1. 先能继续输入
2. 列表晚一点出来

### 一个常见误区

“时间切片 = React 每 5ms 一定停一次” 这个理解并不准确。

更准确的说法是：

- React 会合作式地检查自己是不是该让出线程
- `5ms` 更像预算，不是硬件中断
- 如果你自己写了一大段同步长任务，中间没有机会回到 React 的调度点，React 也抢不回来

---

## 4. 任务优先级：为什么点击更像同步，滚动更像可让路

Scheduler 会给任务分优先级。常见心智模型可以先记成下面这张表：

| 优先级 | 常见场景 |
|--------|---------|
| ImmediatePriority | 立刻执行的同步任务 |
| UserBlockingPriority | 用户交互，如点击、键盘输入 |
| NormalPriority | 普通更新 |
| LowPriority | 可以晚点做的工作 |
| IdlePriority | 真正不着急的空闲工作 |

### 一个页面现象：为什么点击按钮后的更新常常更快

因为用户点击这类交互，React 会更倾向于优先处理，避免让用户觉得“我点了没反应”。

### 一个页面现象：为什么滚动里做复杂更新更容易卡或被打断

因为滚动、拖拽、mousemove 这类事件：

- 发生频率高
- 很容易持续不断地产生新任务
- React 更倾向于让浏览器和更高优先级工作先走

所以这类场景下，如果你还在回调里塞很重的同步 JS，页面就很容易卡。

---

## 5. Scheduler 内部怎么排队任务

Scheduler 内部可以粗略理解成维护两类队列：

- **taskQueue**：已经可以执行的任务
- **timerQueue**：还没到开始时间的延迟任务

当延迟任务到时间后，会从 timerQueue 转移到 taskQueue，再按优先级 / 到期时间被执行。

### 为什么要这样分

因为有些任务是：

- 现在就能做
- 过一会儿再做更合适

比如通过 `scheduleCallback(..., { delay })` 这种形式安排的工作，就更适合先放在等待队列里。

---

## 6. 为什么 Scheduler 用 MessageChannel，而不是 setTimeout

Scheduler 常用 **MessageChannel** 来安排下一段宏任务：

```js
const channel = new MessageChannel()
const port = channel.port2
channel.port1.onmessage = performWorkUntilDeadline

function schedulePerformWorkUntilDeadline() {
  port.postMessage(null)
}
```

### 为什么不用 `setTimeout`

因为 `setTimeout`：

- 调度精度更差
- 受最小延迟影响更大
- 在高频切换里不够灵活

而 `MessageChannel` 更适合做这种“我这一小段做完了，尽快给我下一次继续执行机会”的场景。

### 一个页面现象：为什么 render 看起来像“分批继续算”

因为一次长 render 工作，不一定会在同一个长同步调用栈里做完。

更接近的节奏是：

```text
这一段先算一点
  ↓
时间片快到了
  ↓
postMessage 安排下一轮
  ↓
下一轮宏任务继续
```

---

## 7. React 和 Scheduler 是怎么配合的

这两个角色不要混：

- **Scheduler**：安排“现在做不做 / 先做谁 / 要不要先停”
- **React Reconciler**：真正执行 Fiber render 工作

主链路可以近似理解成：

```text
React 发起更新
  ↓
给更新分配优先级
  ↓
Scheduler 安排任务
  ↓
开始一段 render work
  ↓
如果该让出，先暂停
  ↓
后续继续 render
  ↓
render 全部完成
  ↓
进入 commit（同步）
```

也就是说：

> **Scheduler 决定工作怎么被安排，Reconciler 决定 Fiber 怎么被真正处理。**

---

## 8. 为什么有了并发和调度，页面还是可能卡

这是最值得提前建立正确预期的一点。

### 8.1 commit 很重

即使 render 能被切开，commit 仍然必须同步完成。

如果一次 commit 要做：

- 大量 DOM 插入
- 大量节点删除
- 大量属性 / 样式更新

那用户仍然会感觉“顿一下”。

### 8.2 你自己的 JS 是长任务

比如你在事件回调、render、memo 计算里做了：

- 大循环
- 大排序
- 深拷贝
- 大 JSON 解析

React 并不能把你这段普通同步函数从中间切开。

### 8.3 浏览器后处理很重

就算 React 已经顺利 commit，浏览器后面还要做：

- style calculation
- layout
- paint

这部分重的话，页面同样会掉帧。

### 一个常见误区

“React 用了并发 / Scheduler，所以页面不会卡。”

这句话不准确。更准确的说法是：

> **React 更有机会把 render 安排得更友好，但无法消除所有卡顿来源。**

---

## 9. 从页面现象判断是不是调度问题

以后遇到“为什么这次更新体感怪怪的”，可以先这样分：

### 9.1 输入顺，结果慢一点

优先怀疑：

- 低优先级 render 被让路了
- transition / deferred value 生效了
- Scheduler 正在先保交互，再补结果

### 9.2 页面整块顿一下

优先怀疑：

- commit 太重
- DOM 改太多
- layout / paint 太重
- 业务长任务堵住主线程

### 9.3 日志很多，但页面变化不多

优先想到：

- render 可以被重试、打断、覆盖
- 最终真正落地的 commit 次数可能更少

### 9.4 React 明明“并发”了，还是不顺

优先排查：

- 是不是你的同步代码太重
- 是不是一次 commit / layout 太重
- 是不是根本不是 Scheduler 问题，而是浏览器层问题

---

## 10. 最后压缩成 8 句

1. **Scheduler 解决的是工作安排顺序，不是 DOM 操作细节。**
2. **可中断的主要是 render 工作，不是 commit，也不是你自己的任意同步 JS。**
3. **时间切片优化的是响应性，不是把工作量凭空消灭。**
4. **点击、输入这类更紧急的交互，通常会得到更高优先级。**
5. **Scheduler 常用 MessageChannel 来安排下一段宏任务，而不是依赖 setTimeout。**
6. **React 和 Scheduler 的关系是：前者做 Fiber 工作，后者安排何时做、先做谁。**
7. **即使 render 能切片，重 commit、重布局、重绘、长任务 JS 仍然会让页面卡。**
8. **看到“输入先跟手、结果后刷新”，通常说明调度正在优先保证交互体感。**
