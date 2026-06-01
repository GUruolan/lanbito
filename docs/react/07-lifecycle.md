# 七、生命周期与错误处理

这一章最容易误解的点不是“有哪些生命周期名词”，而是：

- 它们到底分别落在 **render** 还是 **commit** 哪一段？
- 为什么有些老生命周期在并发时代会出问题？
- 为什么 StrictMode 下看起来像“多执行了一遍”？
- Error Boundary 为什么能接住 render 错误，却接不住事件和异步错误？

如果把这些问题串起来，生命周期才会真正变清楚。

---

## 1. 先给结论

### 1.1 函数组件没有传统生命周期方法，但并不等于“没有生命周期阶段”

函数组件没有：

- `componentDidMount`
- `componentDidUpdate`
- `componentWillUnmount`

但它依然会经历：

- 挂载
- 更新
- 卸载

只是这些阶段主要通过：

- render 本身
- `useLayoutEffect`
- `useEffect`
- cleanup

来体现。

### 1.2 真正理解生命周期，关键不是背名字，而是搞清它们所处阶段

最核心的划分只有两个：

- **render 阶段**：可以重试、可以中断、不能安全放副作用
- **commit 阶段**：真正改 DOM、更新 ref、执行 layout 类生命周期

很多历史上的 API 之所以被废弃，本质都是因为它们落在 render 阶段，却经常被拿来做副作用。

---

## 2. 函数组件的“生命周期”应该怎么理解

先看最常见代码：

```js
useEffect(() => {
  // mount 后 / 依赖变化后执行
  return () => {
    // 卸载前 / 下一次 effect 前清理
  }
}, [dep])
```

很多人会简单把它记成：

- `[]` = `componentDidMount`
- `[dep]` = `componentDidUpdate`
- cleanup = `componentWillUnmount`

这个记法只适合入门，严格说并不完全准确。

因为 `useEffect` 并不是“挂载完立刻同步执行”，而是：

> **commit 完成、浏览器绘制后，再异步执行。**

所以更准确的理解是：

- render：先算新树
- commit：先改 DOM
- `useLayoutEffect`：commit 后、paint 前
- `useEffect`：paint 后

### 一个常见现象：为什么函数组件里没有 lifecycle 方法，但逻辑上还是有“挂载 / 更新 / 卸载”

因为“生命周期”本质上描述的是组件在 React 管理下经历的阶段，不是说必须长得像类组件 API。

函数组件只是把这些阶段拆进了：

- 组件函数执行（render）
- effect 建立
- effect cleanup

---

## 3. 类组件生命周期，真正要记的是它们落在哪一层

### 3.1 挂载阶段

```text
constructor
  ↓
static getDerivedStateFromProps
  ↓
render
  ↓
commit DOM
  ↓
componentDidMount
```

### 3.2 更新阶段

```text
static getDerivedStateFromProps
  ↓
shouldComponentUpdate
  ↓
render
  ↓
getSnapshotBeforeUpdate
  ↓
commit DOM
  ↓
componentDidUpdate
```

### 3.3 卸载阶段

```text
componentWillUnmount
```

### 最应该记住的点

- `render` 前面的逻辑，基本都更接近 **render 阶段判断**
- `componentDidMount` / `componentDidUpdate` 更接近 **commit 后逻辑**
- `getSnapshotBeforeUpdate` 卡在 **DOM 变更前、commit 期间的一个特殊窗口**

---

## 4. 为什么老生命周期会被废弃

被标记为不安全（UNSAFE_）的主要有：

- `componentWillMount`
- `componentWillReceiveProps`
- `componentWillUpdate`

原因不是“命名不好看”，而是它们所在位置太容易误导开发者去做不安全的事情。

### 根本原因

并发模式下，render 阶段：

- 可以重试
- 可以中断
- 可以丢弃
- 不保证只执行一次

如果你把副作用放在这些 will* 生命周期里，就可能出现：

- 请求发了两次
- 订阅绑了两次
- 外部状态写了两次
- 但最终页面只 commit 一次，甚至根本没 commit

所以本质上是：

> **render 阶段不适合承载不可重复的副作用。**

---

## 5. `getDerivedStateFromProps` 为什么容易被误用

它的典型写法是：

```js
static getDerivedStateFromProps(props, state) {
  if (props.userId !== state.prevUserId) {
    return {
      prevUserId: props.userId,
      data: null,
    }
  }
  return null
}
```

### 一个最容易误解的点

很多人以为它只在 props 变化时执行。其实不是。

它更接近：

> **每次 render 前都会参与这轮状态推导。**

所以：

- props 变化时它会跑
- 本组件自己的 state 更新导致 render 时，它也会跑

这就是为什么它非常容易把“props 派生 state”写得越来越难维护。

### 经验判断

如果你发现自己在 `getDerivedStateFromProps` 里做了很多“同步一份 props 到 state”的逻辑，通常说明数据流已经开始变绕了。

---

## 6. `getSnapshotBeforeUpdate` 到底卡在哪个瞬间

这是类组件生命周期里最容易背错位置的一个。

它发生在：

```text
render 已完成
↓
DOM 还没改
↓
getSnapshotBeforeUpdate
↓
DOM 修改
↓
componentDidUpdate(snapshot)
```

### 它适合干什么

最经典场景是：

- 你要在 DOM 更新前读一次旧布局 / 旧滚动位置
- 再在 `componentDidUpdate` 里根据这个快照做修正

所以它本质上是：

> **给 commit 前后的两端搭一座桥。**

### 一个页面现象：为什么有些滚动位置修正必须先 snapshot 再 didUpdate

因为你要的是“修改前的旧值”。如果等 DOM 改完再读，就已经晚了。

---

## 7. `componentDidMount` / `componentDidUpdate` 和 `useLayoutEffect` 的位置为什么很像

因为它们都更接近 **commit 后、paint 前后这一带的逻辑**。

粗略类比可以这么记：

- `componentDidMount` / `componentDidUpdate`：类组件版的“提交后逻辑”
- `useLayoutEffect`：函数组件里更靠近 commit 同步窗口
- `useEffect`：函数组件里更靠近绘制后的副作用窗口

但不要把它们机械地一一等同。真正该记的是：

> **它们都不属于 render 阶段。**

---

## 8. StrictMode 为什么会让你感觉“生命周期执行了两遍”

看最常见现象：

```text
render
render
layout effect
effect
cleanup
layout effect
effect
```

很多人第一反应是：

> React 出 bug 了？

其实不是。

### 根本原因

在开发环境里，`React.StrictMode` 会故意更严格地检查你的代码是否依赖“只执行一次”的侥幸行为。

尤其在 React 18 里，mount 阶段的 effect 会出现一种近似：

```text
mount
↓
unmount
↓
再 mount
```

它的目的不是折磨你，而是逼你发现：

- cleanup 有没有写对
- 副作用是不是可重复建立和销毁
- render 里有没有偷偷塞副作用

所以：

> **StrictMode 暴露的是问题，不是制造问题。**

---

## 9. Error Boundary 为什么能接住 render 错误，却接不住事件和异步错误

先看标准写法：

```js
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>
    }
    return this.props.children
  }
}
```

### 它能接住什么

最核心的是：

- render 期间抛出的错误
- 生命周期 / commit 相关阶段向上冒出的组件树错误

因为这些错误发生在 React 自己掌控的渲染流程里。

### 它接不住什么

- 事件处理函数里的错误
- `setTimeout` / Promise / 异步回调里的错误
- 服务端渲染错误
- 错误边界自身内部又抛的错误

### 根本原因

Error Boundary 的本质是：

> **React 在渲染子树时，给这棵树准备了一个“最近的出错兜底点”。**

但事件回调、异步任务这些场景，已经不在 React 当前这次“渲染子树”的受控调用栈里了。

所以它们不会自动走进 Error Boundary 这套恢复逻辑。

---

## 10. 一次 Error Boundary 生效的关键链路

可以粗略理解成：

```text
子组件 render 抛错
  ↓
React 捕获错误
  ↓
向上查找最近的 Error Boundary
  ↓
调用 getDerivedStateFromError
  ↓
边界组件下一轮 render 输出 fallback UI
  ↓
componentDidCatch 上报错误
```

### 一个页面现象：为什么出错后不是整站白屏，而是局部 fallback

因为边界只接管它包裹的那棵子树。

所以：

- 如果边界包得细，坏的是局部
- 如果边界包得粗，坏的是整块区域
- 如果根本没边界，可能直接把整棵 React 树打挂

---

## 11. 函数组件时代，应该怎么理解“生命周期思维”

真正有用的方式不是把类组件方法名强行翻译成 Hook，而是先问：

### 11.1 这段逻辑属于 render，还是属于副作用？

- 纯计算、纯返回 JSX：放 render
- 订阅、请求、DOM 测量、外部系统交互：放 effect / layout effect

### 11.2 这段副作用是必须在 paint 前完成，还是 paint 后也可以？

- 必须同步读写布局、避免闪烁：`useLayoutEffect`
- 请求、日志、订阅：`useEffect`

### 11.3 它是否能被正确 cleanup？

如果不能被干净地卸载和重建，StrictMode 迟早会帮你把问题打出来。

---

## 12. 调试生命周期问题时，最有效的排查顺序

### 12.1 先问：问题发生在 render，还是 commit 后

- 组件函数里就出问题：先看 render 逻辑
- DOM 已经改了再出问题：更像 commit / effect 问题

### 12.2 再问：是不是 StrictMode 暴露了副作用不纯

开发环境里“多跑一遍”时，优先别怀疑 React，先怀疑自己的副作用是否可重复建立 / 清理。

### 12.3 再问：错误是不是发生在 React 受控调用栈里

- render / 生命周期错误：Error Boundary 能接
- 事件 / 异步错误：得自己 try/catch 或独立上报

---

## 13. 最后压缩成 9 句

1. **函数组件没有传统生命周期方法，但仍然有挂载、更新、卸载阶段。**
2. **真正理解生命周期，关键是搞清它处在 render 还是 commit。**
3. **render 阶段可能重试、打断、丢弃，所以不适合放副作用。**
4. **老的 will* 生命周期被废弃，本质上是因为它们太容易在 render 阶段做副作用。**
5. **`getDerivedStateFromProps` 不是只在 props 变化时执行，而是每轮 render 前都可能参与状态推导。**
6. **`getSnapshotBeforeUpdate` 发生在 DOM 更新前，是读取旧快照的特殊窗口。**
7. **StrictMode 的“双执行”是在帮你暴露副作用和 cleanup 问题。**
8. **Error Boundary 主要处理 React 渲染树内的错误，不负责兜住事件和异步错误。**
9. **函数组件时代，最重要的不是背 lifecycle 名字，而是先判断逻辑属于 render 还是 effect。**
