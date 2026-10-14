## Babel 的工作流程

Babel 的核心过程可以简化为三步：

```text
源码字符串
  │
  ├─ parse：把源码解析为 AST
  ▼
原始 AST
  │
  ├─ transform：插件 visitor 遍历和修改 AST
  ▼
修改后的 AST
  │
  ├─ generate：重新生成代码，并按配置生成 source map
  ▼
输出代码
```

Babel Plugin 主要参与 transform 阶段。插件操作的是 AST，不直接编辑源码文本；源码中的空格、换行、引号和部分括号可能在 generate 阶段重新生成。

### AST 是什么

以下源码：

```js
const total = price + fee
```

可以近似表示为：

```text
VariableDeclaration
└─ declarations[0]: VariableDeclarator
   ├─ id: Identifier("total")
   └─ init: BinaryExpression("+")
      ├─ left: Identifier("price")
      └─ right: Identifier("fee")
```

AST 把“字符串形式的源码”转换成有类型、有层级的语法节点。插件通常通过节点类型定位目标，再创建、替换或删除节点。

## 四个核心对象

### AST Node

AST Node 是语法结构的数据对象。常见类型包括：

- `Identifier`：变量名、函数名等标识符；
- `StringLiteral`：字符串字面量；
- `CallExpression`：函数调用；
- `FunctionDeclaration`：函数声明；
- `ImportDeclaration`：import 声明；
- `JSXAttribute`：JSX 属性。

Node 主要保存 `type`、子节点和语法字段，不提供父节点、作用域和遍历上下文。

### NodePath

NodePath 是 Babel 对 Node 的包装。它通过 `path.node` 暴露当前 Node，同时提供：

- 父子路径访问；
- 节点类型判断；
- 子树遍历；
- 作用域查询；
- 节点替换、插入和删除；
- 跳过或停止遍历。

visitor 回调收到的是 NodePath，而不是裸 Node。

```js
const valueNode = attributePath.node.value
const valuePath = attributePath.get('value')
```

- `valueNode` 是数据对象，可以读取 `type`、`value` 等字段；
- `valuePath` 带上下文，可以继续调用 `isStringLiteral()`、`traverse()`、`replaceWith()` 或访问 `scope`。

### Scope

Scope 表示词法作用域。它负责维护：

- 当前作用域内有哪些绑定；
- 一个标识符引用指向哪个声明；
- 父子作用域关系；
- 如何生成不冲突的新标识符。

涉及变量名、函数名、引用替换或代码注入时，应使用 Scope API，而不是手工拼一个自认为不会冲突的名字。

### PluginPass

PluginPass 是一个源码文件的一次插件执行状态。`pre()` 中写入的 `this.xxx`，可以在 visitor 的第二个参数 `state.xxx` 中读取。

```js
module.exports = () => ({
  pre() {
    this.matchCount = 0
  },
  visitor: {
    Identifier(path, state) {
      state.matchCount += 1
    },
  },
})
```

PluginPass 按文件创建，适合保存当前文件的匹配次数、待注入节点、生成的标识符等状态。跨文件状态不要放在 PluginPass 中；模块级变量又会跨文件共享，使用时必须明确生命周期和并发风险。

## 最小插件结构

```js
module.exports = ({ types: t, template }, options = {}) => {
  return {
    name: 'example-plugin',
    pre() {
      // 每个文件开始遍历前执行
    },
    visitor: {
      Program: {
        enter(path, state) {
          // 进入模块根节点
        },
        exit(path, state) {
          // 模块所有后代处理完成后执行
        },
      },
      Identifier(path, state) {
        // 每遇到一个 Identifier 执行一次
      },
    },
    post() {
      // 每个文件转换结束后执行
    },
  }
}
```

### 插件工厂函数参数

Babel 调用插件工厂函数时，常用参数为：

| 参数 | 作用 |
| --- | --- |
| 第一个参数 `api` | Babel API 对象，常从中解构 `types`、`template` 等能力 |
| 第二个参数 `options` | Babel 配置中传给插件的选项 |
| 第三个参数 `dirname` | 当前配置上下文目录，只有确实需要解析相对路径时才使用 |

`types` 通常重命名为 `t`，这是 Babel 插件中的常见写法。

### 注册插件和传递选项

```js
module.exports = {
  plugins: [
    [require.resolve('./scripts/babelPlugins/example'), {
      functionName: '__debug__',
    }],
  ],
}
```

| 配置 / 调用 | 所属 | 作用 |
| --- | --- | --- |
| `require.resolve(pluginPath)` | Node.js | 解析插件模块的绝对路径 |
| `[pluginPath, options]` | Babel 配置 | 注册插件并传入选项 |
| `comments` | Babel generator 配置 | 控制输出阶段是否保留可保留的注释 |
| `compact` | Babel generator 配置 | 控制输出是否采用紧凑格式 |

`comments` 和 `compact` 影响 generate 阶段，不属于 visitor API。

## 单文件生命周期

对一个源码文件而言，常见顺序是：

```text
创建 PluginPass
  │
  ├─ pre()
  │    初始化文件级状态
  │
  ├─ Program.enter
  │    读取模块顶层结构
  │
  ├─ 访问 Program 的后代节点
  │    执行 Identifier / CallExpression / JSXAttribute 等 visitor
  │
  ├─ Program.exit
  │    根据最终状态决定是否注入或整理代码
  │
  ├─ post()
  │    执行文件级收尾
  │
  └─ generate 输出代码
```

需要区分：

- 插件工厂函数在 Babel 创建插件实例时执行；
- `pre()`、visitor、`post()` 针对每个文件执行；
- 多个插件的 visitor 可能在同一次 AST traversal 中交错执行，不能简单理解为“插件 A 完整执行后才执行插件 B”。

插件顺序会影响同一节点上 visitor 的执行结果。依赖其他插件输出时，必须通过真实转换验证顺序，不能只凭配置数组位置推断所有阶段的行为。

## Visitor API

### 按节点类型注册

```js
visitor: {
  CallExpression(path, state) {
    // 访问每一个函数调用
  },
  JSXAttribute(path, state) {
    // 访问每一个 JSX 属性
  },
}
```

visitor key 通常是具体 AST 节点类型。Babel 只会在遍历到该类型时调用对应函数。

### `enter` 与 `exit`

```js
BinaryExpression: {
  enter(path) {
    // 先访问当前节点，再访问子节点
  },
  exit(path) {
    // 子节点处理完成后再执行
  },
}
```

- `enter` 适合读取原始结构、初始化当前节点相关状态；
- `exit` 适合依赖子节点最终结果的处理；
- 只写 `BinaryExpression(path) {}` 等价于只声明 enter visitor。

### visitor 的 `path` 与 `state`

```js
Identifier(path, state) {
  const options = state.opts
  const currentNode = path.node
}
```

- `path` 是当前 NodePath；
- `state` 是当前文件的 PluginPass；
- `state.opts` 是插件选项；
- `state.file` 可访问 Babel 的文件级信息，但不要依赖未公开的内部字段。

## NodePath API

### API 总表

| API | 主要参数 | 结果 | 是否修改 AST | 用途 |
| --- | --- | --- | --- | --- |
| `path.get(key)` | 子字段名 | NodePath 或 NodePath 数组 | 否 | 取得子路径 |
| `path.isXxx(options?)` | 可选字段约束 | boolean | 否 | 判断节点类型和字段 |
| `path.findParent(callback)` | 父路径判断函数 | NodePath 或 null | 否 | 向上寻找符合条件的父节点 |
| `path.traverse(visitor, state?)` | 子树 visitor、可选状态 | 遍历后代 | visitor 可能修改 | 遍历当前节点的后代 |
| `path.skip()` | 无 | 跳过当前子树 | 否 | 不访问当前节点的后代 |
| `path.stop()` | 无 | 停止当前 traversal | 否 | 终止当前遍历 |
| `path.replaceWith(node)` | 新 Node | 当前节点被替换 | 是 | 替换当前节点 |
| `path.replaceWithMultiple(nodes)` | Node 数组 | 当前节点被多个节点替换 | 是 | 在允许的位置替换为多个节点 |
| `path.insertBefore(node)` | 新 Node | 当前节点前新增内容 | 是 | 在当前语句前插入 |
| `path.insertAfter(node)` | 新 Node | 当前节点后新增内容 | 是 | 在当前语句后插入 |
| `path.unshiftContainer(key, node)` | 容器字段、新 Node | 容器开头新增内容 | 是 | 插到数组容器开头 |
| `path.pushContainer(key, node)` | 容器字段、新 Node | 容器末尾新增内容 | 是 | 插到数组容器末尾 |
| `path.remove()` | 无 | 当前节点被删除 | 是 | 删除当前节点 |
| `path.scope` | 属性访问 | Scope | 否 | 取得当前词法作用域 |

修改类 API 的具体返回值可能随 API 和 Babel 版本变化；不需要返回值时不要依赖其内部结构。

### `path.node`

`path.node` 是当前 AST Node：

```js
const name = path.node.name
```

只修改当前节点的简单字段时，可以直接赋值：

```js
path.node.name = 'nextName'
```

替换整个节点时优先使用 `replaceWith()`，让 Babel 校验替换位置、更新当前路径并安排后续遍历。它不保证声明变化后自动重建已有的 Scope binding 表；重命名优先使用 `scope.rename()`，其他声明结构变更如果依赖最新 binding 信息，需要在合适层级显式 `scope.crawl()`，且不要在高频 visitor 中反复重建。

### `path.get(key)`

```js
const calleePath = callPath.get('callee')
const argumentPaths = callPath.get('arguments')
```

- 普通节点字段返回一个 NodePath；
- `arguments`、`body` 等列表字段返回 NodePath 数组；
- 使用 NodePath 后可以继续类型判断、遍历、替换和访问作用域。

### `path.isXxx(options?)`

```js
path.isIdentifier()
path.isIdentifier({ name: '__debug__' })
path.isCallExpression()
path.isFunctionDeclaration()
```

带 options 的类型判断可以同时校验字段，比手动比较 `path.node.type` 和多个字段更集中。

### `path.traverse(visitor, state?)`

从当前路径向下递归遍历后代：

```js
function containsAwait(path) {
  let found = false
  path.traverse({
    AwaitExpression(innerPath) {
      found = true
      innerPath.stop()
    },
  })
  return found
}
```

注意：

- `traverse` 会进入当前节点的后代，不会再次把当前路径当成第一个匹配节点；
- visitor 中替换出同类型节点时，要防止再次进入造成循环；
- 只需查找一次时，命中后及时停止遍历。

### `path.skip()` 与 `path.stop()`

- `skip()`：不再访问当前节点的后代，但 traversal 会继续处理其他分支；
- `stop()`：停止当前活跃的整次 traversal。

在嵌套 `path.traverse(...)` 中调用 `stop()`，停止的是该次嵌套遍历；在主 visitor 中调用则会影响主遍历。不要把 `stop()` 当成普通循环里的 `continue`。

### 替换、插入和删除

```js
path.replaceWith(t.identifier('replacement'))
path.insertBefore(t.expressionStatement(t.stringLiteral('before')))
path.insertAfter(t.expressionStatement(t.stringLiteral('after')))
path.remove()
```

约束：

- 新节点必须符合当前位置允许的语法类型；
- 表达式位置不能随意插入语句；
- 一个 Node 对象不要挂载到多个位置，需要复用时先 `cloneNode()`；
- 删除或替换声明后，要考虑引用和 Scope binding 是否仍然正确。

## Scope API

### 常用 API

| API | 作用 |
| --- | --- |
| `path.scope.getBinding(name)` | 查询当前可见的某个绑定及其引用 |
| `path.scope.hasBinding(name)` | 判断名称是否被 Scope 视为已占用；结果还可能来自 UID、全局名或上下文变量 |
| `path.scope.getProgramParent()` | 获取文件顶层 Scope |
| `scope.generateUidIdentifier(name)` | 生成不与现有绑定冲突的 Identifier |
| `scope.rename(oldName, newName?)` | 在绑定范围内安全重命名声明及引用 |
| `scope.push({ id, init })` | 向当前 Scope 注入变量声明 |

### 查询绑定

```js
const binding = path.scope.getBinding('value')

if (binding) {
  console.log(binding.path)
  console.log(binding.referencePaths)
}
```

Binding 常用信息包括声明路径、引用路径和是否为常量。它比按字符串全局搜索同名 Identifier 更可靠，因为不同作用域可以有同名变量。

`hasBinding(name)` 不等价于 `Boolean(getBinding(name))`。前者适合判断名称是否可安全使用，但可能因为 Babel 生成过的 UID、已知全局名或上下文变量返回 true；需要真实声明路径和引用信息时，应使用 `getBinding(name)`。

### 生成唯一名称

```js
const helperId = path.scope
  .getProgramParent()
  .generateUidIdentifier('helper')
```

结果通常类似 `_helper`，存在冲突时可能追加数字。不要假设生成后的名称固定，也不要用字符串拼接代替 Scope 冲突检查。

### 安全重命名

```js
path.scope.rename('oldName', 'newName')
```

`rename` 会在绑定范围内同步修改声明和引用。直接修改声明 Identifier 的 `name` 不会自动更新所有引用。

## `types` API

`types` 通常简写为 `t`，主要提供 validator、builder、clone 和 assert 能力。

### Validator

```js
t.isIdentifier(node)
t.isIdentifier(node, { name: 'target' })
t.isStringLiteral(node)
```

Validator 接收裸 Node，返回 boolean。已有 NodePath 时，通常优先使用对应的 `path.isXxx()`。

### Builder

```js
const object = t.identifier('console')
const property = t.identifier('debug')
const callee = t.memberExpression(object, property)
const call = t.callExpression(callee, [t.stringLiteral('message')])
```

Builder 返回新的 AST Node。参数顺序由该节点的字段定义决定；不确定时应查当前版本类型定义，不要猜测。

常用 Builder：

| API | 生成节点 | 节点说明 |
| --- | --- | --- |
| `t.identifier(name)` | Identifier | 标识符节点，表示变量名、函数名、参数名或属性名等名称，例如 `total`；它不是字符串字面量。 |
| `t.stringLiteral(value)` | StringLiteral | 字符串字面量节点，表示源码中的 `'hello'` 或 `"hello"`；重新生成代码时引号风格可由 generator 决定。 |
| `t.numericLiteral(value)` | NumericLiteral | 数字字面量节点，表示源码中的 `0`、`42` 或 `3.14`。 |
| `t.memberExpression(object, property)` | MemberExpression | 成员访问表达式，默认生成 `object.property`；需要 `object[property]` 时应将 `computed` 参数设为 `true`。 |
| `t.callExpression(callee, args)` | CallExpression | 调用表达式，表示 `callee(arg1, arg2)`；`callee` 是被调用表达式，`args` 是参数节点数组。 |
| `t.expressionStatement(expression)` | ExpressionStatement | 把表达式包装成完整语句，例如把 `CallExpression` 包成 `run();`，使其可以放入 `Program.body` 或 `BlockStatement.body`。 |
| `t.variableDeclarator(id, init)` | VariableDeclarator | 单个变量声明项，表示 `id = init` 部分；本身不包含 `const`、`let` 或 `var`。 |
| `t.variableDeclaration(kind, declarations)` | VariableDeclaration | 完整变量声明语句，`kind` 是 `const`、`let` 或 `var`，`declarations` 是一个或多个 `VariableDeclarator`。 |
| `t.functionDeclaration(id, params, body)` | FunctionDeclaration | 函数声明节点，表示 `function name(params) { ... }`；`id` 是函数名，`params` 是参数节点数组，`body` 必须是 `BlockStatement`。 |
| `t.blockStatement(body)` | BlockStatement | 代码块节点，表示 `{ ... }`；`body` 是语句节点数组，常用于函数体、条件分支和循环体。 |
| `t.jsxExpressionContainer(expression)` | JSXExpressionContainer | JSX 表达式容器，表示 JSX 中的 `{expression}`，用于把 JavaScript 表达式放入属性值或子节点位置。 |

### `t.cloneNode(node, deep?, withoutLoc?)`

```js
const copy = t.cloneNode(originalNode)
const deepCopy = t.cloneNode(originalNode, true)
const shallowCopy = t.cloneNode(originalNode, false)
```

- 默认 `deep = true`，会深克隆子树；
- 显式传 `true` 仍表示深克隆；
- 传 `false` 才是浅克隆；
- `withoutLoc` 用于控制是否移除位置信息，只有明确需要时才使用。

同一个 Node 对象不应同时挂载到 AST 的多个位置，否则后续路径维护和插件修改可能相互影响。

### Assert

```js
t.assertIdentifier(node)
```

Assert 在类型不匹配时抛错，适合“逻辑上必须是该类型”的内部不变量。外部输入或正常分支判断更适合 `isXxx()`，不要用异常代替普通控制流。

## `template` API

当需要创建完整函数、多条语句或复杂表达式时，手工组合大量 Builder 可读性较差。`template` 可以把接近源码的模板解析成 AST。

### 单条语句

```js
const buildLog = template.statement(`
  console.log(%%MESSAGE%%)
`)

const statement = buildLog({
  MESSAGE: t.stringLiteral('hello'),
})
```

### 多条语句

```js
const buildStatements = template.statements(`
  const %%ID%% = %%VALUE%%;
  console.log(%%ID%%);
`)
```

### 表达式

```js
const buildExpression = template.expression(`
  %%LEFT%% + %%RIGHT%%
`)
```

`%%NAME%%` 是 AST 占位符，不是 JavaScript 运行时插值。替换值必须是符合该语法位置要求的 Node。

选择建议：

- 结构小、节点类型明确：优先 `types` Builder；
- 结构大、接近一段完整源码：优先 `template`；
- 模板负责整体结构，`types` 负责创建或克隆占位符节点，两者可以组合使用。

## 通用示例：改写函数调用

目标：把指定的调试函数调用改写成 `console.debug`。示例只用于说明 API，不代表项目业务约定。

输入：

```js
__debug__('request started')
```

插件：

```js
module.exports = ({ types: t }, options = {}) => {
  const functionName = options.functionName || '__debug__'

  return {
    name: 'rewrite-debug-call',
    visitor: {
      CallExpression(path) {
        const calleePath = path.get('callee')
        if (!calleePath.isIdentifier({ name: functionName })) {
          return
        }

        calleePath.replaceWith(t.memberExpression(
          t.identifier('console'),
          t.identifier('debug'),
        ))
      },
    },
  }
}
```

输出：

```js
console.debug('request started')
```

执行过程：

1. `CallExpression` visitor 访问每个函数调用；
2. `path.get('callee')` 取得被调用对象的 NodePath；
3. `isIdentifier({ name })` 同时校验类型和名称；
4. `t.identifier()` 创建 `console` 和 `debug`；
5. `t.memberExpression()` 创建 `console.debug`；
6. `replaceWith()` 只替换 callee，原参数列表保持不变。

生产插件还需要考虑：原标识符是否存在本地绑定、是否允许可选调用、是否已经是目标结构，以及重复转换是否幂等。

## 插件状态与数据放置

### 闭包常量

插件选项经过归一化后，可以放在插件工厂函数闭包中：

```js
module.exports = (api, options = {}) => {
  const targetName = options.targetName || '__target__'
  return { visitor: {} }
}
```

### PluginPass

当前文件的可变状态放在 `pre()` 初始化：

```js
pre() {
  this.hasChanged = false
}
```

visitor 中通过 `state.hasChanged` 使用。

### 模块级变量

模块级变量会在同一个 Node 进程内跨文件共享。只适合明确需要的缓存或日志去重，并应考虑：

- watch 模式生命周期更长；
- 多次构建可能复用模块缓存；
- 状态是否需要按 Bundle、文件或配置隔离；
- 并行构建时是否安全。

业务转换状态通常不应放在模块级变量中。

## 幂等设计

构建链可能重复执行插件，watch 模式也可能多次处理同一模块。幂等插件应满足：

```text
transform(transform(source)) === transform(source)
```

这里的“相等”优先指 AST 语义和关键结构相等，不要求空格、引号等生成格式逐字符相同。

常见策略：

- 转换前识别目标结构是否已经存在；
- 注入 helper 时使用唯一名称，并查找已有声明；
- 避免用会被 generator 移除的注释作为唯一 marker；
- 不要让新生成的节点再次无条件命中同一个 visitor；
- 为普通输入、已转换输入和多次转换分别写断言。

幂等性必须结合实际插件定义。名称匹配、注释 marker 和结构匹配各有边界，文档和测试应明确保证范围。

## 最小验证

### 语法检查

```bash
node --check scripts/babelPlugins/example.js
```

这只能证明插件文件本身可被 Node 解析，不能证明转换逻辑正确。

### 使用 `transformSync`

```js
const babel = require('@babel/core')
const plugin = require('./scripts/babelPlugins/example')

const source = "__debug__('hello')"
const result = babel.transformSync(source, {
  // 同时关闭根配置和 .babelrc 搜索，隔离验证显式传入的插件。
  configFile: false,
  babelrc: false,
  plugins: [[plugin, { functionName: '__debug__' }]],
})

console.log(result.code)
```

| 配置 | 作用 |
| --- | --- |
| `babel.transformSync(source, options)` | 同步完成 parse、transform、generate |
| `configFile: false` | 不搜索根 `babel.config.*` |
| `babelrc: false` | 不搜索相对 `.babelrc*` 配置 |
| `plugins` | 显式注册被测插件和选项 |
| `parserOpts.plugins` | 输入包含 JSX、TypeScript 等语法时，启用对应 parser plugin |
| `generatorOpts` | 需要时控制输出格式，但不要把字符串格式当作唯一语义断言 |
| `result.code` | 生成后的代码字符串 |
| `result.ast` | 开启 `ast: true` 后返回的 AST |

至少覆盖：

1. 目标输入会转换；
2. 非目标输入保持语义不变；
3. 边界语法不会误转换；
4. 重复转换满足定义好的幂等范围；
5. 注入名称不会与用户代码冲突；
6. 与前后相邻插件组合时结果正确；
7. source map、注释和输出格式满足构建要求。

最小 `transformSync` 通过只能证明隔离转换；真实 Bundle 构建通过也只能证明构建链完成，不能替代运行时验证。

## 调试方法

### 查看节点类型

```js
console.log(path.node.type)
```

### 查看节点结构

```js
console.log(JSON.stringify(path.node, null, 2))
```

### 查看生成结果

调试时可以用 `@babel/generator` 或 NodePath 的字符串能力查看局部输出，但不要把调试字符串当作唯一 AST 结构断言。

AST 日志可能包含完整源码，且体积很大。调试日志不得长期保留在构建插件中，也不要输出敏感源码内容。

## 常见错误

### 混淆 Node 与 NodePath

错误：对裸 Node 调用 `traverse()`、`replaceWith()` 或访问 `scope`。

正确：需要上下文操作时使用 `path.get()` 得到 NodePath。

### 复用同一个 Node 对象

错误：把同一个 Node 实例插入多个 AST 位置。

正确：使用 `t.cloneNode()` 创建独立副本。

### 手工生成可能冲突的名称

错误：直接写死 `_helper`，假设用户代码不会声明同名变量。

正确：使用 `scope.generateUidIdentifier()`，并为重复转换设计识别策略。

### 替换后再次命中自身

如果 visitor 把节点替换为同类型节点，新节点可能再次进入当前 visitor，造成重复转换甚至死循环。可以通过结构判断、`skip()`、状态标记或更精确的匹配条件规避。

### 只验证输出字符串

生成器可能改变空格、引号和换行。只比较完整输出字符串容易产生脆弱测试；更稳妥的方式是结合 AST 结构、关键语义断言和必要的快照。

### 误判插件顺序

多个插件的 visitor 可能交错执行。若插件依赖另一个插件生成的结构，应做组合转换验证，并记录顺序依赖。

### 用异常掩盖未理解的 AST

不要通过宽泛 `try/catch` 静默跳过未知节点。先明确支持的语法范围，对不支持的输入选择不转换或抛出可定位错误。

## API 选型速查

| 需求 | 优先 API |
| --- | --- |
| 判断当前路径类型 | `path.isXxx()` |
| 判断裸 Node 类型 | `t.isXxx()` |
| 获取子路径 | `path.get()` |
| 查找后代节点 | `path.traverse()` |
| 查找父节点 | `path.findParent()` |
| 替换当前节点 | `path.replaceWith()` |
| 删除当前节点 | `path.remove()` |
| 在语句附近插入 | `insertBefore()` / `insertAfter()` |
| 向 body 等容器插入 | `unshiftContainer()` / `pushContainer()` |
| 生成唯一标识符 | `scope.generateUidIdentifier()` |
| 查询声明和引用 | `scope.getBinding()` |
| 创建少量明确节点 | `types` Builder |
| 创建大段源码结构 | `template` |
| 复制节点 | `t.cloneNode()` |
| 隔离验证插件 | `babel.transformSync()` + `configFile: false` + `babelrc: false` |
