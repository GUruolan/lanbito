# 零、render / commit / memo / context 总览

很多人会把这些事混在一起：

- `setState` 调用了
- 组件函数执行了
- DOM 更新了
- 浏览器把页面画出来了
- `useEffect` 执行了

它们其实不是一回事。

本文只做一件事：把 **render、commit、memo、context** 这几件最容易混的事一次讲透。

---

## 1. 先给结论

### 1.1 `setState` 不是 render

`setState` / `dispatch` / `root.render()` 做的第一件事，不是立刻重新执行组件，而是：

1. 创建一次 update
2. 把 update 放进队列
3. 告诉 React：这棵树有更新要处理

真正的 render，发生在 React **开始处理这批 update** 的时候。

### 1.2 render 不是“JS 闲时才执行”

更准确的说法是：

> React render 发生在：**更新已经被调度，而 React 真正拿到主线程开始处理它的时候。**

所以它不是：

- 只有浏览器完全空闲才跑
- 只有 `requestIdleCallback` 才跑
- `setState` 调用那一行就立刻跑

而更接近：

- 当前事件回调先执行完
- React 获得执行机会
- 然后进入 render

### 1.3 render 不是改 DOM，commit 才是

render 做的是：

- 重新执行组件函数
- 计算新 state / props / context
- 生成新的 React Element
- 构建新的 Fiber 树
- 做 diff
- 标记哪里要插入、更新、删除

commit 做的是：

- 真正修改 DOM
- 更新 ref
- 执行 `useLayoutEffect`

所以：

> **render 完成了，DOM 仍然可能是旧的。**
> **只有 commit 完成，页面对应的真实 DOM 才真的变。**

---

## 2. 一次点击更新的完整时序

看这个例子：

```jsx
function Counter() {
  const [count, setCount] = useState(0)

  console.log('render', count)

  useLayoutEffect(() => {
    console.log('layout effect', count)
  })

  useEffect(() => {
    console.log('effect', count)
  })

  return (
    <button onClick={() => setCount(c => c + 1)}>
      {count}
    </button>
  )
}
```

点击一次按钮，时序可以近似看成：

```text
用户点击
  ↓
onClick 回调执行
  ↓
setCount(c => c + 1)
  ↓
创建 update
  ↓
update 入队
  ↓
scheduleUpdateOnFiber
  ↓
当前事件回调结束
  ↓
React 开始 render
  ↓
执行 Counter()            ← 这里打印 render 1
  ↓
render 完成，得到新 Fiber 树
  ↓
commitRoot
  ↓
真实 DOM 更新为 1
  ↓
执行 useLayoutEffect      ← 这里打印 layout effect 1
  ↓
浏览器 paint
  ↓
执行 useEffect            ← 这里打印 effect 1
```

如果你只想记一条线，就记这个：

```text
setState
  ↓
更新入队
  ↓
React render
  ↓
组件函数执行
  ↓
commit
  ↓
DOM 更新
  ↓
useLayoutEffect
  ↓
paint
  ↓
useEffect
```

---

## 3. render 到底什么时候开始

### 3.1 不是 `setState` 那一刻

`setState` 更像是在说：

> “React，请安排一次更新。”

它不会直接改掉你当前闭包里的变量，也不会保证组件函数就在这一行立刻执行。

### 3.2 真正开始 render 的时刻

对于函数组件，render 真正开始落到这个组件上，大致发生在这条调用链里：

```text
renderRootSync(...) / renderRootConcurrent(...)
  ↓
beginWork(...)
  ↓
updateFunctionComponent(...)
  ↓
renderWithHooks(...)
  ↓
执行你的函数组件
```

也就是说：

> **你在组件顶部写的 `console.log('render')`，本质上发生在 `renderWithHooks` 调用组件函数时。**

所以判断 render 有没有真的开始，最简单的方法就是：

- `setState` 调用了：**不代表 render 已开始**
- 组件顶部日志打印了：**代表 render 已开始**

### 3.3 为什么它看起来有时“像晚一点才执行”

因为 React 不一定会把所有更新都按同样方式处理。

#### 普通更新

比如点击里的普通 `setState`：

```jsx
onClick={() => {
  setCount(c => c + 1)
}}
```

体感通常是：

```text
事件回调结束后很快开始 render
```

#### `startTransition`

```jsx
startTransition(() => {
  setQuery(input)
})
```

这类更新优先级更低，可能被延后，也可能开始一部分后暂停再继续。

它更像：

```text
先保证高优先级交互顺滑
↓
稍后再 render 低优先级部分
```

#### `flushSync`

```jsx
flushSync(() => {
  setCount(c => c + 1)
})
```

这类会强制 React 尽快同步处理：

```text
setState
↓
立刻 render
↓
立刻 commit
```

---

## 4. 为什么 render 已执行，但 DOM 还是旧的

因为 render 和 commit 分工不同。

### render 阶段

它主要是在“试算下一版 UI”：

- 重新执行组件
- 算出新状态
- 算出新子树
- 打上 `Placement / Update / Deletion` 标记

### commit 阶段

它才真正把结果落地：

- 插入节点
- 更新属性
- 删除节点
- 更新 ref
- 执行 `useLayoutEffect`

所以这件事是完全正常的：

```text
组件函数已经执行
↓
render 日志已经打印
↓
但 DOM 还没变
```

因为你还在 **render 完成、commit 未完成** 之间。

---

## 5. 为什么一个组件会 render 很多次，但 DOM 好像只更新了一次

这是 React 非常正常的行为。

### 5.1 render 是试算，commit 才是落地

React 完全允许这样：

```text
render #1
render #2
render #3
↓
只 commit #3
```

前面的 render 可能只是中间态，它们可能：

- 被更高优先级更新打断
- 被后续更新覆盖
- 在并发模式下被重试
- 在开发环境里被 StrictMode 故意多执行一次

所以你会看到：

- `render` 打印很多次
- 页面只明显变了一次

### 5.2 render 了，不代表 DOM 一定要变化

即使组件函数重新执行了，最后产物也可能和上次完全一样：

```jsx
function Child() {
  console.log('render child')
  return <div>hello</div>
}
```

多次 render 后，如果 JSX 结构没变，commit 阶段可能根本没有实际 DOM mutation。

所以：

> **组件函数执行，不等于真实 DOM 必然变化。**

---

## 6. 父组件 render 了，子组件一定会 render 吗

默认情况下，**很可能会**。

看这个例子：

```jsx
function Parent() {
  const [count, setCount] = useState(0)

  console.log('parent render')

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <Child />
    </div>
  )
}

function Child() {
  console.log('child render')
  return <div>child</div>
}
```

点击按钮后，通常会看到：

```text
parent render
child render
```

因为父组件重新执行后，React 要重新计算它返回的子树，默认会继续往下走到 `Child`。

所以默认心智模型是：

> **父 render，子也会被重新纳入 render 流程。**

但要注意：

- 这不等于 DOM 一定变化
- 这也不等于子组件就一定无法被优化掉

---

## 7. `React.memo` 到底拦在哪里

很多人误以为 `React.memo` 的流程是：

```text
先执行 Child()
再发现 props 没变
再决定跳过
```

其实更接近的是：

```text
beginWork(ChildFiber)
  ↓
发现这是 MemoComponent
  ↓
比较 prevProps / nextProps
  ↓
如果相等
  ↓
bailoutOnAlreadyFinishedWork(...)
  ↓
不执行 Child()
```

也就是说：

> **`React.memo` 是在子组件真正执行前尝试拦住它。**

它拦的不是 DOM，而是：

> **尽量不让这个子组件继续往下 render。**

---

## 8. `React.memo` 默认比较的是什么

默认是**浅比较**。

### 好跳过的例子

```jsx
<Child value={1} />
```

如果前后都是 `1`，容易 bailout。

### 不好跳过的例子

```jsx
<Child data={{ a: 1 }} />
```

虽然你觉得“内容一样”，但每次都是新对象：

```js
{ a: 1 } !== { a: 1 }
```

所以 React 仍然会认为 props 变了。

---

## 9. `useMemo` / `useCallback` 到底在保护谁

它们本质上都在做一件事：

> **稳定引用**

### `useMemo`

```jsx
const data = useMemo(() => ({ a, b }), [a, b])
```

作用是：当 `a`、`b` 没变时，`data` 还是上一次那个对象引用。

### `useCallback`

```jsx
const onClick = useCallback(() => {
  doSomething(id)
}, [id])
```

本质上等价于：

```jsx
useMemo(() => fn, deps)
```

作用是：当依赖没变时，函数引用保持稳定。

### 它们真正有用的场景

#### 1. 给 `React.memo` 创造 bailout 条件

```jsx
const Child = React.memo(function Child({ data, onClick }) {
  ...
})
```

如果 `data` 和 `onClick` 每次都是新引用，那 `React.memo` 根本拦不住。

#### 2. 避免父组件 render 时把下游也拖下水

```jsx
function Parent({ a, b, c }) {
  const data = useMemo(() => ({ a, b }), [a, b])
  return <Child data={data} />
}
```

如果只是 `c` 变了：

- `Parent` 还是会 render
- 但 `data` 引用不变
- `Child` 更容易 bailout

所以它保护的更多是：

> **下游组件**
> 而不是：
> **当前组件自己不 render**

---

## 10. `useMemo(() => ({...}), deps)` 能挡什么，挡不住什么

### 能挡住的：假变化

比如：

- 父组件因为别的原因 render
- 但对象内容没变
- 只是每次都新建了一个新对象

这时 `useMemo` 很有价值。

### 挡不住的：真变化

比如：

```jsx
const value = useMemo(() => ({ theme, user }), [theme, user])
```

只要 `user` 真变了，`value` 就一定是新对象。

这时：

- Provider 还是会认为 value 变了
- 下游 consumer 还是要重新 render

所以一句话：

> **`useMemo` 只能挡“引用假变化”，挡不住“依赖真变化”。**

---

## 11. props 更新和 context 更新有什么本质区别

这是理解 context 性能问题的关键。

### props 更新更像

```text
父组件更新
  ↓
父组件 render
  ↓
继续往下走子树
  ↓
子组件收到 nextProps
  ↓
决定 render / bailout
```

它更像是：

> **父传子，一层层往下算**

### context 更新更像

```text
Provider value 变了
  ↓
React 找到所有订阅这个 context 的 consumer
  ↓
这些 consumer 重新 render
```

它更像是：

> **Provider 对所有订阅者广播**

这也是为什么 context 更容易让你觉得：

> “明明只改了一点，怎么一大片都 render 了？”

---

## 12. 为什么 `React.memo` 挡不住 context

因为 `React.memo` 只管 props 路径。

它比较的是：

```text
prevProps === nextProps ?
```

但如果组件内部用了：

```jsx
const theme = useContext(ThemeContext)
```

那 context 变化是另一条独立信号。

所以即使：

- props 没变
- 子组件被 `React.memo` 包住了

只要它订阅的 context 变了，它还是会 render。

一句话总结：

> **`React.memo` 挡 props，不挡 context。**

---

## 13. 为什么 `useContext` 一变，哪怕只用了一个字段，也会重新 render

因为 `useContext` 订阅的是：

> **整个 context value**

不是：

> **value 里的某个字段**

看例子：

```jsx
const AppContext = React.createContext(null)

function ThemeText() {
  const { theme } = useContext(AppContext)
  console.log('ThemeText render')
  return <span>{theme}</span>
}
```

如果 Provider 的 value 是：

```jsx
const value = useMemo(() => ({
  theme,
  user,
  setTheme,
  setUser,
}), [theme, user])
```

当 `user` 变化时，整个 `value` 还是变了。
于是即使 `ThemeText` 只用了 `theme`，它还是会 render。

因为 React 不会做这种事：

- 自动分析你只读了 `theme`
- 只按字段给你做订阅

React 只知道：

> **这个 consumer 依赖了 `AppContext`。**

它不知道：

> **这个 consumer 只依赖 `AppContext.theme`。**

---

## 14. context 优化为什么优先靠“拆”

如果你写：

```jsx
<AppContext.Provider value={{ user, theme, locale, cart }}>
```

那只改 `user`，订阅这个大 context 的组件都可能被叫起来重新 render。

更合理的方式通常是拆成：

- `UserContext`
- `ThemeContext`
- `LocaleContext`

这样：

- 改 `user`
- 不会顺手把只关心 `theme` 的组件也叫起来

所以对于 context，最有效的优化通常不是“一个大对象 + `useMemo`”，而是：

> **缩小广播范围**

---

## 15. 一次更新的源码关键链路（简化版）

### 15.1 `setState`

```text
dispatchSetState
  ↓
enqueue update
  ↓
scheduleUpdateOnFiber
  ↓
mark root 有更新
```

这一步只是：

- 创建 update
- 入队
- 调度

还没有执行你的组件函数。

### 15.2 真正开始 render

```text
performSyncWorkOnRoot / performConcurrentWorkOnRoot
  ↓
renderRootSync / renderRootConcurrent
  ↓
workLoopSync / workLoopConcurrent
  ↓
performUnitOfWork
  ↓
beginWork
  ↓
updateFunctionComponent
  ↓
renderWithHooks
  ↓
执行你的函数组件
```

### 15.3 commit

```text
commitRoot
  ├─ commitBeforeMutationEffects
  ├─ commitMutationEffects
  ├─ commitLayoutEffects
  └─ flushPassiveEffects
```

可以粗略理解为：

- `commitMutationEffects`：真正改 DOM
- `commitLayoutEffects`：执行 `useLayoutEffect`
- `flushPassiveEffects`：执行 `useEffect`

---

## 16. 调试时最有用的判断口诀

以后你遇到“到底发生到哪一步了”，按这组判断就行：

### 看到 `setState`

说明：

- 更新发起了
- **不代表 render 已开始**

### 看到组件顶部 `console.log('render')`

说明：

- React 已经开始 render
- 并且走到这个组件了

### 看到 `useLayoutEffect`

说明：

- commit 已经做完
- DOM 已经是新的
- 但浏览器可能还没 paint

### 看到 `useEffect`

说明：

- 页面通常已经 paint 完了
- 这是绘制后的副作用阶段

### 肉眼看到页面变化

说明：

- DOM 已经 commit
- 浏览器也已经把它画出来了

---

## 17. 最后压缩成 10 句

1. **`setState` 不是 render。**
2. **组件函数重新执行，才说明 render 真正走到这个组件。**
3. **render 不是“JS 闲时”才执行，而是 React 真正开始处理这批更新时执行。**
4. **render 是计算，commit 才是改 DOM。**
5. **render 已执行，DOM 仍是旧的，完全正常。**
6. **render 次数可以很多，commit 次数可以很少。**
7. **默认情况下，父组件 render，子组件也会被重新纳入 render 流程。**
8. **`React.memo` 在子组件真正执行前尝试 bailout。**
9. **`useMemo` / `useCallback` 的本质是稳定引用。**
10. **`useContext` 订阅的是整个 value，不是某个字段。**

---

## 18. 最短版总图

```text
用户事件 / root.render / context变化 / state变化
  ↓
创建 update / 标记依赖变化
  ↓
scheduleUpdateOnFiber
  ↓
React 开始 render
  ↓
beginWork
  ↓
renderWithHooks
  ↓
执行组件函数
  ↓
render 完成
  ↓
commitRoot
  ↓
真实 DOM 更新
  ↓
useLayoutEffect
  ↓
浏览器 paint
  ↓
useEffect
```
