# React 源码解析

这一组文档不是按 API 词典来写的，而是按一条真正能解释页面现象的主线来写：

- 组件为什么会执行
- DOM 为什么有时还没变
- `setState` 到底做了什么
- `useEffect` 为什么会先 cleanup 再执行
- 为什么输入能先跟手、结果却慢一点
- 为什么 `React.memo` 有时生效、有时完全挡不住

如果你之前总觉得 React 文档"概念很多，但一调试就还是懵"，这一组就是专门按 **现象 → 关键链路 → 源码心智模型** 来整理的。

---

## 推荐阅读顺序

### 第一遍：先建立主干心智模型

1. [零、render / commit / memo / context 总览](/react/00-render-commit-overview)
2. [一、渲染机制](/react/01-rendering)
3. [二、状态管理](/react/02-state)
4. [三、Hooks 原理](/react/03-hooks)

这一轮先解决最核心的几个问题：

- `setState` 什么时候只是入队，什么时候才真正 render
- render 和 commit 到底怎么分工
- state 为什么是快照，不是活变量
- Hooks 为什么必须按顺序调用

### 第二遍：把 React 运行过程补完整

5. [四、事件系统](/react/04-events)
6. [五、调度器](/react/05-scheduler)
7. [六、协调器](/react/06-reconciler)

这一轮重点看：

- React 事件为什么不是简单 DOM 直绑
- 为什么点击更像同步、滚动更像可让路
- render 为什么可以中断，commit 为什么不行
- `React.memo` 和 bailout 到底拦在哪里

### 第三遍：补齐边界与性能心智

8. [七、生命周期与错误处理](/react/07-lifecycle)
9. [八、性能优化](/react/08-performance)

这一轮重点看：

- render / commit / effect 在生命周期上怎么落位
- StrictMode 为什么像多执行一遍
- Error Boundary 为什么接不住事件和异步错误
- 性能问题到底该先怀疑 render、commit、layout/paint，还是业务长任务

---

## 每一章在解决什么问题

### [零、render / commit / memo / context 总览](/react/00-render-commit-overview)

先把最容易混在一起的几件事拆开：

- `setState`
- render
- commit
- DOM 更新
- `useEffect`
- `React.memo`
- context 广播

适合先建立全局地图。

### [一、渲染机制](/react/01-rendering)

重点解释：

- JSX 到底会变成什么
- React Element、Fiber、真实 DOM 在结构上有什么区别
- 首次挂载时页面是怎么从代码变成 DOM 的
- key 和 diff 真正解决的是什么

### [二、状态管理](/react/02-state)

重点解释：

- 为什么 `setState` 后立刻拿到的还是旧值
- 为什么多次更新会合并
- state 到底存在哪里
- render 真正是在什么时候执行的
- Lane 为什么会让输入先响应、结果后刷新

### [三、Hooks 原理](/react/03-hooks)

重点解释：

- Hooks 在 render 过程中是怎么一个个被处理的
- 为什么 Hook 顺序必须稳定
- `useEffect` 为什么只是先登记，commit 后才执行
- `useRef`、`useMemo`、`useCallback`、`useContext` 真正各自解决什么问题

### [四、事件系统](/react/04-events)

重点解释：

- SyntheticEvent 是什么
- 事件委托为什么不一定绑在按钮本身
- Portal 下为什么冒泡路径和 DOM 树不完全一样
- React 事件和原生事件混用时为什么顺序容易让人懵

### [五、调度器](/react/05-scheduler)

重点解释：

- 时间切片到底是什么
- render 为什么不是“JS 真空闲时才开始”
- 为什么有了并发和 Scheduler，页面还是可能卡
- MessageChannel 在这里扮演什么角色

### [六、协调器](/react/06-reconciler)

重点解释：

- render 阶段和 commit 阶段各自到底在做什么
- beginWork / completeWork 怎么串起来
- 为什么组件函数能执行多次，但 DOM 只改一次
- `React.memo`、bailout、Suspense 分别卡在哪个阶段

### [七、生命周期与错误处理](/react/07-lifecycle)

重点解释：

- 函数组件时代怎么理解“生命周期”
- `useEffect` / `useLayoutEffect` 对应哪些阶段
- StrictMode 为什么会暴露副作用问题
- Error Boundary 的边界到底在哪里

### [八、性能优化](/react/08-performance)

重点解释：

- 性能问题先分 render、commit、layout/paint、业务长任务四层
- `React.memo` / `useMemo` / `useCallback` 什么时候值得用
- 为什么状态下移、context 拆分、列表虚拟化通常更有效
- `useTransition` / `useDeferredValue` 优化的是体感，不是消灭工作量

---

## 如果你是带着问题来的，建议这样跳读

### 我就是想知道：render 到底什么时候执行

直接看：

- [零、render / commit / memo / context 总览](/react/00-render-commit-overview)
- [二、状态管理](/react/02-state)
- [六、协调器](/react/06-reconciler)

### 我总是被 `useEffect`、cleanup、StrictMode 搞晕

直接看：

- [三、Hooks 原理](/react/03-hooks)
- [七、生命周期与错误处理](/react/07-lifecycle)

### 我想搞清楚为什么 `React.memo` 不生效

直接看：

- [零、render / commit / memo / context 总览](/react/00-render-commit-overview)
- [六、协调器](/react/06-reconciler)
- [八、性能优化](/react/08-performance)

### 我更关心性能和页面卡顿

直接看：

- [五、调度器](/react/05-scheduler)
- [六、协调器](/react/06-reconciler)
- [八、性能优化](/react/08-performance)

---

## 一句话总图

可以先把整套 React 心智模型压缩成这一条：

```text
用户事件 / root.render / state变化 / context变化
  ↓
创建 update
  ↓
调度优先级
  ↓
render 阶段计算下一版 UI
  ↓
commit 阶段修改真实 DOM
  ↓
layout effect
  ↓
浏览器 paint
  ↓
passive effect
```

只要这条线不混，后面的现象大多都能解释通。
