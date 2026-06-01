# 一、渲染机制

React 渲染机制最容易混的，不是 API 名字，而是这几件事总被当成一回事：

- JSX 写出来了
- 组件函数执行了
- Fiber 树建好了
- 真实 DOM 改了
- 浏览器把页面画出来了

它们其实分属不同层次。

这一章只做一件事：把 **JSX → React Element → Fiber → DOM → 首次挂载 / diff** 串成一条真正能解释页面现象的链路。

---

## 1. 先给结论

### 1.1 JSX 不是 DOM，而是“下一版 UI 的描述”

你写：

```jsx
<div className="app">Hello</div>
```

React 并不会当场创建一个浏览器 `div`，而是先把它变成一个 **React Element 对象**。

### 1.2 render 不是改 DOM，commit 才是改 DOM

render 阶段主要做的是：

- 执行组件函数 / render 方法
- 生成新的 React Element
- 构建 workInProgress Fiber 树
- 对比新旧子树
- 标记哪里要插入、更新、删除

commit 阶段才会：

- 插入 / 更新 / 删除真实 DOM
- 更新 ref
- 执行 `useLayoutEffect`

所以：

> **组件函数已经执行，不代表页面已经变了。**

### 1.3 所谓“虚拟 DOM”，实现上至少要分三层看

很多文章会把所有中间层都笼统叫成“虚拟 DOM”，但从实现上更准确的分法是：

1. **React Element**：这次 UI 想长什么样
2. **Fiber**：React 内部如何完成这次工作
3. **真实 DOM**：浏览器真正拿去布局、绘制、响应事件的节点

### 1.4 首次挂载和后续更新，主干流程其实是一套

无论是：

- `createRoot(...).render(<App />)`
- `setState(...)`
- props 变化
- context 变化

本质上都要走：

```text
创建 update
  ↓
调度 root
  ↓
render 阶段
  ↓
commit 阶段
  ↓
浏览器看到新页面
```

---

## 2. JSX 到底会变成什么

先看最熟悉的例子：

```jsx
const element = <div className="app">Hello</div>
```

编译后更接近：

```jsx
const element = React.createElement('div', { className: 'app' }, 'Hello')
```

React 17+ 之后通常会变成：

```js
import { jsx as _jsx } from 'react/jsx-runtime'

const element = _jsx('div', { className: 'app', children: 'Hello' })
```

它返回的不是 DOM，而是一个普通 JS 对象：

```js
{
  $$typeof: Symbol(react.element),
  type: 'div',
  key: null,
  ref: null,
  props: {
    className: 'app',
    children: 'Hello',
  },
}
```

### 一个页面现象：为什么 JSX 看起来像 HTML，但并不能直接操作节点

因为 JSX 更像是：

> **“我要一个 div，带这些 props 和 children。”**

它描述的是“想要什么 UI”，不是“浏览器里已经存在什么节点”。

所以你可以：

- 打印它
- 比较它
- 作为函数返回值传来传去

但你不能对它做这些事：

- `appendChild`
- `remove`
- `focus`
- `getBoundingClientRect`

因为这些都属于真实 DOM 的能力，不属于 React Element。

---

## 3. React Element、Fiber、真实 DOM 在结构上到底差在哪

如果把三层混在一起，后面很多现象都会越看越乱。

| 层次 | 本质 | 典型字段 / 能力 | 作用 |
|------|------|------------------|------|
| React Element | 普通 JS 对象 | `type`、`key`、`props` | 描述这次渲染想要什么 UI |
| Fiber | React 内部工作节点 | `child`、`sibling`、`return`、`flags`、`alternate` | 描述这次更新怎么做、做到哪了 |
| 真实 DOM | 浏览器宿主对象 | `appendChild`、`style`、`offsetWidth`、`addEventListener` | 真正参与布局、绘制、事件 |

看一个简化对比：

```js
// React Element：描述 UI
{
  type: 'div',
  key: null,
  props: { className: 'app', children: 'Hello' }
}

// Fiber：描述工作单元
{
  type: 'div',
  child: childFiber,
  sibling: null,
  return: parentFiber,
  pendingProps: { className: 'app', children: 'Hello' },
  memoizedProps: { className: 'app', children: 'Hello' },
  stateNode: HTMLDivElement | null,
  alternate: otherFiber,
}
```

### 结构上的关键区别

- **React Element 没有树遍历过程状态**，它只是一次性的描述对象。
- **Fiber 有父子兄弟指针**，可以被逐个处理、暂停、恢复，所以更像工作链表节点。
- **真实 DOM 是浏览器对象**，改它之后浏览器还要继续做 style / layout / paint。

所以“虚拟 DOM”更准确的心智模型不是“浏览器里还有一棵假的 DOM 树”，而是：

> **React Element 负责描述，Fiber 负责工作，DOM 负责落地。**

---

## 4. 首次挂载时，页面是怎么从 React 代码变出来的

看入口：

```js
import { createRoot } from 'react-dom/client'
import App from './App'

const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

内部主链路可以近似理解成：

```text
createRoot(container)
  ↓
创建 FiberRoot / hostRootFiber
  ↓
root.render(<App />)
  ↓
updateContainer(element, root)
  ↓
scheduleUpdateOnFiber
  ↓
renderRootConcurrent / renderRootSync
  ↓
beginWork / completeWork
  ↓
commitRoot
  ↓
真实 DOM 插入 container
```

### 一个非常简化的伪代码

```js
const root = createContainer(container)
updateContainer(element, root)

function updateContainer(element, root) {
  const current = root.current
  const lane = requestUpdateLane(current)
  const update = createUpdate(lane)
  update.payload = { element }

  enqueueUpdate(current, update, lane)
  scheduleUpdateOnFiber(current, lane)
}
```

### `App()` 是在什么时候真正执行的

很多人误以为：

```js
root.render(<App />)
```

这一行一调用，`App()` 就立刻执行了。

更接近真实情况的是：

1. 先创建一条根节点 update
2. 标记 root 有工作要做
3. React 真正开始 render 时，才会沿 Fiber 树往下走
4. 走到 `AppFiber` 时，才执行 `App()`

关键调用链可以近似看成：

```text
updateContainer
  ↓
scheduleUpdateOnFiber
  ↓
performConcurrentWorkOnRoot
  ↓
renderRootConcurrent
  ↓
workLoopConcurrent
  ↓
beginWork(hostRootFiber)
  ↓
updateHostRoot
  ↓
reconcileChildren
  ↓
beginWork(AppFiber)
  ↓
updateFunctionComponent
  ↓
App()
```

也就是说：

> **组件函数真正执行，发生在 render 阶段遍历到它自己的 Fiber 时。**

---

## 5. render 阶段到底在干什么

render 阶段的关键词是：**计算下一版 UI**。

它主要做这些事：

- 执行函数组件 / 类组件 render
- 根据新 props / state / context 计算子树
- 构建 workInProgress Fiber 树
- 比较新旧子节点
- 给 Fiber 打上 `Placement / Update / Deletion` 等标记

### `beginWork` 和 `completeWork`

render 阶段不是一口气跑完整棵树，而是深度优先地处理每个 Fiber。

#### `beginWork`

更接近“向下展开”：

- 判断这个 Fiber 是什么类型
- 函数组件就执行组件函数
- 类组件就执行 render
- Host 组件就处理 props
- 产出子 Fiber，继续往下走

#### `completeWork`

更接近“向上收尾”：

- 处理当前 Fiber 的收尾工作
- 对 Host Fiber 创建 / 复用宿主实例
- 冒泡子树的 flags

### 一个页面现象：为什么组件日志先打印，页面后出现

首次挂载时经常能看到：

1. 控制台先打印组件顶部的 `console.log`
2. 然后页面内容才出现

原因就是：

- 日志发生在 render 阶段的组件执行过程中
- 页面真正出现，要等 commit 把 DOM 插入容器之后

---

## 6. 为什么 render 已经执行了，DOM 还是旧的

这是理解 React 最关键的分层之一。

render 完成时，React 只是拿到了：

- 新的 workInProgress Fiber 树
- 哪些节点需要插入 / 更新 / 删除的标记

此时浏览器里的 DOM 仍然可能还是旧的。

真正落地要等 commit：

```text
render 完成
  ↓
commitRoot
  ↓
commitMutationEffects
  ↓
commitLayoutEffects
  ↓
浏览器 paint
```

### DOM 是在哪里创建和插入的

很多人会以为函数组件一执行，DOM 就顺手建出来了，其实不是。

更接近的链路是：

```text
completeWork
  ↓
createInstance(type, props)
  ↓
appendAllChildren(instance, workInProgress)
  ↓
commitRoot
  ↓
commitPlacement
  ↓
insertOrAppendPlacementNodeIntoContainer
```

所以最稳的心智模型是：

- **render 决定页面应该长什么样**
- **commit 才让浏览器真的拥有这些 DOM 节点**

---

## 7. diff 和 key 真正解决的是什么

React 并不会拿两棵树做最通用的最优编辑距离算法，那样成本太高。

它依赖几个非常重要的前提：

1. **不同 type 的节点，直接认为不是同一棵子树**
2. **主要做同层比较，不跨层级乱猜**
3. **列表稳定性由 key 提示**

### 一个最常见的页面现象：列表重排后，输入框串值 / state 对不上

看这种写法：

```jsx
{list.map((item, index) => (
  <Item key={index} item={item} />
))}
```

如果列表发生插入、删除、重排，React 很容易把“同一个位置”错当成“同一个节点身份”，于是出现：

- 节点被错误复用
- 输入框内容串到别的行
- 局部 state 对错项
- 额外 DOM 重建

更稳的写法是：

```jsx
{list.map(item => (
  <Item key={item.id} item={item} />
))}
```

因为 key 的真正作用不是“消除 warning”，而是：

> **给 React 一个稳定的节点身份。**

---

## 8. 最后压缩成 9 句

1. **JSX 不是 DOM，它只是 React Element 的语法糖。**
2. **React Element 负责描述 UI，Fiber 负责描述工作过程，真实 DOM 负责浏览器落地。**
3. **`root.render(<App />)` 不是立刻改 DOM，而是先创建 update 并调度 root。**
4. **组件函数真正执行，发生在 render 阶段遍历到对应 Fiber 时。**
5. **render 负责算下一版 UI，commit 才真正插入 / 更新 / 删除 DOM。**
6. **组件日志已经打印，但页面还没出现，通常说明还停在 render 与 commit 之间。**
7. **所谓“虚拟 DOM”更准确地看，是 React Element + Fiber 工作树，而不是浏览器里又有一棵真 DOM。**
8. **diff 不是全局最优匹配，而是建立在 type、同层比较、key 稳定性这些前提上的启发式算法。**
9. **key 的核心作用是稳定节点身份，不只是为了消除警告。**
