# 四、事件系统

React 事件系统最容易让人误解的地方有三个：

- 为什么我明明给按钮写了 `onClick`，React 却不是把监听器直接绑在这个按钮上？
- 为什么事件里的 `setState` 体感上经常像“更快、更同步”？
- 为什么 Portal、原生事件混用时，冒泡路径和我想的不一样？

这一章只做一件事：把 **合成事件、事件委托、事件优先级、冒泡路径** 一次讲透。

---

## 1. 先给结论

### 1.1 React 事件不是简单的 DOM 直绑

你写：

```jsx
<button onClick={handleClick}>Click</button>
```

不代表 React 就把 `handleClick` 直接 `addEventListener` 到这个按钮上。

更接近真实情况的是：

- React 在根容器上统一监听一批原生事件
- 原生事件发生后，React 根据事件目标反查对应 Fiber
- 再沿 Fiber / React 树收集回调
- 最后按 React 的捕获、冒泡规则依次执行

所以 React 事件系统更像：

> **统一接住原生事件，再在 React 内部自己分发一遍。**

### 1.2 事件里的 `setState` 之所以体感“更快”，不是因为事件本身特殊，而是因为它们通常拥有更高优先级

例如：

- `click`、`keydown` 这类离散事件，通常优先级更高
- `scroll`、`drag` 这类连续事件，优先级没那么激进

所以常见体感是：

- 点击后的更新更像“尽快处理”
- 滚动过程中触发的更新更可能被让路、被打断

### 1.3 合成事件的冒泡路径，和 React 树更相关，不一定完全等于 DOM 树

尤其是 Portal 场景下，这个差异最明显。

你肉眼看到的 DOM 层级，和 React 内部认定的组件父子关系，不一定一样。

---

## 2. 合成事件（SyntheticEvent）到底是什么

先看最常见代码：

```jsx
function Button() {
  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log(e.nativeEvent)
  }

  return <button onClick={handleClick}>Click</button>
}
```

这里的 `e` 不是原生 DOM `Event`，而是 React 提供的 **SyntheticEvent**。

它的作用可以粗略理解成两层：

1. **统一 API**：不同浏览器的事件细节不完全一致，React 给你包装出统一接口
2. **接入 React 调度系统**：React 能在事件分发时知道这是什么事件，从而决定更新优先级、批处理行为等

所以 SyntheticEvent 不是单纯“换个壳”，它是 React 事件系统的一部分。

### 一个页面现象：为什么我拿到的是 React 包装过的事件对象

因为 React 不是简单把原生事件直接透传给你，而是自己先接住事件，再在内部构造一层合成事件对象传给回调。

如果你要访问底层原生事件，才去读：

```js
e.nativeEvent
```

---

## 3. 事件委托：为什么监听器不一定绑在按钮本身

### 3.1 React 17 之前和之后的区别

- React 17 之前：大多数事件统一委托到 `document`
- React 17 之后：改成委托到 **根容器**

这意味着现在更接近：

```text
用户点击 button
  ↓
原生事件冒泡到 React root container
  ↓
React 在根容器的监听器接住它
  ↓
根据 target 找到对应 Fiber
  ↓
收集 onClickCapture / onClick
  ↓
按 React 规则依次执行
```

### 3.2 为什么要这么设计

主要有三点：

1. **减少监听器数量**：不用给每个节点都挂一份 DOM 监听器
2. **统一控制事件行为**：便于接入批处理、优先级、冒泡模拟
3. **多 React 根共存更自然**：React 17 以后挂在根容器，多个根之间边界更清晰

### 一个常见现象：DOM 上找不到你想象中的监听器

很多人用 DevTools 看按钮节点时，会疑惑：

> 我写了 `onClick`，为什么按钮上没看到一个一一对应的原生监听器？

原因正是事件委托：监听器往往挂在 React 根容器那层，按钮上的 `onClick` 更多是 Fiber 上记录的一段回调逻辑，而不是直接绑在 DOM 节点上的浏览器监听器。

---

## 4. 一次点击事件在 React 里的关键链路

如果你想抓住事件系统主干，最值得记的是这条链：

```text
原生事件触发
  ↓
根容器监听器接住事件
  ↓
找到 target 对应 Fiber
  ↓
收集捕获 / 冒泡阶段回调
  ↓
按顺序执行回调
  ↓
回调中的 setState 进入 React 调度
```

可以把它近似理解成：

```text
dispatchDiscreteEvent
  ↓
dispatchEvent
  ↓
extractEvents
  ↓
accumulateSinglePhaseListeners
  ↓
processDispatchQueue
  ↓
执行你的 onClick / onClickCapture
```

这里最关键的一点是：

> **事件分发和更新调度是连在一起的。**

React 知道当前是一次 `click`，就能顺便决定：这次更新该给什么优先级。

---

## 5. 事件优先级：为什么点击更“像同步”，滚动更“像可打断”

React 不会把所有事件一视同仁。

粗略理解可以看这张表：

| 事件类型 | 体感优先级 | 常见场景 |
|---------|-----------|---------|
| click、keydown | 更高 | 离散交互，用户希望立刻响应 |
| scroll、drag、mousemove | 中等 | 连续交互，允许让路 |
| message、一些普通异步来源 | 默认 | 普通更新 |

### 一个页面现象：为什么点击按钮后的更新常常“更快”

因为离散事件通常会让 React 倾向于更快处理这次更新。

所以它的体感经常是：

```text
点击
↓
事件回调结束
↓
很快开始 render
↓
commit
```

而不是拖很久再做。

### 一个页面现象：为什么滚动里做复杂更新更容易卡或被打断

因为连续事件本身频率高，React 更倾向于给浏览器和更高优先级工作让路。

这意味着：

- 你的更新可能被延后
- 也可能开始一部分后暂停
- 如果你在滚动回调里自己塞很重的同步 JS，React 也救不了

所以“事件优先级”解决的是调度顺序，不是替你消灭所有长任务。

---

## 6. 冒泡到底按谁走：DOM 树，还是 React 树？

### 6.1 普通情况下，它们大体一致

如果没有 Portal，React 树和 DOM 树层级通常比较接近，所以你会感觉合成事件冒泡和浏览器默认冒泡差不多。

### 6.2 Portal 场景下差异最明显

看例子：

```jsx
function Modal({ children }) {
  return ReactDOM.createPortal(
    <div>{children}</div>,
    document.body,
  )
}
```

DOM 上，这个节点已经被放到 `document.body` 下了。
但 React 视角里，它仍然属于原来那棵组件树。

所以 Portal 中的事件冒泡，常见体感是：

> **虽然 DOM 已经飞到别处了，但事件依然会沿 React 组件关系往上走。**

### 一个页面现象：明明 DOM 不在父节点下面，父组件的 `onClick` 还是触发了

这通常就是 Portal 导致的。

React 处理的是“组件树中的父子关系”，不是简单只看“DOM 树中的父子关系”。

---

## 7. `stopPropagation` 到底阻止的是哪一层

在 React 回调里写：

```js
e.stopPropagation()
```

最直接阻止的是 **React 合成事件这条分发链** 的继续冒泡。

但如果你同时还混用了原生事件，那么事情会复杂一点。

### 一个常见误区

很多人以为在 React 事件里 `stopPropagation()` 之后，所有原生监听器就都绝对收不到了。其实不一定，要看你混用的是哪一层监听、在哪个阶段触发。

所以更安全的理解是：

- `e.stopPropagation()`：优先影响 React 这层事件传播
- `e.nativeEvent...`：才是直接碰原生事件对象

如果你在处理很复杂的混用场景，才需要进一步碰原生事件 API。

---

## 8. React 事件和原生事件混用时，为什么顺序常常让人懵

看这个例子：

```jsx
useEffect(() => {
  document.addEventListener('click', nativeHandler)
  return () => document.removeEventListener('click', nativeHandler)
}, [])
```

同时组件里又写了：

```jsx
<button onClick={reactHandler}>Click</button>
```

这时你实际上同时拥有两套系统：

1. 浏览器原生事件系统
2. React 合成事件系统

于是执行顺序就不能再简单理解成“只有一次 click 冒泡”。

更接近真实情况的是：

- 原生事件先按浏览器规则传播
- React 在根容器监听到后，再做一轮自己的分发
- 你挂在 `document` 或某个 DOM 节点上的原生监听器，也会继续参与

### 一个页面现象：为什么我明明 stop 了，document 上的原生监听还是触发了 / 或者反过来

这通常不是 React 出 bug，而是因为你在同时操作两套传播链。

所以经验上：

> **能只用 React 事件，就尽量别混原生事件。**

只有在这些场景里，才值得直接上原生监听：

- 监听 React 不覆盖的低层事件
- 监听非 React 管理的 DOM
- 集成第三方库时必须对接原生事件

---

## 9. 事件系统和批处理的关系

事件系统之所以重要，不只是“帮你统一事件 API”，还因为它是 React 批处理的天然入口之一。

例如在 React 事件回调里：

```jsx
onClick={() => {
  setCount(c => c + 1)
  setFlag(f => !f)
}}
```

React 通常会把这些更新作为同一批工作来考虑，而不是每调一次 `setState` 就立刻各自完整 render/commit 一遍。

### 一个页面现象：为什么事件回调里写多个 setState，不一定看到多次 DOM 更新

因为这些 update 先被收集起来，再统一进入 render / commit 流程。

所以你经常看到的是：

```text
多个 setState
↓
一次 render（或少量 render）
↓
一次 commit
```

而不是：

```text
setState 一次
↓
改一次 DOM
↓
再 setState
↓
再改一次 DOM
```

---

## 10. 调试 React 事件问题时，最有效的排查顺序

以后遇到事件问题，按这四层排查最快：

### 10.1 先确认是不是 React 事件还是原生事件

- 回调参数是 SyntheticEvent 吗？
- 监听是写在 JSX 上，还是 `addEventListener` 上？

### 10.2 再确认传播路径

- 普通 DOM 树冒泡？
- 还是 Portal 下沿 React 树冒泡？

### 10.3 再确认是不是优先级 / 调度体感问题

- 为什么 click 更快？
- 为什么 scroll 里更像会延后？

### 10.4 最后确认是不是你自己的同步长任务把主线程堵住了

React 事件系统能做调度，但不能替你消灭 `while`、大循环、重排序、重 JSON 解析这类长任务。

---

## 11. 最后压缩成 8 句

1. **React 事件不是简单 DOM 直绑，而是根容器统一监听后内部再分发。**
2. **SyntheticEvent 是 React 包装出来的统一事件对象。**
3. **React 17 之后，事件委托的主要挂载点从 `document` 变成了根容器。**
4. **事件分发和更新调度是连在一起的，所以不同事件会有不同优先级体感。**
5. **click 这类离散事件通常更像“尽快处理”，scroll 这类连续事件更容易被让路。**
6. **Portal 场景下，事件传播更接近 React 树，而不只是 DOM 树。**
7. **合成事件和原生事件混用时，本质上是在同时操作两套传播系统。**
8. **事件系统不只是在管回调触发，也是在给 React 的批处理和调度提供入口。**
