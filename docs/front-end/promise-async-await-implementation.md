# Promise 与 async/await 手写实现

这篇文章用简化代码拆解 `Promise`、`async`、`await` 的底层机制。重点不是完全复刻 ECMAScript 规范，而是把最核心的执行模型讲清楚。

先给结论：

- `Promise` 本质是一个状态机：`pending -> fulfilled/rejected`，状态一旦确定不可逆。
- `.then()` 本质是注册回调，并返回一个新的 Promise。
- `async/await` 可以理解成 `Generator + Promise 自动执行器` 的语法糖。
- `await` 后面的代码不会立刻执行，而是等 Promise 状态确定后再恢复执行。

## queueMicrotask 是什么

`queueMicrotask` 用来把一个函数放进微任务队列。

```js
queueMicrotask(() => {
  console.log('microtask')
})
```

它的执行时机是：当前同步代码执行完后尽快执行，并且早于 `setTimeout` 这类宏任务。

```js
console.log(1)

setTimeout(() => {
  console.log(2)
})

queueMicrotask(() => {
  console.log(3)
})

console.log(4)
```

输出：

```txt
1
4
3
2
```

原因可以简化理解成：

```text
同步代码
  -> 微任务队列
  -> 宏任务队列
```

原生 Promise 的 `.then()` 回调也是微任务。所以手写 Promise 时，常用 `queueMicrotask` 模拟原生 Promise 的异步回调时机。

也可以用下面这种方式粗略模拟微任务：

```js
const runMicrotask = fn => Promise.resolve().then(fn)
```

不过 `queueMicrotask(fn)` 语义更直白：把 `fn` 放进微任务队列。

## 手写 Promise

下面是一个简化版 Promise，实现了：

- `pending / fulfilled / rejected` 三种状态。
- `resolve / reject`。
- `.then()` 链式调用。
- `.catch()`。
- `Promise.resolve()` 和 `Promise.reject()`。
- thenable 解析。

```js
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

class MyPromise {
  constructor(executor) {
    // 当前 Promise 的状态，初始一定是 pending
    this.status = PENDING

    // fulfilled 后保存的成功值
    this.value = undefined

    // rejected 后保存的失败原因
    this.reason = undefined

    // 当状态还没确定时，then 注册的成功回调先存在这里
    this.onFulfilledCallbacks = []

    // 当状态还没确定时，then 注册的失败回调先存在这里
    this.onRejectedCallbacks = []

    const resolve = (value) => {
      // 状态一旦不是 pending，就不能再变
      if (this.status !== PENDING) return

      // 原生 Promise 的 then 回调是微任务
      // 所以这里用 queueMicrotask 模拟异步触发
      queueMicrotask(() => {
        if (this.status !== PENDING) return

        this.status = FULFILLED
        this.value = value

        // 状态确定后，执行之前收集的成功回调
        this.onFulfilledCallbacks.forEach(fn => fn())
      })
    }

    const reject = (reason) => {
      if (this.status !== PENDING) return

      queueMicrotask(() => {
        if (this.status !== PENDING) return

        this.status = REJECTED
        this.reason = reason

        // 状态确定后，执行之前收集的失败回调
        this.onRejectedCallbacks.forEach(fn => fn())
      })
    }

    try {
      // executor 会在 new Promise 时立刻同步执行
      executor(resolve, reject)
    } catch (error) {
      // 如果 executor 同步抛错，Promise 直接变成 rejected
      reject(error)
    }
  }

  then(onFulfilled, onRejected) {
    // then 的成功回调可选
    // 如果没传，就把成功值原样传给下一个 then
    onFulfilled =
      typeof onFulfilled === 'function'
        ? onFulfilled
        : value => value

    // then 的失败回调也可选
    // 如果没传，就把错误继续抛给后面的 catch
    onRejected =
      typeof onRejected === 'function'
        ? onRejected
        : reason => {
            throw reason
          }

    // then 必须返回一个新的 Promise
    // 这也是 Promise 能链式调用的关键
    const promise2 = new MyPromise((resolve, reject) => {
      const fulfilledTask = () => {
        try {
          // 执行当前 then 的成功回调
          const x = onFulfilled(this.value)

          // 根据回调返回值 x，决定 promise2 的状态
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      }

      const rejectedTask = () => {
        try {
          const x = onRejected(this.reason)
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      }

      if (this.status === FULFILLED) {
        // 如果当前 Promise 已经成功，then 回调仍然要异步执行
        queueMicrotask(fulfilledTask)
      } else if (this.status === REJECTED) {
        // 如果当前 Promise 已经失败，失败回调也异步执行
        queueMicrotask(rejectedTask)
      } else {
        // 如果当前 Promise 还没结束，就先保存回调
        this.onFulfilledCallbacks.push(fulfilledTask)
        this.onRejectedCallbacks.push(rejectedTask)
      }
    })

    return promise2
  }

  catch(onRejected) {
    return this.then(null, onRejected)
  }

  static resolve(value) {
    return new MyPromise(resolve => resolve(value))
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason))
  }
}

function resolvePromise(promise2, x, resolve, reject) {
  // 不能让一个 Promise 等待它自己，否则会死循环
  if (promise2 === x) {
    return reject(new TypeError('Chaining cycle detected'))
  }

  // 如果 then 回调返回的是 MyPromise
  // promise2 就跟随这个 MyPromise 的最终状态
  if (x instanceof MyPromise) {
    return x.then(resolve, reject)
  }

  // 如果 x 是对象或函数，它可能是 thenable
  // thenable 指的是带 then 方法的对象
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    let called = false

    try {
      const then = x.then

      if (typeof then === 'function') {
        // 按 Promise/A+ 的思路展开 thenable
        then.call(
          x,
          value => {
            if (called) return
            called = true
            resolvePromise(promise2, value, resolve, reject)
          },
          reason => {
            if (called) return
            called = true
            reject(reason)
          }
        )
      } else {
        // 普通对象直接作为成功值
        resolve(x)
      }
    } catch (error) {
      if (called) return
      called = true
      reject(error)
    }
  } else {
    // 普通值直接作为成功值
    resolve(x)
  }
}
```

## Promise 为什么可以链式调用

关键在这里：

```js
const promise2 = promise1.then(value => {
  return value + 1
})
```

`.then()` 返回的是一个新的 Promise，也就是 `promise2`。`promise2` 的状态由回调的返回值决定。

| then 回调返回值 | 新 Promise 的状态 |
| --- | --- |
| 普通值 | `fulfilled`，值就是这个普通值 |
| Promise | 跟随这个 Promise 的最终状态 |
| 抛出异常 | `rejected`，原因是这个异常 |
| thenable 对象 | 按它的 `then` 方法继续展开 |

所以这段代码能够一层一层传下去：

```js
new MyPromise(resolve => {
  resolve(1)
})
  .then(value => {
    console.log(value) // 1
    return value + 1
  })
  .then(value => {
    console.log(value) // 2
    return new MyPromise(resolve => {
      resolve(value + 1)
    })
  })
  .then(value => {
    console.log(value) // 3
  })
```

如果某一层抛错，错误会进入后续最近的失败回调：

```js
new MyPromise(resolve => {
  resolve(1)
})
  .then(() => {
    throw new Error('boom')
  })
  .catch(error => {
    console.log(error.message) // boom
  })
```

## async/await 是什么

`async/await` 不是新的异步能力。它是组织 Promise 链的一种更像同步代码的写法。

这段代码：

```js
async function main() {
  const a = await request(1)
  const b = await request(a + 1)
  return b
}
```

可以粗略理解为：

```js
request(1)
  .then(a => {
    return request(a + 1)
  })
  .then(b => {
    return b
  })
```

但更贴近底层的理解是：`async/await` 约等于 `Generator + Promise 自动执行器`。

## 用 Generator 模拟 async/await

先准备一个异步函数：

```js
function request(value) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(value)
    }, 1000)
  })
}
```

真实 `async/await` 写法：

```js
async function main() {
  const a = await request(1)
  const b = await request(a + 1)
  return b
}

main().then(console.log) // 2
```

可以改写成 Generator：

```js
function* mainGenerator() {
  // yield 后面放 Promise
  // 等 Promise 成功后，结果会被传回 a
  const a = yield request(1)

  // 第二个 yield 依赖第一个 yield 的结果
  const b = yield request(a + 1)

  return b
}
```

然后写一个自动执行器：

```js
function asyncToGenerator(generatorFn) {
  return function (...args) {
    // 执行 generator 函数，拿到迭代器
    const gen = generatorFn.apply(this, args)

    // async 函数一定返回 Promise
    return new Promise((resolve, reject) => {
      function step(method, arg) {
        let result

        try {
          // method 可能是 next，也可能是 throw
          // next 用于把 Promise 成功值传回 Generator
          // throw 用于把 Promise 失败原因抛回 Generator
          result = gen[method](arg)
        } catch (error) {
          reject(error)
          return
        }

        const { value, done } = result

        if (done) {
          // Generator 执行完，整体 Promise 成功
          resolve(value)
          return
        }

        // value 可能是 Promise，也可能是普通值
        // Promise.resolve 可以统一包一层
        Promise.resolve(value).then(
          data => step('next', data),
          error => step('throw', error)
        )
      }

      // 从第一个 yield 前开始执行
      step('next')
    })
  }
}
```

使用这个执行器：

```js
const main = asyncToGenerator(function* () {
  const a = yield request(1)
  const b = yield request(a + 1)
  return b
})

main().then(console.log) // 2
```

这个执行过程可以这样看：

```text
main()
  -> gen.next()
  -> 遇到 yield request(1)，暂停
  -> request(1) 成功，结果 1 传回 gen.next(1)
  -> a = 1，继续执行
  -> 遇到 yield request(a + 1)，再次暂停
  -> request(2) 成功，结果 2 传回 gen.next(2)
  -> b = 2，return b
  -> 外层 Promise resolve(2)
```

## async/await 的错误处理

`await` 后面的 Promise 如果 rejected，就像在当前位置抛了一个异常。

```js
async function main() {
  try {
    await Promise.reject(new Error('fail'))
  } catch (error) {
    console.log(error.message) // fail
  }
}
```

对应到 Generator 自动执行器里，就是这句：

```js
error => step('throw', error)
```

它会把错误重新抛回 Generator 内部，让内部的 `try/catch` 有机会捕获。

## 最后总结

`Promise` 解决的是：异步结果如何表达、如何转换、如何链式传递。

`async/await` 解决的是：如何用同步写法组织 Promise 链。

`queueMicrotask` 解决的是：如何把回调放进微任务队列，模拟原生 Promise `.then()` 的执行时机。

从执行模型看：

```text
Promise
  -> 状态机
  -> then 注册回调
  -> 微任务执行回调
  -> then 返回新 Promise

async/await
  -> async 函数返回 Promise
  -> await 暂停当前 async 函数
  -> Promise 完成后恢复执行
  -> 可以用 Generator + 自动执行器模拟
```
