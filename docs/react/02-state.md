# 二、状态管理

React 状态管理最容易让人误解的，不是 `useState` / `useReducer` 会不会用，而是：

- 为什么 `setState` 调完立刻打印，还是旧值？
- 为什么连续三次 `setCount(count + 1)` 只加了 1？
- 状态到底存在哪里，为什么不是普通变量？
- render 到底是在什么时候真正执行的？
- 为什么输入框能先跟手，搜索结果却晚一点刷新？

这一章只做一件事：把 **状态快照、更新队列、Hook 存储、`setState` 源码主链路、Lane 优先级** 一次讲透。

---

## 1. 先给结论

### 1.1 `setState` 不是“立刻改变量”，而是“发起一次更新请求”

`setState` / `dispatch` 做的第一件事不是直接把当前变量改掉，而是：

1. 创建一个 update
2. 把它放进更新队列
3. 通知 React：这棵树有新工作要处理

真正的新状态，要等 React 进入下一轮 render 时才会算出来。

### 1.2 函数组件里的 state 是“快照”，不是“活变量”

看这段：

```js
setCount(count + 1)
console.log(count)
```

这里的 `count` 是 **当前这轮 render 的快照值**。`setCount` 不会回头改掉这次函数调用里已经拿到的 `count`。

所以：

> **本轮函数里拿到的 state，不会因为你调了 `setState` 就原地变化。**

### 1.3 同一轮里多次更新，不等于多次 DOM commit

React 可能会：

- 顺序处理多个 update
- 最后合并成一次 render / 一次 commit

所以常见现象是：

- 你写了多个 `setState`
- 页面最后只明显更新了一次

### 1.4 render 真正开始的时机，不是 `setState` 当下，而是 React 开始处理这批 update 的时候

也就是说：

- `setState` 只是把工作挂出去
- React 真正进入 render 时，才会重新执行你的组件函数

---

## 2. 两个最常见的页面现象

### 2.1 为什么 `setState` 后立刻打印，还是旧值

```js
setCount(count + 1)
console.log(count) // 还是旧值
```

原因不是“React 故意异步”，而是这次函数执行拿到的是旧快照。

更准确的理解是：

- `count` 是本轮 render 读取出来的值
- `setCount` 只是登记下一轮更新
- 新状态要到下一轮 render 才会出现在新的闭包里

所以这件事本质上是：

> **当前闭包不会被反向修改。**

### 2.2 为什么连续三次 `setCount(count + 1)` 只加了 1

```js
setCount(count + 1)
setCount(count + 1)
setCount(count + 1)
```

如果这三次发生在同一轮里，它们读到的都是同一个旧 `count`。

假设旧值是 `0`，那三次实际入队的效果都更接近：

```js
setCount(1)
setCount(1)
setCount(1)
```

最后结果自然还是 `1`。

而函数式更新不同：

```js
setCount(c => c + 1)
setCount(c => c + 1)
setCount(c => c + 1)
```

这三次 update 会在队列里按顺序执行：

```text
0 → 1 → 2 → 3
```

所以最终是 `+3`。

### 一个非常实用的经验

如果下一状态依赖上一状态：

> **优先用函数式更新。**

---

## 3. 状态到底存在哪里

很多人会下意识以为 state 存在组件函数的局部变量里，其实不是。

对于函数组件，状态更接近存储在：

- 当前组件对应的 Fiber 上
- Fiber 的 `memoizedState` Hook 链表里

示意图：

```text
fiber.memoizedState → hook1 → hook2 → hook3
                      state    effect   ref
```

### 一个常见现象：为什么组件函数执行完了，状态却还能“记住”

因为真正持久化的不是函数里的局部变量，而是 Fiber 上那串 Hook 节点。

每次 render 时，React 做的更接近是：

1. 找到这个 Fiber
2. 按顺序取出 Hook 节点
3. 读取里面保存的状态
4. 把这些值交给当前这次函数调用使用

所以局部变量只是：

> **从 Hook 存储里读出来的一次性快照。**

这也是闭包问题的根源之一：事件回调、定时器、Promise 回调捕获的是当时那轮 render 读出来的值。

---

## 4. 更新队列：React 是怎么把多个 `setState` 串起来算的

每个 state Hook 都会关联一个更新队列。`setState` 时，React 会创建一个 update 对象并塞进队列。

一个简化后的 update 可以近似看成：

```js
{
  lane: SyncLane,
  action: newStateOrUpdater,
  next: null,
}
```

### 从队列角度看，`setState` 更像一张待处理纸条

比如：

```js
setCount(1)
setCount(c => c + 1)
setCount(5)
```

这些并不会当场立刻改掉状态，而是先变成几张排队等待处理的“更新指令”。

等 render 真正开始时，React 才会按顺序把它们应用到 `baseState` 上。

### 一个页面现象：为什么一次 commit 里像是处理了很多次 setState

因为：

- 多个 update 可以先入队
- render 时顺序计算
- 最后统一 commit

所以：

- **一次 commit** 不等于 **只处理了一次更新**
- **一次 render** 里可能已经顺序跑过多条 update

---

## 5. `useState` 的实现主干

### 5.1 首次挂载（mount）

首次渲染时，`useState` 更接近走的是 `mountState`：

```js
function mountState(initialState) {
  const hook = mountWorkInProgressHook()
  hook.memoizedState = initialState

  const queue = { pending: null, dispatch: null }
  hook.queue = queue

  const dispatch = queue.dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber,
    queue,
  )

  return [hook.memoizedState, dispatch]
}
```

这里做的核心事情是：

- 创建 Hook 节点
- 把初始 state 放进去
- 创建更新队列
- 返回 `dispatch`

### 5.2 更新阶段（update）

后续渲染时，`useState` 更接近走的是 `updateState`：

```js
function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState)
}
```

也就是说，`useState` 本质上就是 `useReducer` 的一个简化版本。

### 一个关键认知

`useState` 真正重要的，不是 API 很短，而是它背后依赖了：

- Hook 链表位置稳定
- updateQueue 顺序稳定
- render 时按顺序取回对应 Hook

这也是为什么：

- Hook 不能写在条件里
- Hook 不能写在循环里
- Hook 顺序一乱，整条链都会对不上

---

## 6. 一次 `setState` 的源码关键链路

如果你只想抓主干，最值得记住的是这条链：

```text
事件回调 / 业务逻辑
  ↓
dispatchSetState
  ↓
enqueue update
  ↓
scheduleUpdateOnFiber
  ↓
render 阶段
  ↓
commit 阶段
  ↓
浏览器看到新 DOM
```

看一个最小例子：

```jsx
function Counter() {
  const [count, setCount] = useState(0)

  console.log('render', count)

  return (
    <button onClick={() => setCount(c => c + 1)}>
      {count}
    </button>
  )
}
```

### 6.1 `dispatchSetState`

```js
function dispatchSetState(fiber, queue, action) {
  const lane = requestUpdateLane(fiber)
  const update = {
    lane,
    action,
    next: null,
  }

  enqueueConcurrentHookUpdate(fiber, queue, update, lane)
  scheduleUpdateOnFiber(fiber, lane)
}
```

它做的事情很朴素：

- 决定这次更新的 lane
- 创建 update
- 入队
- 向上找到 root 并调度

### 6.2 `scheduleUpdateOnFiber`

```js
function scheduleUpdateOnFiber(fiber, lane) {
  const root = markUpdateLaneFromFiberToRoot(fiber, lane)
  ensureRootIsScheduled(root)
}
```

这一步的关键意义是：

> **把“某个组件有更新”提升成“整棵 root 需要安排一次工作”。**

### 6.3 什么时候才真正开始 render

这才是最容易被问到的点。

不是 `setState` 那一刻，而是 React 真正开始处理这批 update 时，才会重新执行组件函数。

对于函数组件，一次 render 的关键调用链可以近似看成：

```text
performConcurrentWorkOnRoot(root)
  ↓
renderRootConcurrent(root)
  ↓
workLoopConcurrent()
  ↓
performUnitOfWork(fiber)
  ↓
beginWork(current, workInProgress, lanes)
  ↓
updateFunctionComponent(...)
  ↓
renderWithHooks(...)
  ↓
Counter() // 这里才真正执行你的组件函数
```

也就是说：

> **你在组件顶部写的 `console.log('render')`，本质上发生在 `renderWithHooks` 调用组件函数时。**

### 6.4 render 完成后发生什么

render 阶段主要做的是：

- 根据 updateQueue 算出新状态
- 重新执行组件
- 构建新的 workInProgress Fiber 树
- 标记 Placement / Update / Deletion

之后才进入 commit：

```text
commitRoot
  ↓
commitMutationEffects
  ↓
commitLayoutEffects
  ↓
flushPassiveEffects
```

这时才会：

- 改真实 DOM
- 更新 ref
- 执行 `useLayoutEffect`
- 之后异步执行 `useEffect`

---

## 7. 哪些情况会触发 render，哪些不会

### 会触发 render 的常见情况

1. **首次挂载**：`createRoot(...).render(<App />)`
2. **state 更新**：`setState`、`dispatch`
3. **父组件重新 render**：子组件默认也会被重新纳入 render 流程
4. **context 变化**：消费者重新读取并 render
5. **强制同步刷新**：例如 `flushSync`

### 不会直接触发 render 的常见情况

- 改 `ref.current`
- 改普通局部变量
- `useEffect` 自己执行本身

### 一个页面现象：为什么我明明改了值，组件却没重新执行

通常是因为你改的是：

- 普通变量
- ref
- React 不知道需要重新调度的外部对象

React 只会对“被纳入它更新系统”的变化做出响应。

---

## 8. React 18 的自动批处理到底改了什么

在 React 18 之前，是否批处理和调用场景关系更大。

比如旧时代常见心智模型是：

- 合成事件 / 生命周期里：容易合批
- `setTimeout` / 原生事件里：更容易各自触发一次更新

React 18 之后，自动批处理范围更大了。

例如：

```js
setTimeout(() => {
  setCount(c => c + 1)
  setFlag(f => !f)
})
```

现在更容易被合并考虑成一批工作，而不是各自完整 render / commit 一遍。

### 一个页面现象：为什么同一段逻辑里多个 `setState` 不一定对应多次 DOM 更新

因为 React 会先收集这些 update，再统一进入 render / commit 流程。

如果你真的需要立刻同步落地，可以用：

```js
flushSync(() => {
  setCount(c => c + 1)
})
```

但它的语义是：

> **强制尽快同步处理这批更新。**

不是日常状态更新的默认姿势。

---

## 9. Lane 模型：为什么输入框先响应，搜索结果稍后刷新

React 18 用 Lane 模型管理优先级。你可以先把它理解成“不同车道的更新，紧急程度不同”。

| Lane | 常见场景 |
|------|---------|
| SyncLane | 强制同步刷新 |
| InputContinuousLane | 连续交互，如滚动、拖拽 |
| DefaultLane | 普通更新 |
| TransitionLane | `useTransition` 标记的更新 |
| IdleLane | 空闲时再做 |

### 一个页面现象：为什么输入值先变了，列表结果晚一点出来

这通常是最典型的 lane 体感：

- 输入框文本更新更紧急
- 大列表过滤 / 重渲染可以放低优先级
- 高优先级先保证交互手感
- 低优先级结果稍后补上

例如：

```js
const [isPending, startTransition] = useTransition()

startTransition(() => {
  setSearchQuery(input)
})
```

用户看到的效果通常就是：

1. 输入先跟手
2. 结果稍后刷新
3. 如果中途又输入新字符，旧的低优先级 render 还可能被打断

这不是 React 漏更新，而是 React 在按优先级安排更新顺序。

---

## 10. 最后压缩成 10 句

1. **`setState` 不是立刻改变量，而是先创建 update 并入队。**
2. **函数组件里的 state 是当前这轮 render 的快照，不是可原地修改的活变量。**
3. **连续三次 `setCount(count + 1)` 只加 1，本质上是三次都读了同一个旧快照。**
4. **函数式更新能串起来累加，是因为 updateQueue 会顺序把前一个结果传给后一个。**
5. **状态真正存储在 Fiber 的 Hook 链表里，不在局部变量里。**
6. **render 真正开始的时机，不是 `setState` 当下，而是 React 开始处理这批 update 的时候。**
7. **组件顶部的 `console.log('render')`，本质上发生在 `renderWithHooks` 调用组件函数时。**
8. **一次 commit 可能已经顺序处理了很多个 update，不等于只处理了一次 `setState`。**
9. **自动批处理优化的是合并更新，不改变“state 先入队、render 再计算、commit 再落地”这条主链。**
10. **Lane 模型决定的是更新先后顺序，所以常会出现“输入先响应，结果后刷新”的体感。**
