# MachPro 和 React Native 对比

MachPro 和 React Native 都能用前端技术开发移动端页面，但它们解决的问题并不完全一样。

一句话概括：

- **MachPro 更偏业务动态化和多端统一**：适合在已有业务容器内快速交付标准化页面。
- **React Native 更偏跨平台 App 开发框架**：适合构建更完整、更接近原生能力的移动端应用。

## 一、核心定位差异

| 维度 | MachPro | React Native |
| --- | --- | --- |
| 核心目标 | 用统一 DSL/组件体系提升业务页面多端交付效率 | 用 React 模型构建 iOS/Android 原生应用 |
| 主要场景 | App 内业务页面、任务流、卡片、表单、列表、动态化页面 | 完整 App、复杂业务模块、强交互移动应用 |
| 运行依赖 | 通常依赖业务 App 容器、MachPro Runtime、团队组件体系 | 依赖 RN Runtime、原生工程、Native Modules、React Native 生态 |
| 端覆盖 | Native、H5、小程序等多端统一诉求更强 | 主要面向 iOS/Android，也可通过社区方案扩展到其他端 |
| 开发心智 | 像 React，但必须遵守 MachPro 组件和样式约束 | 更接近 React + 原生移动开发 |

## 二、架构链路差异

先从同一段 JSX 说起：

```tsx
function Card() {
  return (
    <View className="card">
      <Text className="title">待取货</Text>
    </View>
  )
}
```

这段代码运行后，第一步并不会直接生成屏幕上的 UI。JSX 会先变成一个普通的 JS 对象，也就是 React Element：

```ts
{
  type: View,
  props: {
    className: 'card',
    children: {
      type: Text,
      props: {
        className: 'title',
        children: '待取货'
      }
    }
  }
}
```

真正的差异发生在下一步：**这个 React Element 要交给谁渲染**。

### 2.1 React Web 怎么渲染

普通 React Web 的宿主环境是浏览器 DOM：

```tsx
function Card() {
  return (
    <div className="card">
      <span className="title">待取货</span>
    </div>
  )
}
```

大致链路是：

```text
React Element
  -> React DOM Renderer
  -> document.createElement('div')
  -> DOM 节点
  -> 浏览器 CSS / Layout / Paint
```

可以把它粗略理解成：

```ts
const div = document.createElement('div')
div.className = 'card'

const span = document.createElement('span')
span.className = 'title'
span.textContent = '待取货'

div.appendChild(span)
document.body.appendChild(div)
```

所以 React Web 能完整使用浏览器能力，是因为它最后落到的就是浏览器 DOM 和 CSS 引擎。

### 2.2 React Native 怎么渲染

React Native 的宿主环境不是 DOM，而是 iOS / Android 原生视图。

```tsx
import { View, Text } from 'react-native'

function Card() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>待取货</Text>
    </View>
  )
}
```

大致链路是：

```text
React Element
  -> React Native Renderer
  -> Fabric Shadow Tree
  -> Yoga 计算布局
  -> Native View
  -> iOS UIView / Android View
```

可以把它想象成 RN Renderer 在做类似这样的事：

```ts
createNativeView({
  type: 'RCTView',
  props: {
    style: {
      padding: 12,
      backgroundColor: '#ffffff',
    },
  },
  children: [
    {
      type: 'RCTText',
      props: {
        style: {
          fontSize: 16,
          color: '#222222',
        },
        text: '待取货',
      },
    },
  ],
})
```

最后原生侧会创建对应的真实原生控件：

```text
iOS: UIView + UILabel
Android: ViewGroup + TextView
```

所以 RN 的核心是：**React 负责描述 UI，React Native Renderer 负责把这棵 UI 树变成原生视图树**。

RN 新架构里的 Fabric、TurboModules、JSI 等机制，是在优化 JS 和 Native 之间的交互方式，让渲染、布局和原生模块调用更直接。但 RN 仍然主要面向 iOS / Android 原生应用，而不是 H5 / 小程序 / 多业务容器的统一页面协议。

### 2.3 MachPro 怎么渲染

MachPro 也用 JSX 写页面，但它的重点不是“把 React 组件直接变成 iOS/Android 原生控件”，而是先变成一套 MachPro 能理解的组件描述，再交给业务容器和不同端 Runtime 去解释。

```tsx
function Card() {
  return (
    <View className="card">
      <Text className="title">待取货</Text>
    </View>
  )
}
```

可以把 MachPro 中间层理解成类似这样的结构：

```ts
{
  component: 'View',
  className: 'card',
  style: {
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
  },
  children: [
    {
      component: 'Text',
      className: 'title',
      style: {
        fontSize: 16,
        color: '#222222',
      },
      text: '待取货',
    },
  ],
}
```

然后不同端会把这份描述映射成自己的 UI：

```text
MachPro 组件描述
  -> H5 Runtime      -> div / span / CSS
  -> Native Runtime  -> 业务容器里的 Native 组件
  -> 小程序 Runtime   -> view / text / 小程序样式
```

所以 MachPro 的链路更像：

```text
React Element
  -> MachPro 组件描述
  -> MachPro Runtime 解释组件和样式
  -> 业务容器提供端能力
  -> H5 / Native / 小程序分别渲染
```

关键差异是：MachPro 中间多了一层“跨端组件描述”。它不是只服务 iOS/Android，而是要尽量让同一份页面在多个端上可解释。

### 2.4 为什么这会导致能力差异

假设写一个样式：

```css
.card {
  position: fixed;
  z-index: 999;
  backdrop-filter: blur(10px);
}
```

在 React Web 中，这些属性会直接交给浏览器：

```text
CSS -> 浏览器 CSS 引擎
```

浏览器支持就能生效。

在 RN 中，这些属性必须能被 RN 样式系统和原生视图理解：

```text
JS style -> RN Style Processor -> iOS / Android View
```

RN 不支持完整 CSS，所以 `backdrop-filter` 这类 Web CSS 不能直接用。

在 MachPro 中，样式还要再经过多端映射：

```text
CSS class
  -> MachPro 样式解析
  -> H5 样式
  -> Native 样式
  -> 小程序样式
```

只要其中某些端不稳定，这个能力就不能当成通用能力。于是 MachPro 会更倾向支持最保守、最容易跨端一致的样式子集。

这就是为什么：

- React Web 的 CSS 最自由，因为目标就是浏览器。
- RN 的能力更靠近 iOS/Android 原生，因为目标是原生 App。
- MachPro 的约束更强，因为目标是多端业务页面的一致性。

### 2.5 一个点击事件的底层差异

再看点击事件：

```tsx
<Button onClick={submit}>提交</Button>
```

React Web 更像：

```text
浏览器 click 事件
  -> React SyntheticEvent
  -> submit()
```

RN 更像：

```text
iOS / Android 触摸事件
  -> RN 事件系统
  -> JS 回调
  -> submit()
```

MachPro 更像：

```text
H5 / Native / 小程序各端点击事件
  -> MachPro Runtime 统一成组件事件
  -> JS 回调
  -> submit()
```

所以 MachPro 的 `onClick` 看起来像 Web，但底层并不一定是浏览器 click。它可能来自 Native 点击事件，也可能来自小程序事件，再被 MachPro 统一成同一种业务事件。

### 2.6 用一句话重新理解这两条链路

MachPro：

```text
React 写法
  -> 生成跨端组件描述
  -> 由业务容器解释
  -> 尽量跑到 H5 / Native / 小程序等多个端
```

React Native：

```text
React 写法
  -> 生成 RN 原生视图树
  -> 由 iOS / Android 原生控件渲染
```

所以 MachPro 的关键词是 **跨端一致、业务容器、受限能力**；RN 的关键词是 **原生视图、移动应用、原生扩展能力**。

## 三、为什么 MachPro 业务效率更高

MachPro 的优势来自“业务场景被收敛”。

很多业务页面本质是：

```text
接口数据
  -> 状态判断
  -> 卡片 / 列表 / 表单展示
  -> 用户点击
  -> 提交接口
```

这类页面不需要大量原生能力，却经常需要快速调整。MachPro 用统一组件和业务容器能力封装掉端差异，前端可以快速完成：

- 新增字段
- 调整卡片样式
- 修改按钮状态
- 增加弹窗
- 接入埋点
- 调整业务流程

React Native 也可以做这些，但 RN 通常要面对更完整的 App 工程问题，例如原生依赖、Pod/Gradle、Native Module、App 架构、导航体系、包体积和原生发布流程。

## 四、为什么 RN 能力边界更宽

RN 更接近原生 App 开发。它可以：

- 编写或接入 Native Module
- 深度接入 iOS/Android 原生能力
- 使用更丰富的社区库
- 构建完整 App 架构
- 做更复杂的动画、手势、导航和原生交互

比如相机、音视频、地图、蓝牙、复杂手势、离线数据库等能力，RN 可以通过社区库或自定义 Native Module 接入。MachPro 如果业务容器没有提供对应能力，页面层通常无法自由扩展。

所以 RN 的能力边界更宽，但工程复杂度也更高。

## 五、样式和布局差异

MachPro 的样式能力通常是一个跨端子集。常见约束包括：

- `display` 支持范围有限，主要围绕 `flex` / `none`
- `position` 支持范围有限，通常围绕 `relative` / `absolute`
- `z-index`、`float`、`overflow-x/y` 等能力要谨慎
- `rgba`、三位 hex、部分 `border-image`、部分文本装饰能力存在兼容风险
- 图片、文本、测量、动画在 Android / iOS / H5 / 小程序上可能有差异

RN 的样式也不是完整 CSS，但它的目标端主要是 iOS/Android，样式模型更接近 React Native 自己定义的移动端样式系统。它同样以 Flexbox 为核心，但能力边界和调试方式更清晰地围绕原生移动端。

简单说：

| 维度 | MachPro | RN |
| --- | --- | --- |
| 样式目标 | 多端共同子集 | iOS/Android 原生样式模型 |
| CSS 自由度 | 更受业务容器和多端映射限制 | 不等于 Web CSS，但移动端能力更完整 |
| 风险点 | 多端差异、属性支持、组件限制 | 平台差异、原生样式实现、性能调优 |
| 推荐写法 | 保守 Flex 布局，少用边缘样式 | 使用 RN StyleSheet/Flexbox，结合平台能力 |

## 六、性能差异

两者都要关注 JS 线程、UI 渲染和列表性能，但问题来源不同。

MachPro 的性能风险常见于：

- 业务卡片层级过深
- 长列表没有使用合适列表组件
- 图片没有稳定尺寸
- 高频状态更新
- 样式触发端上重排或重绘
- 多端运行时映射成本

RN 的性能风险常见于：

- JS 线程执行过重
- 大组件树频繁 re-render
- 长列表 `FlatList` 配置不合理
- 开发模式性能误判
- JS 驱动动画卡顿
- 图片尺寸变化、透明合成、复杂原生视图导致 UI 线程压力

RN 官方性能文档明确强调移动端 60 FPS 对每帧时间预算很敏感，JS 线程卡顿会影响触摸响应和 JS 驱动动画，而部分滚动和原生动画可以在主线程上继续执行。

因此：

- **MachPro 的性能重点**：遵守组件和样式规范，减少跨端运行时里的高频更新。
- **RN 的性能重点**：控制 JS 线程负载，优化列表、动画、图片和原生视图成本。

## 七、生态和扩展能力差异

| 维度 | MachPro | RN |
| --- | --- | --- |
| 生态来源 | 团队内部组件库、业务容器能力、平台规范 | React Native 官方生态、社区库、Native Module |
| 扩展能力 | 依赖平台和容器开放能力 | 可通过原生代码扩展 |
| 上手成本 | 前端上手快，但框架规则隐藏较深 | 前端上手快，但需要理解移动端工程 |
| 维护成本 | 业务页面维护集中，端差异需按规范治理 | 工程自由度高，原生依赖和版本升级成本更高 |

MachPro 的生态更“内聚”，好处是规范统一、业务集成顺滑；坏处是能力边界取决于内部平台。

RN 的生态更“开放”，好处是社区丰富、原生扩展强；坏处是依赖质量、版本兼容、原生工程复杂度都需要团队自己承担。

## 八、调试差异

MachPro 的问题链路通常是：

```text
业务代码
  -> MachPro 组件
  -> MachPro Runtime
  -> 业务容器
  -> 多端渲染实现
```

RN 的问题链路通常是：

```text
React 代码
  -> RN Renderer
  -> Fabric / Native Modules
  -> iOS / Android 原生工程
```

MachPro 调试难点在于：问题可能是业务写法不符合规范，也可能是端上样式映射、组件封装、容器版本或多端差异。

RN 调试难点在于：问题可能跨 JS、Native、构建、依赖、线程、桥接/JSI、平台代码。它的链路更接近完整 App 工程。

## 九、适合场景

### MachPro 更适合

- App 内业务页面
- 多端展示一致的任务流、卡片流、详情页、表单页
- 高频业务迭代
- 对原生能力依赖不强
- 团队已有成熟 MachPro 组件和规范
- 需要依托业务容器做动态化发布

### RN 更适合

- 完整移动 App
- 复杂业务模块
- 对 iOS/Android 原生能力有较强诉求
- 复杂导航、手势、动画、设备能力接入
- 团队能承担原生工程和依赖治理
- 需要更大技术自由度和社区生态

## 十、不适合场景

### MachPro 不太适合

- 强原生能力页面
- 高性能复杂动画
- 地图、音视频、相机等重端能力页面
- 样式高度自由的视觉页面
- 大量依赖 Web DOM / Browser API 的页面

### RN 不太适合

- 只是 App 内少量标准业务卡片和列表
- 团队没有移动端工程维护能力
- 希望完全免原生工程复杂度
- 强依赖公司内部动态化容器和统一发布流程的页面

## 十一、代码心智对比

MachPro 写法更应该保守：

```tsx
<View className="card">
  <Text className="title">{title}</Text>
  <Text className="desc">{desc}</Text>
</View>
```

```css
.card {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background-color: #ffffff;
}

.title {
  font-size: 16px;
  color: #222222;
}
```

重点是：少用边缘 CSS，少堆复杂层级，优先使用平台组件。

RN 写法更接近移动端应用组件：

```tsx
import { View, Text, StyleSheet } from 'react-native'

export function Card({ title, desc }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{desc}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 16,
    color: '#222222',
  },
  desc: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  },
})
```

重点是：理解 RN 样式系统、组件生命周期、列表性能和原生能力接入。

## 十二、选型建议

如果需求主要是：

```text
业务数据展示 + 列表/卡片/表单 + 少量交互 + 多端统一 + 快速迭代
```

优先考虑 MachPro。

如果需求主要是：

```text
完整 App 能力 + 复杂交互 + 原生模块 + iOS/Android 深度能力 + 社区生态
```

优先考虑 React Native。

如果一个页面既要快速业务迭代，又有少量端能力，优先看公司业务容器是否已经封装了对应能力。封装充分时 MachPro 更省；封装不足时 RN 或原生会更稳。

## 十三、总结

MachPro 和 RN 的差异不是“谁更先进”，而是抽象层级不同：

- MachPro 用更强约束换业务效率、多端一致和动态化能力。
- RN 用更高工程复杂度换更强原生能力、更开放生态和更完整 App 开发能力。

最终选型可以落到一句话：

**标准业务页面选 MachPro，复杂移动应用选 RN；越靠近业务动态化，MachPro 越合适；越靠近原生能力和复杂交互，RN 越合适。**

## 参考

- [React Native Architecture Overview](https://reactnative.dev/architecture/overview)
- [React Native New Architecture](https://reactnative.dev/architecture/landing-page)
- [React Native Performance Overview](https://reactnative.dev/docs/performance)
