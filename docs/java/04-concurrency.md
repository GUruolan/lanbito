# Java 并发编程完整篇

> 面向前端工程师的 Java 并发编程指南。这是 Java 学习中对前端工程师最陌生的部分，但也是 Java 最强大的特性之一。

## 1. 并发模型对比：Node.js vs Java

### Node.js：单线程事件循环

💡 **对比 JS**：Node.js 使用单线程 + 事件循环模型，所有代码运行在同一个线程中。

```
┌─────────────────────────────────────────┐
│           Node.js 进程                   │
│  ┌─────────────────────────────────┐    │
│  │         单线程（主线程）          │    │
│  │   Call Stack → Event Loop        │    │
│  │   setTimeout / Promise / I/O     │    │
│  └─────────────────────────────────┘    │
│  ┌───────────┐  ┌───────────────────┐   │
│  │ libuv     │  │ Worker Threads    │   │
│  │ I/O 线程池 │  │ (可选，CPU密集型)  │   │
│  └───────────┘  └───────────────────┘   │
└─────────────────────────────────────────┘
```

```javascript
// JS: 异步非阻塞，单线程
console.log('1');
setTimeout(() => console.log('2'), 0);
console.log('3');
// 输出: 1, 3, 2
// 永远不会有线程安全问题，因为同一时间只有一段代码在运行
```

### Java：多线程模型

```
┌─────────────────────────────────────────┐
│           JVM 进程                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 线程 1   │ │ 线程 2   │ │ 线程 3   │ │
│  │ (用户请求)│ │ (后台任务)│ │ (定时任务)│ │
│  └──────────┘ └──────────┘ └──────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │         共享堆内存                   │ │
│  │   对象、静态变量等（多线程可见）       │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

```java
// Java: 多线程真并行，多个线程同时执行
// 多核 CPU 上真正并行，不是 JS 的"并发"
System.out.println("主线程: " + Thread.currentThread().getName());
// 输出: 主线程: main
```

### 核心区别总结

| 特性 | Node.js | Java |
|------|---------|------|
| 线程模型 | 单线程 + 事件循环 | 多线程 |
| 并发方式 | 异步非阻塞 I/O | 真正并行执行 |
| 线程安全 | 无需担心（单线程） | 必须考虑 |
| CPU 密集型 | 弱（需 Worker Threads） | 强 |
| I/O 密集型 | 强（事件循环高效） | 强（线程池） |
| 内存隔离 | 每个请求独立 | 共享堆内存 |

---

## 2. 线程基础

### 2.1 创建线程的三种方式

#### 方式一：继承 Thread 类

```java
public class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("线程运行: " + Thread.currentThread().getName());
    }
}

// 使用
MyThread t = new MyThread();
t.start(); // 注意：要调用 start()，不是 run()！
```

⚠️ **注意**：调用 `run()` 只是普通方法调用，不会创建新线程！必须调用 `start()`。

#### 方式二：实现 Runnable 接口（推荐）

```java
// 传统写法
Runnable task = new Runnable() {
    @Override
    public void run() {
        System.out.println("Runnable 线程: " + Thread.currentThread().getName());
    }
};

// Lambda 写法（更简洁，类比 JS 的箭头函数）
Runnable task = () -> System.out.println("Lambda 线程: " + Thread.currentThread().getName());

Thread t = new Thread(task);
t.start();
```

💡 **对比 JS**：类似 `new Worker(() => { ... })`，但更底层。

#### 方式三：实现 Callable 接口（有返回值）

```java
import java.util.concurrent.Callable;
import java.util.concurrent.FutureTask;

// Callable 可以有返回值，可以抛出异常
Callable<String> callable = () -> {
    Thread.sleep(1000); // 模拟耗时操作
    return "计算结果";
};

FutureTask<String> future = new FutureTask<>(callable);
Thread t = new Thread(future);
t.start();

// 获取结果（会阻塞直到完成）
String result = future.get(); // 类似 await promise
System.out.println(result); // 输出: 计算结果
```

💡 **对比 JS**：`Callable` + `Future` 类似 JS 的 `Promise`，但是阻塞式的。

### 2.2 线程生命周期

```
           start()
NEW ──────────────────→ RUNNABLE
                         │    ↑
               获取CPU时间│    │等待CPU
                         ↓    │
                        RUNNING
                         │
              ┌──────────┼──────────┐
              │          │          │
         sleep/wait   synchronized  I/O操作
              │        锁竞争        │
              ↓          ↓          ↓
           WAITING    BLOCKED    WAITING
              │          │          │
          唤醒/超时   获得锁/中断   I/O完成
              └──────────┼──────────┘
                         ↓
                      RUNNABLE
                         │
                    run()结束
                         ↓
                     TERMINATED
```

```java
// 查看线程状态
Thread t = new Thread(() -> {
    try {
        Thread.sleep(2000);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});

System.out.println(t.getState()); // NEW
t.start();
System.out.println(t.getState()); // RUNNABLE 或 TIMED_WAITING
t.join(); // 等待线程结束
System.out.println(t.getState()); // TERMINATED
```

### 2.3 常用线程方法

```java
Thread t = new Thread(() -> { /* ... */ });

t.start();              // 启动线程
t.join();               // 等待线程完成（类似 await）
t.join(1000);           // 最多等待1000ms
t.interrupt();          // 请求中断线程
t.isAlive();            // 线程是否还在运行
t.getName();            // 获取线程名
t.setName("worker-1"); // 设置线程名（调试用）
t.setPriority(5);       // 设置优先级 1-10，默认5

// 静态方法
Thread.sleep(1000);                    // 当前线程睡眠1秒
Thread.currentThread().getName();      // 获取当前线程名
Thread.yield();                        // 让出CPU时间片
```

---

## 3. 线程池详解

### 3.1 为什么不要手动创建线程？

⚠️ **注意**：直接 `new Thread()` 的问题：
1. **创建开销大**：每次创建销毁线程都有系统开销
2. **无法限制数量**：大量请求时会创建数千线程，导致 OOM
3. **管理困难**：无法统一监控、调度

✅ **推荐**：始终使用线程池（`ExecutorService`）。

### 3.2 ExecutorService 基础用法

```java
import java.util.concurrent.*;

// 创建线程池（后面详解各类型）
ExecutorService executor = Executors.newFixedThreadPool(4);

// 提交任务（无返回值）
executor.execute(() -> System.out.println("任务1"));

// 提交任务（有返回值）
Future<String> future = executor.submit(() -> {
    Thread.sleep(1000);
    return "任务结果";
});

String result = future.get(); // 阻塞等待结果

// 关闭线程池（很重要！）
executor.shutdown();           // 等待所有任务完成后关闭
executor.shutdownNow();        // 立即关闭，尝试中断运行中的任务
```

### 3.3 四种常用线程池

#### ① Fixed Thread Pool（固定大小）

```java
// 固定4个线程，适合 CPU 密集型任务
ExecutorService executor = Executors.newFixedThreadPool(4);

// 推荐：CPU密集型任务，线程数 = CPU核心数 + 1
int cores = Runtime.getRuntime().availableProcessors();
ExecutorService cpuExecutor = Executors.newFixedThreadPool(cores + 1);
```

#### ② Cached Thread Pool（动态大小）

```java
// 线程数动态增长，60秒空闲后回收
// 适合短时间大量 I/O 密集型任务
ExecutorService executor = Executors.newCachedThreadPool();

// ⚠️ 注意：高并发下可能创建大量线程导致 OOM
```

#### ③ Single Thread Executor（单线程）

```java
// 只有1个线程，任务顺序执行，保证顺序性
ExecutorService executor = Executors.newSingleThreadExecutor();
```

#### ④ Scheduled Thread Pool（定时任务）

```java
// 支持定时和周期性任务
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

// 延迟5秒执行（类似 JS 的 setTimeout）
scheduler.schedule(() -> System.out.println("延迟执行"), 5, TimeUnit.SECONDS);

// 每3秒执行一次（类似 JS 的 setInterval）
scheduler.scheduleAtFixedRate(
    () -> System.out.println("周期执行"),
    0,      // 初始延迟
    3,      // 间隔
    TimeUnit.SECONDS
);
```

### 3.4 自定义线程池（生产推荐）

⚠️ **注意**：`Executors` 工厂方法有风险（队列可能无界），生产环境推荐自定义：

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    4,                                  // corePoolSize: 核心线程数
    8,                                  // maximumPoolSize: 最大线程数
    60,                                 // keepAliveTime: 空闲线程存活时间
    TimeUnit.SECONDS,                   // 时间单位
    new LinkedBlockingQueue<>(1000),    // 任务队列（有界！）
    new ThreadFactory() {               // 线程工厂（自定义线程名）
        private int count = 0;
        @Override
        public Thread newThread(Runnable r) {
            return new Thread(r, "my-pool-" + count++);
        }
    },
    new ThreadPoolExecutor.CallerRunsPolicy() // 拒绝策略
);
```

**拒绝策略**：
- `AbortPolicy`：抛出异常（默认）
- `CallerRunsPolicy`：由调用者线程执行
- `DiscardPolicy`：静默丢弃
- `DiscardOldestPolicy`：丢弃最旧的任务

---

## 4. synchronized 关键字

### 4.1 为什么需要同步？

```java
// ⚠️ 线程不安全的计数器
public class Counter {
    private int count = 0;
    
    public void increment() {
        count++; // 看起来是一行，实际是3步：读取、加1、写入
                 // 多线程下可能同时读到同一个值，导致计数错误
    }
}
```

💡 **对比 JS**：JS 单线程不存在这个问题，但 Java 多线程必须考虑。

### 4.2 三种锁的粒度

#### 方法锁（对象级别）

```java
public class Counter {
    private int count = 0;
    
    // 锁住当前对象实例（this）
    public synchronized void increment() {
        count++;
    }
    
    public synchronized int getCount() {
        return count;
    }
}

Counter c = new Counter();
// 同一个 c 对象，同时只能有一个线程执行 increment 或 getCount
```

#### 对象锁（同步代码块）

```java
public class Counter {
    private int count = 0;
    private final Object lock = new Object(); // 专用锁对象
    
    public void increment() {
        // 只锁住必要的代码段，粒度更细，性能更好
        synchronized (lock) {
            count++;
        }
        // 这里的代码不需要锁，可以并发执行
    }
}
```

#### 类锁（静态方法/类对象）

```java
public class Counter {
    private static int instanceCount = 0;
    
    // 锁住 Counter.class 对象（类级别）
    // 所有 Counter 实例共享同一把锁
    public static synchronized void incrementInstance() {
        instanceCount++;
    }
    
    // 等价写法
    public static void incrementInstance2() {
        synchronized (Counter.class) {
            instanceCount++;
        }
    }
}
```

### 4.3 死锁示例与避免

```java
// ⚠️ 典型死锁：两个线程互相等待对方释放锁
public class DeadlockDemo {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();
    
    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            synchronized (lockA) {
                System.out.println("T1 获得 lockA");
                try { Thread.sleep(100); } catch (Exception e) {}
                synchronized (lockB) { // 等待 T2 释放 lockB
                    System.out.println("T1 获得 lockB");
                }
            }
        });
        
        Thread t2 = new Thread(() -> {
            synchronized (lockB) {
                System.out.println("T2 获得 lockB");
                try { Thread.sleep(100); } catch (Exception e) {}
                synchronized (lockA) { // 等待 T1 释放 lockA → 死锁！
                    System.out.println("T2 获得 lockA");
                }
            }
        });
        
        t1.start();
        t2.start();
    }
}
```

✅ **推荐**：避免死锁的方法：
1. **固定锁的获取顺序**：始终先获取 lockA，再获取 lockB
2. **使用 tryLock**（ReentrantLock）：获取失败就放弃，不死等
3. **减少锁的嵌套**：尽量不要在持有锁的情况下再获取另一把锁

---

## 5. volatile 关键字

### 5.1 可见性问题

```
CPU 架构：
┌──────────────────────────────────────────┐
│  核心1              核心2                 │
│  ┌──────────┐      ┌──────────┐          │
│  │ L1 Cache │      │ L1 Cache │          │
│  │ flag=true│      │ flag=false│ ← 旧值！ │
│  └──────────┘      └──────────┘          │
│         ↕                  ↕             │
│  ┌────────────────────────────────────┐  │
│  │           主内存                    │  │
│  │           flag=true                │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

```java
// ⚠️ 没有 volatile 可能出现的问题
public class VisibilityDemo {
    private static boolean flag = false; // 没有 volatile
    
    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(() -> {
            while (!flag) { // 可能永远读到缓存中的 false，死循环！
                // 循环等待
            }
            System.out.println("flag 变了！");
        });
        
        t1.start();
        Thread.sleep(100);
        flag = true; // 主线程修改，但 t1 可能看不到
    }
}

// ✅ 修复：加 volatile
private static volatile boolean flag = false;
// volatile 保证：对 flag 的写操作立即刷新到主内存，读操作直接从主内存读
```

💡 **对比 JS**：JS 单线程，不存在可见性问题。这是多核 CPU + 多线程特有的问题。

### 5.2 volatile 的限制

⚠️ **注意**：`volatile` 只保证可见性，**不保证原子性**！

```java
private static volatile int count = 0;

// ⚠️ 即使有 volatile，count++ 也不是线程安全的！
// count++ = 读取 + 加1 + 写入，是3个操作
// 两个线程可能同时读到同一个值
public void increment() {
    count++; // 不安全！
}

// ✅ 需要原子操作时，用 AtomicInteger（见第7节）
```

---

## 6. Lock 接口

### 6.1 ReentrantLock vs synchronized

```java
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class Counter {
    private int count = 0;
    private final Lock lock = new ReentrantLock();
    
    public void increment() {
        lock.lock(); // 获取锁
        try {
            count++;
        } finally {
            lock.unlock(); // 必须在 finally 中释放！
        }
    }
}
```

### 6.2 ReentrantLock 的高级特性

```java
Lock lock = new ReentrantLock();

// 1. tryLock：尝试获取锁，失败立即返回（不死等）
if (lock.tryLock()) {
    try {
        // 执行任务
    } finally {
        lock.unlock();
    }
} else {
    System.out.println("获取锁失败，做其他事情");
}

// 2. tryLock with timeout：等待指定时间
if (lock.tryLock(5, TimeUnit.SECONDS)) {
    try {
        // 执行任务
    } finally {
        lock.unlock();
    }
}

// 3. lockInterruptibly：可被中断的锁等待
try {
    lock.lockInterruptibly(); // 等待期间可被 interrupt() 中断
    try {
        // 执行任务
    } finally {
        lock.unlock();
    }
} catch (InterruptedException e) {
    System.out.println("等待锁时被中断");
}
```

### 6.3 读写锁（ReadWriteLock）

```java
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

// 读多写少的场景：多个读可以并发，写独占
public class Cache {
    private final Map<String, String> data = new HashMap<>();
    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Lock readLock = rwLock.readLock();
    private final Lock writeLock = rwLock.writeLock();
    
    public String get(String key) {
        readLock.lock(); // 多个线程可以同时读
        try {
            return data.get(key);
        } finally {
            readLock.unlock();
        }
    }
    
    public void put(String key, String value) {
        writeLock.lock(); // 写时独占
        try {
            data.put(key, value);
        } finally {
            writeLock.unlock();
        }
    }
}
```

### 6.4 何时用 ReentrantLock vs synchronized？

| 场景 | 推荐 |
|------|------|
| 简单同步，代码简洁优先 | `synchronized` |
| 需要 tryLock（避免死锁） | `ReentrantLock` |
| 需要超时等待 | `ReentrantLock` |
| 需要可中断的锁等待 | `ReentrantLock` |
| 读多写少 | `ReadWriteLock` |
| 公平锁（先来先服务） | `new ReentrantLock(true)` |

---

## 7. Atomic 原子类

### 7.1 AtomicInteger

```java
import java.util.concurrent.atomic.AtomicInteger;

// 线程安全的整数操作，不需要锁
AtomicInteger counter = new AtomicInteger(0);

counter.incrementAndGet();  // 原子 ++，返回新值（类似 ++i）
counter.getAndIncrement();  // 原子 ++，返回旧值（类似 i++）
counter.decrementAndGet();  // 原子 --
counter.addAndGet(5);       // 原子加5
counter.get();              // 读取当前值

// 比较并交换（CAS）
boolean success = counter.compareAndSet(5, 10); 
// 如果当前值是5，就改为10，返回true；否则不改，返回false
```

### 7.2 AtomicReference

```java
import java.util.concurrent.atomic.AtomicReference;

// 原子地操作对象引用
AtomicReference<String> ref = new AtomicReference<>("初始值");

// 原子 CAS 操作
ref.compareAndSet("初始值", "新值"); // 成功
ref.compareAndSet("初始值", "另一个值"); // 失败（当前值已是"新值"）

ref.get();        // 获取当前值
ref.set("值");    // 设置新值（不是 CAS）
ref.getAndSet("值"); // 获取旧值并设置新值
```

### 7.3 CAS 原理简介

```
CAS (Compare And Swap) = 无锁并发的核心

伪代码：
    boolean CAS(内存地址, 期望值, 新值) {
        if (内存地址的当前值 == 期望值) {
            内存地址的值 = 新值;
            return true;
        }
        return false;
    }

这是 CPU 的原子指令（x86: CMPXCHG），硬件保证原子性。

ABA 问题：
    值从 A → B → A，CAS 以为没变化，实际已经变过了。
    解决：AtomicStampedReference（带版本号）
```

```java
import java.util.concurrent.atomic.AtomicStampedReference;

// 带版本号，解决 ABA 问题
AtomicStampedReference<String> ref = new AtomicStampedReference<>("A", 0);

int[] stampHolder = new int[1];
String value = ref.get(stampHolder); // 获取值和版本号
int stamp = stampHolder[0];

ref.compareAndSet("A", "B", stamp, stamp + 1); // 版本号也要匹配
```

---

## 8. CompletableFuture 完整教程

💡 **对比 JS**：`CompletableFuture` 是 Java 的 `Promise`，功能更强大。

### 8.1 创建 CompletableFuture

```java
import java.util.concurrent.CompletableFuture;

// supplyAsync: 异步执行，有返回值（类似 new Promise(resolve => ...)）
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    // 在 ForkJoinPool.commonPool() 中异步执行
    Thread.sleep(1000); // 模拟耗时
    return "结果";
});

// 指定自定义线程池
ExecutorService executor = Executors.newFixedThreadPool(4);
CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> "结果", executor);

// runAsync: 异步执行，无返回值（类似 Promise<void>）
CompletableFuture<Void> voidFuture = CompletableFuture.runAsync(() -> {
    System.out.println("后台任务");
});
```

### 8.2 链式处理

```java
// thenApply: 转换结果（类似 .then(v => v + "!")）
CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> "hello")
    .thenApply(s -> s.toUpperCase())   // "HELLO"
    .thenApply(s -> s + "!");           // "HELLO!"

// 对比 JS:
// Promise.resolve("hello")
//   .then(s => s.toUpperCase())
//   .then(s => s + "!")

// thenAccept: 消费结果，无返回值（类似 .then(v => console.log(v))）
CompletableFuture.supplyAsync(() -> "hello")
    .thenAccept(s -> System.out.println("结果: " + s));

// thenRun: 执行动作，不关心结果（类似 .then(() => doSomething())）
CompletableFuture.supplyAsync(() -> "hello")
    .thenRun(() -> System.out.println("任务完成！"));
```

### 8.3 组合多个 Future

```java
// thenCompose: 串行组合（类似 JS 的 flatMap / async/await 串行）
// 当第一个 Future 完成后，用结果启动第二个 Future
CompletableFuture<String> composed = CompletableFuture
    .supplyAsync(() -> "userId:123")
    .thenCompose(userId -> 
        CompletableFuture.supplyAsync(() -> "User: " + userId)
    );

// 对比 JS:
// async function getUser() {
//   const userId = await getUserId();
//   const user = await fetchUser(userId);
//   return user;
// }

// thenCombine: 并行组合（类似 Promise.all 的两个）
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> "Hello");
CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> "World");

CompletableFuture<String> combined = f1.thenCombine(f2, (s1, s2) -> s1 + " " + s2);
System.out.println(combined.get()); // "Hello World"

// 对比 JS:
// const [s1, s2] = await Promise.all([p1, p2]);
// return s1 + " " + s2;
```

### 8.4 allOf 和 anyOf

```java
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> {
    Thread.sleep(1000); return "结果1";
});
CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> {
    Thread.sleep(2000); return "结果2";
});
CompletableFuture<String> f3 = CompletableFuture.supplyAsync(() -> {
    Thread.sleep(500); return "结果3";
});

// allOf: 等待所有完成（类似 Promise.all）
// ⚠️ 注意：allOf 返回 CompletableFuture<Void>，需要手动获取每个结果
CompletableFuture<Void> allFuture = CompletableFuture.allOf(f1, f2, f3);
allFuture.thenRun(() -> {
    try {
        String r1 = f1.get();
        String r2 = f2.get();
        String r3 = f3.get();
        System.out.println(r1 + ", " + r2 + ", " + r3);
    } catch (Exception e) { e.printStackTrace(); }
});

// anyOf: 任意一个完成就继续（类似 Promise.race）
CompletableFuture<Object> anyFuture = CompletableFuture.anyOf(f1, f2, f3);
anyFuture.thenAccept(result -> System.out.println("最快的结果: " + result));
// 约500ms后输出: 最快的结果: 结果3
```

### 8.5 异常处理

```java
// exceptionally: 捕获异常，提供默认值（类似 .catch(e => defaultValue)）
CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> {
        if (Math.random() > 0.5) throw new RuntimeException("出错了！");
        return "成功";
    })
    .exceptionally(e -> {
        System.out.println("异常: " + e.getMessage());
        return "默认值"; // 提供兜底值
    });

// handle: 同时处理正常结果和异常（类似 .then(v, e) 或 finally）
CompletableFuture<String> handled = CompletableFuture
    .supplyAsync(() -> {
        throw new RuntimeException("出错了！");
    })
    .handle((result, exception) -> {
        if (exception != null) {
            return "处理了异常: " + exception.getMessage();
        }
        return "正常结果: " + result;
    });

// 对比 JS:
// promise.then(
//   result => "正常结果: " + result,
//   err => "处理了异常: " + err.message
// )
```

### 8.6 完整示例：模拟商品查询

```java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ProductService {
    
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    
    // 模拟异步获取商品信息
    public CompletableFuture<String> getProduct(long id) {
        return CompletableFuture.supplyAsync(() -> {
            // 模拟数据库查询
            Thread.sleep(100);
            return "商品:" + id;
        }, executor);
    }
    
    // 模拟异步获取库存
    public CompletableFuture<Integer> getStock(long id) {
        return CompletableFuture.supplyAsync(() -> {
            Thread.sleep(80);
            return 100;
        }, executor);
    }
    
    // 模拟异步获取价格
    public CompletableFuture<Double> getPrice(long id) {
        return CompletableFuture.supplyAsync(() -> {
            Thread.sleep(120);
            return 99.9;
        }, executor);
    }
    
    // 并发获取所有信息，合并结果
    public CompletableFuture<String> getProductDetail(long id) {
        CompletableFuture<String> productFuture = getProduct(id);
        CompletableFuture<Integer> stockFuture = getStock(id);
        CompletableFuture<Double> priceFuture = getPrice(id);
        
        // 等待三个并发任务都完成
        return CompletableFuture.allOf(productFuture, stockFuture, priceFuture)
            .thenApply(v -> {
                try {
                    String product = productFuture.get();
                    int stock = stockFuture.get();
                    double price = priceFuture.get();
                    return String.format("%s, 库存:%d, 价格:%.1f", product, stock, price);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });
    }
    
    public static void main(String[] args) throws Exception {
        ProductService service = new ProductService();
        
        // 并发获取，总时间约 120ms（最慢的那个），而不是 300ms
        String detail = service.getProductDetail(1L).get();
        System.out.println(detail);
        // 输出: 商品:1, 库存:100, 价格:99.9
        
        service.executor.shutdown();
    }
}
```

---

## 9. Java 21 虚拟线程（Virtual Threads）

### 9.1 什么是虚拟线程？

Java 21 引入的革命性特性，解决传统线程的开销问题：

```
传统线程（Platform Thread）：
- 对应 OS 线程，创建成本高（约 1MB 栈内存）
- 线程切换有系统开销
- 通常只能创建数千个

虚拟线程（Virtual Thread）：
- JVM 管理，不直接对应 OS 线程
- 极轻量级（约 1KB 栈内存）
- 可创建数百万个！
- I/O 阻塞时自动挂起，释放载体线程
```

💡 **对比 JS**：虚拟线程有点像 Node.js 的异步模型，但你可以用同步的方式写代码！

### 9.2 使用虚拟线程

```java
// Java 21+

// 方式1：直接创建虚拟线程
Thread vt = Thread.ofVirtual().start(() -> {
    System.out.println("虚拟线程: " + Thread.currentThread().isVirtual());
});
vt.join();

// 方式2：虚拟线程的 ExecutorService（推荐）
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        final int taskId = i;
        executor.submit(() -> {
            // 每个任务都在独立虚拟线程中运行
            // 即使有阻塞 I/O，也不会浪费 OS 线程
            Thread.sleep(100); // 模拟 I/O
            return taskId;
        });
    }
} // try-with-resources 自动关闭并等待所有任务完成
```

### 9.3 虚拟线程最佳实践

✅ **推荐**：
- 用于 I/O 密集型任务（HTTP 请求、数据库查询）
- 替代传统线程池处理大量并发请求
- Spring Boot 3.2+ 支持：`spring.threads.virtual.enabled=true`

⚠️ **注意**：
- CPU 密集型任务仍用传统线程池
- 避免在虚拟线程中持有 synchronized 块执行 I/O（会 pin 住载体线程）
- 推荐改用 `ReentrantLock` 代替 `synchronized`

---

## 10. 并发常见坑

### 10.1 竞态条件（Race Condition）

```java
// ⚠️ 典型竞态条件：单例模式的双重检查
public class Singleton {
    private static Singleton instance;
    
    // 错误写法！
    public static Singleton getInstance() {
        if (instance == null) {           // ← 多线程可能同时通过这里
            instance = new Singleton();   // ← 可能创建多个实例
        }
        return instance;
    }
}

// ✅ 正确写法：双重检查锁（Double-Checked Locking）
public class Singleton {
    private static volatile Singleton instance; // volatile 必须！
    
    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) { // 再次检查
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}

// ✅ 更简单：静态内部类（推荐）
public class Singleton {
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    
    public static Singleton getInstance() {
        return Holder.INSTANCE; // JVM 保证类加载线程安全
    }
}
```

### 10.2 死锁排查

```bash
# 查看 Java 进程的线程 dump
jstack <pid>

# 输出中搜索 "deadlock" 字样
# 或使用 VisualVM、JConsole 图形化工具
```

### 10.3 内存泄漏

```java
// ⚠️ ThreadLocal 使用不当导致内存泄漏
public class RequestContext {
    // ThreadLocal 在线程池中使用时，线程不会销毁，
    // 如果不清理，value 会一直留在内存中
    private static final ThreadLocal<String> userId = new ThreadLocal<>();
    
    public static void setUserId(String id) {
        userId.set(id);
    }
    
    public static String getUserId() {
        return userId.get();
    }
    
    // ✅ 必须在请求结束时清理！
    public static void clear() {
        userId.remove(); // 关键！
    }
}

// 在过滤器/拦截器中：
try {
    RequestContext.setUserId("user123");
    // 处理请求...
} finally {
    RequestContext.clear(); // 无论如何都要清理
}
```

### 10.4 线程池任务异常被吞掉

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

// ⚠️ execute 提交的任务，异常会被静默吞掉！
executor.execute(() -> {
    throw new RuntimeException("这个异常你看不到！");
});

// ✅ 方式1：用 submit，通过 Future 获取异常
Future<?> future = executor.submit(() -> {
    throw new RuntimeException("这个异常在 get() 时会抛出");
});
try {
    future.get(); // 这里会抛出 ExecutionException
} catch (ExecutionException e) {
    System.out.println("捕获到: " + e.getCause().getMessage());
}

// ✅ 方式2：在任务内部捕获
executor.execute(() -> {
    try {
        throw new RuntimeException("会被打印");
    } catch (Exception e) {
        System.err.println("任务异常: " + e.getMessage());
    }
});
```

### 10.5 快速参考：并发工具选型

| 场景 | 推荐工具 |
|------|----------|
| 简单计数/状态标志 | `AtomicInteger` / `AtomicBoolean` |
| 保护代码块 | `synchronized` 或 `ReentrantLock` |
| 读多写少 | `ReadWriteLock` |
| 异步任务+回调 | `CompletableFuture` |
| 批量异步任务 | `CompletableFuture.allOf()` |
| 定时/周期任务 | `ScheduledExecutorService` |
| 大量 I/O 任务 | 虚拟线程（Java 21+） |
| 线程间传递数据 | `BlockingQueue` |
| 一次性屏障 | `CountDownLatch` |
| 可重用屏障 | `CyclicBarrier` |
| 控制并发数量 | `Semaphore` |

---

## 总结

```
并发学习路径：
1. 理解多线程 vs 单线程的本质区别
2. 掌握 synchronized 基础同步
3. 学会使用线程池（永远不要手动 new Thread）
4. 掌握 CompletableFuture（最常用的异步工具）
5. 了解 volatile 和 Atomic 类
6. 进阶：Lock、读写锁、并发集合
7. Java 21+：虚拟线程
```

> 并发编程的黄金法则：**能不共享状态就不共享，必须共享时才加锁。**
