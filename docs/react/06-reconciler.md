# 六、协调器（Reconciler）

协调器最容易让人混淆的地方，不是 beginWork、completeWork 这些名字，而是：

- render 阶段到底在算什么？
- commit 阶段到底在做什么？
- 为什么组件函数会执行很多次，但页面只变一次？
- 为什么 `React.memo` 有时能挡住，有时又完全挡不住？

这一章只做一件事：把 **render / commit / bailout / Suspense** 这几条主链路真正串起来。

---

## 1. 先给结论

### 1.1 协调器负责“算下一版 UI 应该怎么变”

它的核心职责不是直接操作 DOM，而是：

- 遍历 Fiber 树
- 判断哪些节点需要更新
- 复用哪些节点
- 标记哪些节点需要插入、更新、删除

### 1.2 render 和 commit 是两段完全不同的工作

- **render 阶段**：可中断、可重试、可丢弃，主要做计算
- **commit 阶段**：同步、不可中断，主要做落地

所以：

> **组件函数执行了，不等于页面已经更新。**

### 1.3 bailout 优化的不是 DOM，而是“别再往下 render 了”

像 `React.memo`、props 未变、context 未变这些优化，真正拦住的是：

- 子组件函数不再执行
- 子树 render 不再继续展开

而不是“先 render 一遍再取消 DOM 更新”。

---

## 2. render 阶段：beginWork 和 completeWork 在做什么

render 阶段采用深度优先遍历，每个 Fiber 通常会经历两个关键步骤。

### 2.1 `beginWork`

更接近“向下展开当前 Fiber”：

- 看当前 Fiber 属于什么类型
- 函数组件就执行组件函数
- 类组件就执行 render
- Host 组件就处理 props / children
- 生成 / 对比子 Fiber

如果当前 Fiber 没必要继续算下去，还可能在这里直接 bailout。

### 2.2 `completeWork`

更接近“向上收尾”：

- 处理当前 Fiber 的收尾工作
- 对 Host Fiber 创建 / 复用宿主实例
- 冒泡子树 flags
- 为 commit 阶段准备信息

一个简化遍历顺序可以看成：

```text
        A
       / \
      B   C
     / \
    D   E

beginWork:   A → B → D
completeWork: D
beginWork:   E
completeWork: E → B
beginWork:   C
completeWork: C → A
```

### 一个页面现象：为什么父组件 render 后，子组件也常常跟着执行

因为默认情况下，父组件重新进入 render 后，React 会继续往下遍历它的子 Fiber。

所以更默认的心智模型是：

> **父 render，子也会被纳入这轮 render 流程。**

只有满足 bailout 条件时，这条向下传播链才可能在某个子树边界停住。

---

## 3. commit 阶段：真正改 DOM 的是这里

render 阶段算完之后，React 才会进入 commit。

commit 通常可以粗略分成三段：

### 3.1 beforeMutation

这一段更接近“DOM 真正修改前的最后窗口”：

- 执行 `getSnapshotBeforeUpdate`
- 为后续副作用处理做准备

### 3.2 mutation

这里才真正操作 DOM：

- **Placement**：插入新节点
- **Update**：更新属性 / 文本 / 样式
- **Deletion**：删除节点、解绑 ref、处理卸载

### 3.3 layout

这时 DOM 已经是新的了，但浏览器通常还没 paint：

- 执行 `useLayoutEffect`
- 执行 `componentDidMount` / `componentDidUpdate`
- 更新 ref

之后浏览器绘制，最后再异步执行 passive effects（`useEffect`）。

### 一个页面现象：为什么 `useLayoutEffect` 能拿到新 DOM，但 `useEffect` 更晚

因为它们本来就不在同一个时机：

- `useLayoutEffect` 更靠近 commit 同步窗口
- `useEffect` 更靠近 paint 之后

所以如果你在 `useEffect` 里做视觉修正，用户更容易先看到旧位置再看到新位置，表现成闪动。

---

## 4. 从页面现象理解 render / commit

把 render 和 commit 分开看之后，很多现象就会变得很自然。

### 4.1 render 执行了，不代表页面已经变了

在函数组件里打印日志时，常常会先看到新的 props / state，但页面还没更新。

原因是：

- render 只是在算下一版 UI
- commit 才会真正改 DOM

### 4.2 组件函数可能执行很多次，但 DOM 只改一次

在并发渲染或开发环境下，render 阶段可能：

- 被中断
- 被恢复
- 被重试
- 被后续更高优先级更新覆盖

所以常见现象是：

```text
render #1
render #2
render #3
↓
只 commit 最终那一版
```

这也是为什么：

- render 里不能放副作用
- 不能把“函数组件执行一次”简单等同于“页面更新一次”

### 4.3 为什么大列表更新时，输入框有时还能继续响应

因为 render 阶段可以被打断。

React 可以先暂停低优先级 Fiber 的计算，优先处理更紧急的交互更新。

但要注意：

> **一旦进入 commit，当前这批 DOM 变更必须同步做完。**

所以如果 commit 很重，页面仍然会顿一下。

### 4.4 为什么 ref / effect 会经历清理和重新建立

因为 React 在 commit 流程中，要先处理旧节点卸载，再处理新节点挂载。

这样可以保证：

- 旧引用及时失效
- 新引用在正确时机建立
- cleanup 与 mount 的顺序稳定可预期

---

## 5. `React.memo` 与 bailout 到底拦在哪里

看一个最典型的例子：

```jsx
const Child = React.memo(function Child({ value, onClick }) {
  console.log('child render')
  return <button onClick={onClick}>{value}</button>
})
```

很多人误以为流程是：

```text
先执行 Child()
  ↓
发现 props 没变
  ↓
再决定跳过
```

更接近真实情况的是：

```text
beginWork
  ↓
updateMemoComponent
  ↓
比较 prevProps / nextProps
  ↓
满足条件
  ↓
bailoutOnAlreadyFinishedWork
  ↓
跳过子树 render
```

### 一个非常简化的伪代码

```js
function updateMemoComponent(current, workInProgress, Component, nextProps) {
  const prevProps = current.memoizedProps

  if (shallowEqual(prevProps, nextProps) && !hasScheduledUpdateOrContext) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress)
  }

  return updateFunctionComponent(...)
}
```

### 真正被跳过的是什么

只有在 bailout 成立时：

- `Child` 组件函数不会执行
- `console.log('child render')` 不会打印
- 它下面那整棵子树也可能一起被跳过

所以 `React.memo` 真正优化的是：

> **避免 render 工作继续向下传播。**

### 为什么看起来用了 `React.memo` 还是没挡住

常见原因有这些：

1. 父组件每次都传新的对象 / 新函数引用
2. memo 组件自己有 state 更新
3. 组件消费了变化中的 context
4. 自定义比较函数返回 false

比如：

```jsx
<Child value={count} onClick={() => doSomething(count)} />
```

这里 `onClick` 每次都是新函数，所以很难 bailout。

如果改成：

```jsx
const handleClick = useCallback(() => {
  doSomething(count)
}, [count])
```

那至少在 `count` 不变的那些 render 里，`Child` 更有机会被跳过。

### 一个页面现象：为什么父组件 render 了，子组件日志没打印

这通常正是 bailout 生效的表现：

1. 父组件进入 render
2. React 走到子 Fiber 的 `beginWork`
3. 判断 props / context / lanes 没问题
4. 直接复用旧子树
5. 子组件函数不执行

---

## 6. Suspense 与并发特性在协调器里是怎么接住的

看最典型的写法：

```jsx
<Suspense fallback={<Spinner />}>
  <LazyComponent />
</Suspense>
```

它解决的不是“让异步 magically 消失”，而是：

- 当子树暂时还不能正常完成 render
- 先给你一份 fallback UI
- 等准备好之后再重新 render 真正内容

### 一个页面现象：为什么内容没出来，但 loading 先出来了

因为 Suspense 更接近下面这条链：

```text
子树 render 时发现当前结果还没准备好
  ↓
抛出 Promise / wakeable
  ↓
React 捕获
  ↓
最近的 Suspense 边界接管
  ↓
render fallback
  ↓
等 Promise resolve 后重新调度
  ↓
再 render 真正子树
```

### `useTransition` 为什么能改善体感

```jsx
const [isPending, startTransition] = useTransition()

startTransition(() => {
  setPage(newPage)
})
```

它并不是让工作消失，而是把这类更新标成“可以晚一点”。

于是用户更容易看到：

- 旧内容先保留
- 当前交互先顺滑完成
- 新内容稍后替换上来

这本质上仍然是协调器和调度器在共同决定：

> **这次 render 应该先保证什么，稍后再完成什么。**

---

## 7. 最后压缩成 9 句

1. **协调器负责遍历 Fiber 树、比较新旧子树、标记副作用。**
2. **render 阶段主要做计算，可中断、可重试、可丢弃。**
3. **commit 阶段主要做落地，会同步修改真实 DOM。**
4. **组件函数执行了，不代表页面已经更新；页面更新要等 commit。**
5. **父组件 render 时，子树默认也会被重新纳入 render 流程。**
6. **`React.memo` 的 bailout 是在子组件真正执行前尝试拦住 render。**
7. **`React.memo` 挡的是 render 传播，不是先 render 再取消 DOM 更新。**
8. **Suspense 的本质是给“暂时还完成不了的子树”提供一个 fallback 边界。**
9. **协调器真正难的地方，不是 API 名字，而是始终分清 render 在算什么、commit 在改什么。**
