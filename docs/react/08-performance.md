# 八、性能优化

React 性能问题最常见的误区，不是“不会用 memo”，而是：

- 看到页面卡，就以为一定是“render 太多”
- 看到组件多 render 几次，就以为一定有 bug
- 看到别人用了 `useMemo` / `useCallback`，就觉得自己也应该全加上

真正有效的优化，核心不是“多上缓存”，而是先搞清楚：

> **到底卡在 render、commit、浏览器 layout / paint，还是你自己的长任务。**

---

## 1. 先给结论

### 1.1 render 多，不一定慢；commit 重，往往更卡肉眼

render 是计算，commit 是落地。

- render 多：可能只是多算了几次
- commit 重：往往意味着大量真实 DOM 变更、布局、绘制

从用户体感看，真正“页面卡一下”的罪魁祸首，经常不是单纯 render 次数，而是：

- 大量 DOM 插入 / 删除
- 大列表布局
- 浏览器重排重绘
- 自己写的同步长任务

### 1.2 `React.memo` / `useMemo` / `useCallback` 都不是性能魔法

它们解决的是：

- 不必要的重复 render
- 不稳定引用导致的 bailout 失效

它们解决不了：

- 重 DOM 变更
- 重布局 / 重绘
- 网络慢
- 业务代码大循环 / 重计算 / JSON 解析

### 1.3 最有效的性能优化，通常不是“加缓存”，而是“缩小更新影响范围”

比如：

- 状态下移
- context 拆分
- 列表虚拟化
- 把高频变化隔离出去
- 让不相关子树不要被一起拖着 render

---

## 2. 性能问题先分成 4 类再看

### 2.1 render 太多

现象：

- 控制台里 `render` 打印很多次
- DevTools 里组件重算频繁

这类问题更适合看：

- `React.memo`
- `useMemo`
- `useCallback`
- context 拆分
- 状态下移

### 2.2 commit 太重

现象：

- 输入后明显卡顿
- 一次更新后页面“顿一下”
- 大片 DOM 一次性变化

这类问题更适合看：

- 减少 DOM 变更量
- 列表虚拟化
- 避免大块卸载/重建
- 稳定 key

### 2.3 浏览器布局 / 绘制太重

现象：

- React render 其实不夸张
- 但页面还是掉帧
- Chrome Performance 里 style / layout / paint 很重

这类问题更偏浏览器层：

- DOM 层级复杂
- 样式计算重
- 重排频繁
- 动画方式不合适

### 2.4 业务 JS 本身太重

现象：

- 点击后长时间主线程占满
- React 还没来得及 render 就卡住了

这类问题通常是：

- 大循环
- 大排序
- 大对象深拷贝
- JSON 解析
- 同步数据处理过重

---

## 3. 避免不必要的重渲染：先理解“默认传播”

React 默认行为是：

> **父组件 render，子组件也会被重新纳入 render 流程。**

所以看这段：

```jsx
const Child = React.memo(({ value, onClick }) => {
  return <button onClick={onClick}>{value}</button>
})
```

`React.memo` 的作用不是“让 DOM 不更新”，而是：

> **在子组件真正执行前，先比较 props，看看能不能直接 bailout。**

### 一个页面现象：父组件一改，子组件日志也一直打

这通常不是 bug，而是默认传播。

只有当：

- 子组件被 `React.memo` 包住
- props 还是浅比较相等

它才更有机会被跳过。

---

## 4. `React.memo` 到底什么时候值得用

值得用的场景通常是：

1. 子组件 render 本身不算特别便宜
2. 父组件会频繁 render
3. 子组件在很多次父 render 里，props 实际没变

比如：

```jsx
const Row = React.memo(function Row({ item, onSelect }) {
  return <div onClick={() => onSelect(item.id)}>{item.name}</div>
})
```

如果父组件每次输入都 render，但很多 `Row` 的 `item` 没变，那么 `React.memo` 就更容易带来收益。

### 不值得乱上的场景

- 子组件很轻
- props 每次几乎都在变
- 代码已经很绕了

因为 memo 自己也有比较成本，不是白送的。

---

## 5. 稳定引用：`useMemo` / `useCallback` 真正解决的是什么

### 5.1 `useCallback`

```jsx
const handleClick = useCallback(() => doSomething(id), [id])
```

它的本质不是“更快执行函数”，而是：

> **让函数引用在依赖不变时保持稳定。**

### 5.2 `useMemo`

```jsx
const config = useMemo(() => ({ theme: 'dark', size: 'large' }), [])
```

它的本质不是“自动加速一切”，而是：

> **让对象 / 计算结果在依赖不变时复用旧引用 / 旧结果。**

### 一个常见误区：它们是不是用了就一定更快

不是。

因为它们自己也有成本：

- 要记录依赖
- 每次 render 要比较依赖
- 代码可读性会下降

所以它们适合解决的是：

- 不稳定引用导致的 `React.memo` 失效
- 明显有开销的重复计算

而不是：

- 见函数就 `useCallback`
- 见对象就 `useMemo`

---

## 6. 状态下移：比 memo 更常见、也更有效的优化

看反例：

```jsx
function Parent() {
  const [value, setValue] = useState('')

  return (
    <>
      <input value={value} onChange={e => setValue(e.target.value)} />
      <ExpensiveComponent />
    </>
  )
}
```

这里输入一个字，`Parent` 就 render，一路把 `ExpensiveComponent` 也拖上了。

更好的办法通常不是先上各种 memo，而是先问：

> 这个 state 能不能下移到真正需要它的局部？

例如：

```jsx
function SearchInput() {
  const [value, setValue] = useState('')
  return <input value={value} onChange={e => setValue(e.target.value)} />
}

function Parent() {
  return (
    <>
      <SearchInput />
      <ExpensiveComponent />
    </>
  )
}
```

### 一个页面现象：为什么输入框一动，整页很多组件都跟着 render

大概率不是 React 太慢，而是状态放得太高，导致整片子树都被波及。

---

## 7. 内容提升（children as props）为什么也能省 render

看这个模式：

```jsx
function WithState({ children }) {
  const [count, setCount] = useState(0)
  return (
    <div onClick={() => setCount(c => c + 1)}>
      {children}
    </div>
  )
}
```

它的核心意义不是“语法优雅”，而是：

> **把不依赖局部 state 的那部分内容，从这轮 render 传播链里隔离出去。**

也就是说，这是一种缩小更新影响面的手段。

---

## 8. 列表优化：为什么它几乎总是性能重灾区

大列表最常见的问题，不只是“组件多”，而是：

- render 项太多
- commit DOM 太多
- 浏览器布局绘制太多

### 8.1 虚拟列表

```jsx
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={10000}
  itemSize={50}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>Row {index}</div>
  )}
</FixedSizeList>
```

它真正解决的不是“React 不会 render 了”，而是：

> **只让可视区域附近的项参与 render / commit / layout。**

### 8.2 稳定 key

如果 key 不稳定，例如用 index，列表重排时容易出现：

- 节点身份错乱
- 更多 DOM 重建
- 输入框串值
- state 对不上项

所以稳定 key 不只是“性能建议”，还关系到正确性。

---

## 9. 代码分割：为什么它优化的是“初次成本”，不是“单次 render 成本”

```jsx
const Dashboard = React.lazy(() => import('./Dashboard'))
```

这类优化解决的是：

- 首屏 JS 体积
- 路由切换前不必把所有代码都下载 / 解析 / 执行

它优化的主要不是：

- 当前页面一次 render 本身更快

所以别把“代码分割”理解成“render 优化”，它更偏：

> **加载路径优化**

---

## 10. `useTransition` / `useDeferredValue`：优化的是体感，不是把工作凭空消灭

### `useTransition`

```jsx
const [isPending, startTransition] = useTransition()

const handleSearch = (e) => {
  const value = e.target.value
  setInputValue(value)
  startTransition(() => {
    setSearchQuery(value)
  })
}
```

### `useDeferredValue`

```jsx
const deferredQuery = useDeferredValue(searchQuery)
```

它们的本质都是：

> **把一部分更新标成“可以稍后处理”，优先保证当前交互顺滑。**

### 一个页面现象：为什么输入框先跟手，搜索结果稍后刷新

因为：

- 输入框是更高优先级
- 列表结果可以晚一点 render / commit

这并不是工作变少了，而是：

> **顺序变了，用户体感更好了。**

所以这类 API 优化的是“响应性”，不是把重计算凭空抹掉。

---

## 11. context 为什么经常是性能放大器

如果你写：

```jsx
<AppContext.Provider value={{ user, theme, locale, cart }}>
```

那么：

- 这个对象只要整体引用变了
- 所有订阅这个 context 的 consumer 都可能重新 render

### 一个常见误区

很多人以为：

```jsx
const { theme } = useContext(AppContext)
```

只用了 `theme`，那 `user` 变时自己不该 render。

但裸 `useContext` 订阅的是整个 value，不是字段级订阅。

所以 context 优化的优先顺序通常是：

1. **先拆 context**
2. 再稳定 Provider value 引用
3. 再考虑 selector / 外部 store

---

## 12. 性能分析工具：不要凭感觉优化

### 12.1 React DevTools Profiler

它最适合回答：

- 哪些组件 render 了
- 每次 render 花了多久
- 为什么 render

### 12.2 why-did-you-render

```js
import whyDidYouRender from '@welldone-software/why-did-you-render'
whyDidYouRender(React, { trackAllPureComponents: true })
```

它适合回答：

- 为什么这个 memo / pure 组件还是 render 了
- 是哪个 props 引用变了

### 12.3 Chrome Performance

它最适合回答更底层的问题：

- 主线程是不是有长任务
- layout / paint 重不重
- 掉帧发生在 React 之前还是之后

### 一个很重要的经验

> **先测，再优化。**

因为“看起来像 React render 慢”的问题，最后很可能是：

- 你自己的同步逻辑太重
- 浏览器布局太重
- DOM 改太多

---

## 13. 最实用的优化顺序

如果你真的要排查一个 React 页面为什么卡，最推荐按这个顺序来：

### 第 1 步：先问是 render 多，还是 commit / layout 重

- 日志多、Profiler 多：先看 render 传播
- 肉眼卡顿明显、Performance 里 layout / paint 重：先看 DOM 量和浏览器成本

### 第 2 步：缩小更新影响范围

优先考虑：

- 状态下移
- context 拆分
- 局部化高频变化

### 第 3 步：再用 memo 稳定边界

- `React.memo`
- `useMemo`
- `useCallback`

### 第 4 步：如果是大列表，直接上虚拟化

### 第 5 步：如果是交互体感问题，再考虑 `useTransition` / `useDeferredValue`

---

## 14. 最后压缩成 10 句

1. **性能问题先分层：render、commit、layout/paint、业务长任务，不要一上来全怪 React。**
2. **render 多不一定卡，commit 重和浏览器布局重更容易直接影响体感。**
3. **`React.memo` 解决的是不必要的 render，不是所有性能问题。**
4. **`useMemo` / `useCallback` 的本质是稳定引用，不是性能魔法。**
5. **状态下移和缩小更新范围，通常比盲目加 memo 更有效。**
6. **列表性能问题，往往要靠虚拟列表解决，而不是只靠 memo。**
7. **代码分割优化的是加载路径，不是单次 render 本身。**
8. **`useTransition` / `useDeferredValue` 优化的是交互体感，不是把工作量消灭。**
9. **context 很容易放大 render 范围，优化时优先考虑拆分。**
10. **先测再改，Profiler 和 Chrome Performance 比直觉更可靠。**
