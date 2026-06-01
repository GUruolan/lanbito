# 三、Hooks 原理

Hooks 最容易让人误解的，不是 API 名字，而是这几个问题：

- Hooks 到底是在什么时候被“执行”的？
- 为什么 Hook 不能写在条件分支里？
- 为什么 `useEffect` 会先 cleanup 再执行新的 effect？
- 为什么开发环境里 effect 像是多跑了一遍？
- 为什么改了 `ref.current`，组件却不 render？

这一章只做一件事：把 **Hooks 在 render 中的执行方式、effect 的登记与执行、ref / memo / context 的真正职责** 一次讲透。

---

## 1. 先给结论

### 1.1 Hooks 不是 render 之后再扫描出来的，而是组件执行时按顺序被处理的

当函数组件进入 render，React 内部更接近这样：

```text
beginWork
  ↓
updateFunctionComponent
  ↓
renderWithHooks
  ↓
执行你的组件函数
  ↓
在函数执行过程中，一个个处理 useState / useEffect / useRef ...
```

所以 Hook 并不是“组件函数跑完后再统一分析”的。

### 1.2 Hook 顺序必须稳定，因为 React 靠“位置”匹配 Hook 节点

React 并不会靠变量名识别：

- 这个是 `count`
- 那个是 `effect`

它更依赖的是：

> **当前这轮 render 的第 1 个 Hook，要对应上一轮 render 的第 1 个 Hook。**

这就是为什么 Hook 不能写在条件分支、循环、提前 return 的不稳定路径里。

### 1.3 `useEffect` 在 render 期间不会执行，只会先被登记

render 阶段做的只是：

- 收集 effect
- 记录依赖
- 标记这轮 commit 后要不要执行

真正执行是在 commit 之后的 passive effects 流程里。

---

## 2. Hooks 在 render 时到底怎么被执行

先看一个最小例子：

```jsx
function Demo({ id }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    console.log('effect', id)
  }, [id])

  return <button ref={ref} onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

当 `Demo` 进入 render 时，主链路可以近似看成：

```text
beginWork(...)
  ↓
updateFunctionComponent(...)
  ↓
renderWithHooks(...)
  ↓
Demo(props)
```

也就是说：

> **Hooks 是在 `renderWithHooks` 调用组件函数的过程中，一个个被处理的。**

### 一个非常简化的伪代码

```js
function renderWithHooks(current, workInProgress, Component, props) {
  currentlyRenderingFiber = workInProgress
  workInProgress.memoizedState = null

  const children = Component(props)

  return children
}
```

在组件函数执行过程中，每次遇到 Hook，React 都会沿着当前 Hook 链表位置前进。

示意图：

```text
fiber.memoizedState → hook1 → hook2 → hook3
                      state    ref      effect
```

### 一个页面现象：为什么 Hook 顺序一乱，整个组件就会报错

因为 React 靠的是调用顺序，不是变量名。

比如上一轮是：

1. `useState`
2. `useEffect`
3. `useRef`

下一轮如果变成：

1. `useState`
2. `useRef`
3. `useEffect`

那 React 就会把本来属于 effect 的节点错当成 ref 节点，整条链都对不上。

这就是为什么：

- Hook 不能写在条件里
- Hook 不能写在循环里
- Hook 不能放在不稳定的 return 路径后面

---

## 3. `useEffect`：登记和执行不是一回事

看最常见写法：

```js
useEffect(() => {
  const subscription = subscribe(id)

  return () => {
    subscription.unsubscribe()
  }
}, [id])
```

很多人容易把它理解成：“render 到这行时，effect 就开始执行了。”

其实不是。

### 更准确的分工

#### render 阶段

React 做的是：

- 记录这个 effect
- 记录依赖数组
- 判断这轮 commit 后需不需要执行它

#### commit 之后

React 才会去做：

- 旧 effect 的 cleanup
- 新 effect 的执行

### 一个页面现象：为什么组件已经 render 完了，effect 还没跑

因为 effect 本来就不属于 render 阶段。

更接近的顺序是：

```text
render
  ↓
commit DOM
  ↓
浏览器 paint
  ↓
useEffect
```

所以如果你看到：

- 组件顶部日志已经打印
- 页面 DOM 也变了
- effect 还没执行

这是完全正常的。

---

## 4. 一次 effect 执行 / cleanup 的源码关键链路

看一个最典型的例子：

```jsx
function Chat({ roomId }) {
  useEffect(() => {
    const conn = connect(roomId)
    return () => conn.close()
  }, [roomId])

  return null
}
```

当 `roomId` 首次挂载或后续变化时，主链路可以近似理解成：

```text
renderWithHooks
  ↓
mountEffect / updateEffect
  ↓
把 effect 挂到 fiber.updateQueue
  ↓
commitRoot
  ↓
flushPassiveEffects
  ↓
commitPassiveUnmountEffects
  ↓
commitPassiveMountEffects
  ↓
执行 cleanup / effect
```

### render 期间更接近发生了什么

```js
function mountEffect(create, deps) {
  const hook = mountWorkInProgressHook()
  hook.memoizedState = pushEffect(
    HookHasEffect | HookPassive,
    create,
    undefined,
    deps,
  )
}
```

也就是说，render 阶段做的是：

> **登记副作用，不是执行副作用。**

真正执行发生在 commit 之后的 passive effects 流程里：

```js
commitRoot(...)
  -> flushPassiveEffects()
  -> commitPassiveUnmountEffects(root.current)
  -> commitPassiveMountEffects(root, root.current)
```

---

## 5. 为什么依赖变更时一定是先 cleanup，再执行新的 effect

这是 `useEffect` 最值得建立稳定心智模型的一点。

假设从 `roomId = 1` 切到 `roomId = 2`，React 更接近下面这个顺序：

```text
render(roomId = 2)
  ↓
commit DOM
  ↓
cleanup(roomId = 1)
  ↓
effect(roomId = 2)
```

### 为什么一定要这样

因为 React 需要先把上一轮副作用清掉，再建立这一轮新的副作用。

否则很容易出现：

- 两份订阅同时存在
- 两个定时器都没清
- 两个不同参数的监听都挂着

### 一个页面现象：为什么看起来 effect 像“多执行了一次”

很多时候并不是多执行，而是：

- 旧的 cleanup 正在正常发生
- 新的 effect 正在正常建立

所以：

> **cleanup 先于新的 effect，是设计，不是 bug。**

---

## 6. StrictMode 为什么会让 effect 看起来多跑一遍

在开发环境开启 StrictMode 时，React 会故意更严格地检查副作用是否安全。

常见体感是：

```text
effect
  ↓
cleanup
  ↓
effect
```

### 根本原因

React 会在开发环境里故意模拟一次更严格的 mount / unmount / remount 检查，逼你暴露这些问题：

- cleanup 有没有写对
- 副作用是不是可重复建立
- render 里有没有偷偷塞副作用

所以更准确的理解是：

> **StrictMode 暴露的是副作用问题，不是在制造随机问题。**

---

## 7. `useRef`：为什么改了 `ref.current`，组件却没刷新

看最常见用法：

```js
const ref = useRef(initialValue)
```

`useRef` 的本质不是“一个会触发 render 的状态”，而是：

> **一个跨 render 持续存在的可变容器。**

### 两种典型用途

#### 访问 DOM

```jsx
const inputRef = useRef(null)
<input ref={inputRef} />
```

#### 保存不需要驱动视图的可变值

```js
const timerRef = useRef(null)
timerRef.current = setTimeout(...)
```

### 一个页面现象：为什么改了 `ref.current`，界面没刷新

因为 React 返回的是同一个 ref 对象：

- 重新渲染时继续返回它
- 你改的是对象上的 `current`
- React 不会因此给 Fiber 标记一次新更新

所以如果某个值会影响页面展示，它应该放在 state；如果它只是给事件回调、定时器、DOM 读取使用，ref 往往更合适。

---

## 8. `useMemo` / `useCallback` 真正保护的是什么

### `useMemo`

```js
const sortedList = useMemo(() => {
  return heavyCompute(list)
}, [list])
```

它更像是在说：

- 依赖没变时
- 复用上一次结果

### `useCallback`

```js
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])
```

它更像是在说：

- 依赖没变时
- 复用同一个函数引用

### 一个常见误区：用了就一定更快

并不一定。

因为它们自己也有成本：

- 要保存上一次依赖
- 每次 render 要比较依赖
- 代码可读性会下降

### 一个页面现象：为什么用了 `useCallback`，子组件还是 render

因为 `useCallback` 只能稳定函数引用，不能单独阻止子组件 render。

子组件仍然可能因为这些原因重新渲染：

- 父组件自己 render 了，子组件没 `React.memo`
- 其他 props 变了
- context 变了
- callback 依赖变了

所以它更像是：

> **帮 bailout 创造条件，而不是禁止渲染。**

---

## 9. `useContext`：为什么只用一个字段，还是会跟着一起 render

看最熟悉的写法：

```js
const ThemeContext = React.createContext('light')
const theme = useContext(ThemeContext)
```

很多人会以为：

```js
const { theme } = useContext(AppContext)
```

那我只用了 `theme`，`user` 变化时不该影响我。

但裸 `useContext` 订阅的是：

> **整个 context value**

不是字段级订阅。

### 一个页面现象：父组件没怎么变，为什么整片消费者都刷新了

因为如果 Provider 每次 render 都创建新对象：

```js
<UserContext.Provider value={{ user, setUser }}>
```

那这个 `value` 引用每次都变。对 React 来说，Context value 变了，消费者就该重新读取。

这也是为什么常见优化顺序通常是：

1. 先拆 context
2. 再稳定 Provider value 引用
3. 再考虑 selector / 外部 store

---

## 10. 自定义 Hook：复用的是逻辑，不是状态实例

自定义 Hook 是以 `use` 开头的函数，内部可以再调用其他 Hook。

例如：

```js
function useFetch(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setData(data)
      })
      .catch(err => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return { data, loading, error }
}
```

### 一个常见误区

“两个组件都用了同一个自定义 Hook，它们是不是共享状态？”

不是。

自定义 Hook 复用的是：

- 状态逻辑
- 副作用逻辑
- 组织方式

不是共享一份 Hook 节点。

每次调用它，最终都会回到当前组件自己的 Hook 链表上，形成独立实例。

---

## 11. 最后压缩成 10 句

1. **Hooks 是在 `renderWithHooks` 调用组件函数的过程中，一个个按顺序被处理的。**
2. **React 靠 Hook 调用顺序匹配节点，所以 Hook 不能写在条件分支和循环里。**
3. **`useEffect` 在 render 阶段只会被登记，不会当场执行。**
4. **真正的 effect 执行发生在 commit 之后的 passive effects 流程里。**
5. **依赖变化时先 cleanup 再执行新的 effect，是为了先清旧副作用再建新副作用。**
6. **开发环境里 effect 像多跑一遍，通常是 StrictMode 在帮你暴露问题。**
7. **`useRef` 保存的是稳定可变容器，改 `ref.current` 不会触发 render。**
8. **`useMemo` / `useCallback` 的本质是复用结果或引用，不是性能魔法。**
9. **`useContext` 订阅的是整个 value，不是 value 的某个字段。**
10. **自定义 Hook 复用的是逻辑，不是共享同一份状态实例。**
