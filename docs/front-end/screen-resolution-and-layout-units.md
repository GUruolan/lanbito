# 屏幕分辨率、像素密度与布局单位

## 基本概念

| 概念 | 含义 |
| --- | --- |
| `px` | 物理像素数量 |
| 分辨率 | 屏幕横向和纵向的物理像素数量，例如 `1179 x 2556 px` |
| `PPI` | 每英寸包含的物理像素数，描述屏幕的真实像素密度 |
| `dp` | Android 的布局单位 |
| `densityDpi` | Android 用于布局换算的逻辑密度 |
| `pt` | iOS 的布局单位 |
| `scale` | iOS 中 `pt` 到物理像素的换算倍率，通常为 `2x` 或 `3x` |

分辨率描述像素数量，不代表屏幕的物理长度。同样的分辨率可以出现在不同尺寸的屏幕上。

## PPI 的计算

```text
对角线像素数 = sqrt(横向 px^2 + 纵向 px^2)
PPI = 对角线像素数 / 屏幕对角线尺寸（英寸）
```

也可以根据单边计算：

```text
PPI = 横向 px / 屏幕物理宽度（英寸）
```

单个物理像素的实际长度为：

```text
1px = 1 / PPI 英寸
    = 25.4 / PPI 毫米
```

因此，`1px` 并不固定对应多少毫米。

## Android：dp、px 与 densityDpi

Android 使用 `dp` 作为布局单位：

`dp` 可以理解为一种理想化的、目标物理尺寸较稳定的布局单位。Android 希望相同的 `dp` 在不同设备上呈现大致相同的实际大小，但它不是毫米等严格固定的物理长度。理想状态下 `dp` = `1 / 160` 英寸，但实际设备的 `densityDpi` 不一定等于PPI。

```text
density = densityDpi / 160
px = dp * density
   = dp * densityDpi / 160
dp = px / density
```

例如，系统配置 `densityDpi = 320`：

```text
density = 320 / 160 = 2
100dp = 100 * 2 = 200px
```

`PPI` 和 `densityDpi` 的职责不同：

- `PPI` 是屏幕真实的硬件像素密度。
- `densityDpi` 是 Android 系统用于布局换算的逻辑密度。
- `densityDpi` 通常参考 `PPI` 配置，但不一定与它相等。

`1dp` 对应的实际长度为：

```text
1dp = densityDpi / (160 * PPI) 英寸
```

如果 `densityDpi = PPI`：

```text
1dp = 1 / 160 英寸
    = 0.15875mm
```

因此，只有当 `densityDpi` 等于真实 `PPI` 时，`dp` 才严格对应 `1 / 160` 英寸。实际设备的 `densityDpi` 可能经过系统分档、厂商配置或用户显示缩放调整，与真实 `PPI` 不一致，这会导致 `dp` 没有固定的物理宽度，只能让不同设备上的尺寸大致稳定。

## iOS：pt、px 与 scale

iOS 使用 `pt` 作为布局单位：

```text
px = pt * scale
pt = px / scale
```

常见换算关系：

```text
@2x：1pt = 2px
@3x：1pt = 3px
```

`1pt` 对应的实际长度为：

```text
1pt = scale / PPI 英寸
```

如果 `PPI = scale * 163`：

```text
1pt = 1 / 163 英寸
    = 0.156mm
```

例如，`326 PPI`、`@2x` 的屏幕满足：

```text
1pt = 2 / 326 英寸
    = 1 / 163 英寸
```

不同 iPhone 的 `PPI` 与 `scale` 组合不完全相同，因此 `1pt` 也不保证在所有设备上对应完全相同的毫米数。

## Android 与 iOS 对照

| Android | iOS |
| --- | --- |
| 布局单位：`dp` | 布局单位：`pt` |
| 换算倍率：`densityDpi / 160` | 换算倍率：`scale` |
| `px = dp * density` | `px = pt * scale` |
| 参考基准：`160 PPI` | 参考基准：约 `163 PPI` |

## 核心结论

- `px` 表示物理像素数量，其物理尺寸取决于 `PPI`。
- 分辨率描述像素数量，屏幕尺寸描述实际长度。
- Android 使用 `densityDpi` 决定一个 `dp` 对应多少 `px`。
- iOS 使用 `scale` 决定一个 `pt` 对应多少 `px`。
- `dp` 和 `pt` 的目标是让界面在不同设备上的视觉大小接近，而不是保证严格相同的毫米尺寸。
