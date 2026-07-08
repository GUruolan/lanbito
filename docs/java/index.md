# Java 全栈学习指南

> 专为前端工程师设计，从零开始掌握 Java 后端开发

## 为什么前端工程师要学 Java？

### 市场价值

Java 是全球最流行的后端语言之一，在国内大厂（美团、阿里、腾讯、字节）的后端服务中占据主导地位。掌握 Java 意味着你可以：

- 参与全栈开发，理解前后端协作的完整链路
- 在大厂获得更高的薪资层级（全栈 > 纯前端）
- 具备独立开发完整产品的能力

### 你的优势

作为有 TypeScript 和 Node.js 经验的前端工程师，你已经掌握了很多可迁移的概念：

| 你已经会的 | Java 对应概念 | 迁移难度 |
|-----------|-------------|---------|
| TypeScript 类型系统 | Java 静态类型 | ⭐ 容易 |
| TS 接口 / 类 | Java 接口 / 抽象类 | ⭐⭐ 中等 |
| JS Promise / async-await | Java CompletableFuture | ⭐⭐ 中等 |
| JS 数组方法 (map/filter/reduce) | Java Stream API | ⭐ 容易 |
| Node.js Express | Spring Boot | ⭐⭐⭐ 需要学习 |
| npm 包管理 | Maven / Gradle | ⭐ 容易 |
| JS 事件循环 | Java 多线程 | ⭐⭐⭐ 需要学习 |

### Java vs Node.js 后端对比

```
性能：    Java (JVM JIT) > Node.js (V8, 单线程)
并发：    Java 原生多线程 vs Node.js 事件循环
生态：    Java Spring 企业级 vs Node.js Express 轻量级
类型安全：Java 编译期检查 > TypeScript (运行时还是 JS)
学习曲线：Java 陡峭 > Node.js 平缓
```

---

## 学习路线图

### 阶段一：Java 基础语法（2-3 周）

**目标**：能看懂 Java 代码，能写简单的 Java 程序

**内容**：
- Java 类型系统（8种基本类型、包装类、String）
- 变量、常量、运算符
- 控制流程（if/switch/for/while）
- 数组与字符串操作
- Lambda 表达式基础
- 异常处理机制

**里程碑**：能用 Java 实现常见算法题（LeetCode Easy）

---

### 阶段二：面向对象编程（2-3 周）

**目标**：掌握 Java OOP 核心概念，理解设计模式

**内容**：
- 类、接口、抽象类、继承
- Lombok 注解（减少样板代码）
- 泛型与枚举
- 常用设计模式（单例、工厂、策略、观察者）
- Record 类（Java 16+）

**里程碑**：能设计合理的类结构，看懂 Spring 源码中的 OOP 模式

---

### 阶段三：集合框架与 Stream API（1-2 周）

**目标**：熟练使用 Java 集合，掌握函数式编程风格

**内容**：
- List / Set / Map / Queue 体系
- ArrayList / HashMap / HashSet 原理
- Stream API（对标 JS 数组方法）
- Optional 正确使用
- 不可变集合

**里程碑**：能用 Stream API 写出简洁的数据处理逻辑

---

### 阶段四：Spring Boot 开发（4-6 周）

**目标**：能独立开发 RESTful API

**内容**：
- Spring 核心概念（IoC、DI、AOP）
- Spring Boot 自动配置
- Spring MVC（Controller、Service、Repository）
- MyBatis / JPA 数据库操作
- 参数校验、统一异常处理
- 接口文档（Swagger/OpenAPI）

**里程碑**：能独立开发一个完整的 CRUD API 服务

---

### 阶段五：进阶与实战（持续学习）

**目标**：掌握企业级开发技能

**内容**：
- 多线程与并发（ThreadPool、CompletableFuture）
- Redis 缓存集成
- 消息队列（RabbitMQ / Kafka）
- 微服务基础（Spring Cloud）
- 容器化部署（Docker）
- 性能调优与监控

**里程碑**：能参与实际工作中的 Java 后端项目开发

---

## 章节导航

| 章节 | 内容 | 难度 |
|------|------|------|
| [01 - Java 基础语法](./01-basics.md) | 类型系统、变量、运算符、控制流、数组、字符串、Lambda、异常 | ⭐⭐ |
| [02 - 面向对象编程](./02-oop.md) | 类/接口/继承、Lombok、泛型、枚举、设计模式 | ⭐⭐⭐ |
| [03 - 集合与 Stream](./03-collections.md) | List/Map/Set、Stream API、Optional | ⭐⭐ |
| 04 - Spring Boot 基础 | IoC/DI、MVC、数据库 | ⭐⭐⭐⭐ |
| 05 - 数据库操作 | MyBatis、JPA、事务 | ⭐⭐⭐ |
| 06 - 并发编程 | 线程、锁、CompletableFuture | ⭐⭐⭐⭐⭐ |

---

## 学习建议

### 环境搭建

```bash
# 安装 JDK 21 (LTS 版本)
# macOS
brew install openjdk@21

# 验证安装
java --version
# openjdk 21.x.x ...

# 推荐 IDE：IntelliJ IDEA Community Edition (免费)
# 下载：https://www.jetbrains.com/idea/download/
```

### 高效学习方法

1. **对比学习**：每学一个 Java 概念，立刻找到 JS/TS 的对应物，利用已有知识快速建立映射
2. **动手为主**：每个代码示例都自己敲一遍，光看不练等于没学
3. **读错误信息**：Java 编译器错误信息非常精准，学会读懂它比搜索更高效
4. **用 IDEA**：IntelliJ IDEA 的代码提示和重构功能极大降低学习门槛
5. **不要死记 API**：记住在哪里找，用到时查文档（Javadoc）

### 推荐资源

- **官方文档**：[https://docs.oracle.com/en/java/](https://docs.oracle.com/en/java/)
- **在线练习**：LeetCode（Java 模式）、Exercism Java Track
- **书籍**：《Effective Java》（进阶必读）
- **Spring 官方教程**：[https://spring.io/guides](https://spring.io/guides)

### 常见误区

> ⚠️ **不要从 Java 基础语法扣太久** — 有 TS 基础的你，2周就够了，赶快进入 Spring Boot 实践

> ⚠️ **不要用 Java 写 JS 风格的代码** — 拥抱 Java 的强类型和 OOP 思维

> ⚠️ **不要跳过 Maven/Gradle** — 依赖管理是 Java 项目的基础，类比 npm

---

*最后更新：2026-05*
