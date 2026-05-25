# 实战项目与进阶路线

> 动手做项目是学习 Java 最快的方式

## 目录

1. [博客系统后端实战](#博客系统后端实战)
2. [前后端联调](#前后端联调)
3. [进阶学习路线](#进阶学习路线)
4. [面试高频题](#面试高频题)
5. [推荐资源](#推荐资源)

---

## 博客系统后端实战

### 需求分析

| 模块 | 功能 |
|------|------|
| 用户模块 | 注册、登录（JWT）、查看/编辑个人信息 |
| 文章模块 | 发布/编辑/删除文章、分页查询、按标签筛选、浏览量统计 |
| 评论模块 | 发表评论、回复评论（楼中楼）、删除 |
| 标签模块 | 创建/删除标签、查看文章标签 |

### 数据库设计

```sql
-- 用户表
CREATE TABLE users (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(100) NOT NULL,
    avatar      VARCHAR(255),
    bio         TEXT,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 文章表
CREATE TABLE articles (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    title       VARCHAR(200) NOT NULL,
    content     MEDIUMTEXT   NOT NULL,
    summary     VARCHAR(500),
    cover_image VARCHAR(255),
    status      VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    view_count  INT          NOT NULL DEFAULT 0,
    user_id     BIGINT       NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FULLTEXT INDEX ft_title_content (title, content)  -- 全文搜索
);

-- 标签表
CREATE TABLE tags (
    id    BIGINT PRIMARY KEY AUTO_INCREMENT,
    name  VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT '#666666'
);

-- 文章标签关联表（多对多）
CREATE TABLE article_tags (
    article_id BIGINT NOT NULL,
    tag_id     BIGINT NOT NULL,
    PRIMARY KEY (article_id, tag_id),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)     REFERENCES tags(id)     ON DELETE CASCADE
);

-- 评论表
CREATE TABLE comments (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    content    TEXT    NOT NULL,
    article_id BIGINT  NOT NULL,
    user_id    BIGINT  NOT NULL,
    parent_id  BIGINT  DEFAULT NULL,  -- NULL 表示顶级评论
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id),
    FOREIGN KEY (parent_id)  REFERENCES comments(id) ON DELETE CASCADE
);
```

### API 设计

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | ❌ |
| POST | `/api/auth/login` | 登录，返回 JWT | ❌ |
| GET | `/api/users/me` | 获取当前用户信息 | ✅ |
| PUT | `/api/users/me` | 更新个人信息 | ✅ |
| GET | `/api/articles` | 文章列表（分页/搜索/按标签） | ❌ |
| GET | `/api/articles/{id}` | 文章详情 | ❌ |
| POST | `/api/articles` | 发布文章 | ✅ |
| PUT | `/api/articles/{id}` | 编辑文章（仅作者） | ✅ |
| DELETE | `/api/articles/{id}` | 删除文章（仅作者） | ✅ |
| GET | `/api/articles/{id}/comments` | 文章评论列表 | ❌ |
| POST | `/api/articles/{id}/comments` | 发表评论 | ✅ |
| DELETE | `/api/comments/{id}` | 删除评论（仅作者） | ✅ |
| GET | `/api/tags` | 标签列表 | ❌ |
| POST | `/api/tags` | 创建标签 | ✅ |

### 核心代码：Article 模块

#### Entity

```java
@Entity
@Table(name = "articles")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Article {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String content;

    @Column(length = 500)
    private String summary;

    private String coverImage;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ArticleStatus status = ArticleStatus.DRAFT;

    @Column(nullable = false)
    @Builder.Default
    private Integer viewCount = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User author;

    @ManyToMany
    @JoinTable(
        name = "article_tags",
        joinColumns = @JoinColumn(name = "article_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();

    @CreatedDate @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

#### Repository

```java
@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {

    // 分页查询（已发布）
    Page<Article> findByStatusOrderByCreatedAtDesc(ArticleStatus status, Pageable pageable);

    // 按标签查询
    @Query("SELECT DISTINCT a FROM Article a JOIN a.tags t WHERE t.id = :tagId AND a.status = 'PUBLISHED'")
    Page<Article> findByTagId(@Param("tagId") Long tagId, Pageable pageable);

    // 关键词搜索
    @Query("SELECT a FROM Article a WHERE a.status = 'PUBLISHED' AND " +
           "(a.title LIKE %:kw% OR a.summary LIKE %:kw%)")
    Page<Article> search(@Param("kw") String keyword, Pageable pageable);

    // 某用户的文章
    Page<Article> findByAuthorIdAndStatus(Long authorId, ArticleStatus status, Pageable pageable);

    // 增加浏览量（原子操作）
    @Modifying
    @Query("UPDATE Article a SET a.viewCount = a.viewCount + 1 WHERE a.id = :id")
    void incrementViewCount(@Param("id") Long id);
}
```

#### Service

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class ArticleService {

    private final ArticleRepository articleRepository;
    private final TagRepository tagRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<ArticleDTO> list(int page, int size, Long tagId, String keyword) {
        Pageable pageable = PageRequest.of(page, size);

        Page<Article> articles;
        if (tagId != null) {
            articles = articleRepository.findByTagId(tagId, pageable);
        } else if (keyword != null && !keyword.isBlank()) {
            articles = articleRepository.search(keyword, pageable);
        } else {
            articles = articleRepository.findByStatusOrderByCreatedAtDesc(ArticleStatus.PUBLISHED, pageable);
        }
        return articles.map(ArticleDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    public ArticleDetailDTO getById(Long id) {
        Article article = articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("文章不存在"));

        if (article.getStatus() != ArticleStatus.PUBLISHED) {
            throw new ResourceNotFoundException("文章不存在");
        }

        // 异步增加浏览量（避免影响读取性能）
        CompletableFuture.runAsync(() -> articleRepository.incrementViewCount(id));

        return ArticleDetailDTO.fromEntity(article);
    }

    @Transactional
    public ArticleDTO create(CreateArticleRequest req, Long authorId) {
        User author = userRepository.findById(authorId).orElseThrow();

        Set<Tag> tags = new HashSet<>();
        if (req.getTagIds() != null && !req.getTagIds().isEmpty()) {
            tags = new HashSet<>(tagRepository.findAllById(req.getTagIds()));
        }

        Article article = Article.builder()
            .title(req.getTitle())
            .content(req.getContent())
            .summary(req.getSummary())
            .coverImage(req.getCoverImage())
            .status(req.isDraft() ? ArticleStatus.DRAFT : ArticleStatus.PUBLISHED)
            .author(author)
            .tags(tags)
            .build();

        article = articleRepository.save(article);
        log.info("文章发布成功: id={}, title={}", article.getId(), article.getTitle());
        return ArticleDTO.fromEntity(article);
    }

    @Transactional
    public ArticleDTO update(Long id, UpdateArticleRequest req, Long currentUserId) {
        Article article = articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("文章不存在"));

        // 权限校验：只有作者才能修改
        if (!article.getAuthor().getId().equals(currentUserId)) {
            throw new BusinessException(403, "无权限修改此文章");
        }

        article.setTitle(req.getTitle());
        article.setContent(req.getContent());
        article.setSummary(req.getSummary());

        return ArticleDTO.fromEntity(articleRepository.save(article));
    }
}
```

#### DTO

```java
// 列表 DTO（不包含全文内容，减少传输量）
@Data @Builder
public class ArticleDTO {
    private Long id;
    private String title;
    private String summary;
    private String coverImage;
    private String status;
    private Integer viewCount;
    private AuthorDTO author;
    private List<TagDTO> tags;
    private LocalDateTime createdAt;

    public static ArticleDTO fromEntity(Article article) {
        return ArticleDTO.builder()
            .id(article.getId())
            .title(article.getTitle())
            .summary(article.getSummary())
            .coverImage(article.getCoverImage())
            .status(article.getStatus().name())
            .viewCount(article.getViewCount())
            .author(AuthorDTO.fromEntity(article.getAuthor()))
            .tags(article.getTags().stream().map(TagDTO::fromEntity).toList())
            .createdAt(article.getCreatedAt())
            .build();
    }
}

// 详情 DTO（包含全文）
@Data @Builder
public class ArticleDetailDTO extends ArticleDTO {
    private String content;
    // ...
}
```

---

## 前后端联调

### CORS 配置

```java
@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList("http://localhost:3000", "https://yourdomain.com"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

### 前端 Axios 封装

```typescript
// src/api/request.ts
import axios, { AxiosError, AxiosResponse } from 'axios'
import { useAuthStore } from '@/stores/auth'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：自动附加 JWT
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  (res: AxiosResponse) => res.data.data,  // 直接返回 data 字段
  (err: AxiosError<{ code: number; message: string }>) => {
    const status = err.response?.status
    const message = err.response?.data?.message || '请求失败'

    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    } else if (status === 403) {
      console.error('无权限')
    } else {
      console.error(message)
    }
    return Promise.reject(err)
  }
)

export default request

// src/api/article.ts
import request from './request'

export const articleApi = {
  list: (params: { page?: number; size?: number; tagId?: number; keyword?: string }) =>
    request.get('/api/articles', { params }),

  getById: (id: number) =>
    request.get(`/api/articles/${id}`),

  create: (data: CreateArticleRequest) =>
    request.post('/api/articles', data),

  update: (id: number, data: UpdateArticleRequest) =>
    request.put(`/api/articles/${id}`, data),

  delete: (id: number) =>
    request.delete(`/api/articles/${id}`),
}
```

---

## 进阶学习路线

### 阶段六：JVM 原理（2～3 周）

| 主题 | 核心知识点 |
|------|-----------|
| 内存模型 | 堆（年轻代/老年代）、栈（方法栈/本地方法栈）、方法区/元空间、程序计数器 |
| GC 算法 | 标记清除、标记整理、复制算法；分代回收；ZGC/G1 适用场景 |
| 类加载 | 双亲委派模型、类加载器、热加载原理 |
| 性能调优 | `-Xmx`/`-Xms` 参数、GC 日志分析、内存泄漏排查 |

### 阶段七：微服务（1～2 个月）

```
Spring Cloud 生态
├── Spring Cloud Gateway     ← API 网关（路由/限流/认证）
├── Nacos                    ← 服务注册与配置中心（类似 Consul/etcd）
├── OpenFeign                ← 声明式 HTTP 客户端（服务间调用）
├── Sentinel                 ← 限流熔断（类似 Hystrix）
└── Seata                    ← 分布式事务
```

### 阶段八：分布式中间件（持续深入）

| 中间件 | 学习重点 |
|--------|---------|
| MySQL | 索引原理（B+树）、慢查询优化、主从复制、分库分表 |
| Redis | 数据结构、持久化（RDB/AOF）、集群模式、分布式锁、缓存穿透/击穿/雪崩 |
| Kafka | 消息模型、分区/副本、消费者组、消息积压处理 |
| Elasticsearch | 倒排索引、全文检索、聚合分析 |

### 阶段九：性能调优工具

```bash
# Arthas —— 线上 Java 诊断利器（阿里开源）
# 无需重启即可排查线上问题
java -jar arthas-boot.jar

# 常用命令
trace com.example.UserService getById  # 追踪方法耗时
watch com.example.UserService getById returnObj  # 观察返回值
jmap -heap <pid>    # 查看堆内存
jstack <pid>        # 线程栈（死锁排查）
```

---

## 面试高频题

### Java 基础

**Q1：`==` 和 `equals()` 的区别？**

`==` 比较基本类型的值，或引用类型的内存地址（是否是同一个对象）。`equals()` 是方法，默认实现同 `==`，但 `String`、`Integer` 等类重写了它来比较内容。

⚠️ **坑**：`Integer a = 127; Integer b = 127; a == b; // true`（缓存），但 `Integer a = 128; Integer b = 128; a == b; // false`（新对象）。✅ 始终用 `equals()` 比较对象值。

---

**Q2：`String`、`StringBuilder`、`StringBuffer` 区别？**

| | `String` | `StringBuilder` | `StringBuffer` |
|-|---------|----------------|----------------|
| 可变性 | 不可变 | 可变 | 可变 |
| 线程安全 | ✅（不可变天然安全） | ❌ | ✅（加锁） |
| 性能 | 拼接慢（每次新建对象） | 快 | 比 StringBuilder 慢 |
| 推荐场景 | 常量字符串 | 单线程字符串拼接 | 多线程字符串拼接（少见） |

---

**Q3：`ArrayList` 和 `LinkedList` 区别？**

`ArrayList` 基于数组，随机访问 O(1)，末尾增删均摊 O(1)，中间插入 O(n)。`LinkedList` 基于双向链表，随机访问 O(n)，头尾增删 O(1)。**90% 场景用 ArrayList**，内存占用更少，缓存局部性更好。

---

**Q4：什么是自动装箱/拆箱？有什么坑？**

自动装箱：`int` → `Integer`（自动调用 `Integer.valueOf()`）；拆箱：`Integer` → `int`（自动调用 `.intValue()`）。

**坑**：① `Integer` 缓存范围 -128~127，超出范围 `==` 返回 `false`；② 对 null 的 `Integer` 拆箱会 `NullPointerException`；③ 大量循环中频繁装箱性能差，用基本类型。

---

**Q5：说说 Java 的异常体系？**

```
Throwable
├── Error（严重系统错误，不应捕获：OOM、StackOverflow）
└── Exception
    ├── 受检异常（Checked）：编译器强制处理，如 IOException、SQLException
    └── 非受检异常（Unchecked / RuntimeException）：可不处理，如 NPE、ArrayIndexOutOfBounds
```

✅ 推荐：业务异常继承 `RuntimeException`（非受检），避免强制 try-catch 导致代码臃肿。

---

### 并发

**Q1：`synchronized` 和 `ReentrantLock` 的区别？**

| | `synchronized` | `ReentrantLock` |
|-|----------------|-----------------|
| 实现 | JVM 内置 | Java 代码实现 |
| 锁释放 | 自动（代码块结束或异常） | 必须手动 `unlock()`（放 finally） |
| 可中断 | ❌ | ✅ `lockInterruptibly()` |
| 超时等待 | ❌ | ✅ `tryLock(timeout)` |
| 公平锁 | ❌ | ✅ `new ReentrantLock(true)` |
| 条件变量 | 一个（`wait/notify`） | 多个（`newCondition()`） |

✅ 简单场景用 `synchronized`，需要超时/可中断/多条件时用 `ReentrantLock`。

---

**Q2：`volatile` 能保证原子性吗？**

**不能**。`volatile` 只保证：① **可见性**（修改立即刷回主内存，其他线程立即可见）；② **禁止指令重排序**。但 `i++` 这种复合操作（读-改-写）不是原子的，`volatile` 无法保证。要保证原子性用 `AtomicInteger` 或 `synchronized`。

---

**Q3：线程池的核心参数有哪些？**

`ThreadPoolExecutor` 的 7 个核心参数：
1. `corePoolSize`：核心线程数（常驻）
2. `maximumPoolSize`：最大线程数
3. `keepAliveTime`：非核心线程的空闲存活时间
4. `unit`：时间单位
5. `workQueue`：任务队列（`LinkedBlockingQueue` / `ArrayBlockingQueue` / `SynchronousQueue`）
6. `threadFactory`：线程工厂（设置线程名等）
7. `rejectedExecutionHandler`：拒绝策略（`AbortPolicy`/`CallerRunsPolicy`/`DiscardPolicy`/`DiscardOldestPolicy`）

---

**Q4：说说 `ThreadLocal` 的使用场景和内存泄漏问题？**

`ThreadLocal` 为每个线程提供独立副本，常用于：用户登录信息传递（存当前登录用户 ID）、数据库连接管理、事务上下文。

**内存泄漏**：`ThreadLocalMap` 的 key 是弱引用（`ThreadLocal`），value 是强引用。`ThreadLocal` 对象被 GC 后，key 变为 null，但 value 仍被 Map 持有，无法回收。**解决**：使用后调用 `threadLocal.remove()`，尤其是线程池场景（线程复用，不及时清理会污染下一个任务）。

---

**Q5：`ConcurrentHashMap` 和 `HashMap` 的区别？**

`HashMap` 非线程安全，多线程并发 put 可能导致死循环（Java 7）或数据丢失。`ConcurrentHashMap` 线程安全：Java 8 使用 CAS + `synchronized`（锁单个桶而非整个 map），读操作无锁，写操作锁最小粒度，性能远高于 `Hashtable`。

---

### Spring

**Q1：Spring IoC 和 DI 是什么？**

**IoC（控制反转）**：对象的创建和依赖管理由 Spring 容器负责，而非程序员手动 `new`。**DI（依赖注入）**：IoC 的实现方式，Spring 在创建对象时自动注入其依赖。✅ 推荐构造器注入（依赖明确、易测试、final 字段）。

---

**Q2：`@Transactional` 的传播行为有哪些？**

| 传播行为 | 说明 | 场景 |
|---------|------|------|
| `REQUIRED`（默认） | 有事务则加入，无则新建 | 最常用 |
| `REQUIRES_NEW` | 总是新建事务，挂起当前事务 | 日志记录（不被外层回滚影响） |
| `SUPPORTS` | 有事务则加入，无则不开启 | 只读查询 |
| `NOT_SUPPORTED` | 挂起当前事务，不使用事务执行 | — |
| `NEVER` | 必须在无事务环境执行 | — |
| `MANDATORY` | 必须在事务中执行，否则抛异常 | — |
| `NESTED` | 嵌套事务（子事务可独立回滚） | — |

⚠️ **常见坑**：同一个类中方法 A 调用方法 B，B 的 `@Transactional` **不生效**（Spring AOP 基于代理，内部调用绕过代理）。

---

**Q3：Spring Bean 的生命周期？**

实例化 → 属性填充（依赖注入）→ `BeanNameAware`/`BeanFactoryAware` → `BeanPostProcessor.postProcessBeforeInitialization` → `@PostConstruct` / `InitializingBean.afterPropertiesSet()` → 自定义 init-method → `BeanPostProcessor.postProcessAfterInitialization` → 使用 → `@PreDestroy` / `DisposableBean.destroy()` → 销毁

---

**Q4：`@RestController` 和 `@Controller` 的区别？**

`@RestController` = `@Controller` + `@ResponseBody`，方法返回值直接序列化为 JSON/XML 写入响应体。`@Controller` 返回视图名（Thymeleaf 模板等），需要在方法上加 `@ResponseBody` 才返回 JSON。✅ 纯 API 项目全部用 `@RestController`。

---

**Q5：Spring MVC 的请求处理流程？**

1. 请求到达 `DispatcherServlet`（前端控制器）
2. `HandlerMapping` 根据 URL 找到对应 Controller 方法
3. `HandlerAdapter` 调用方法，执行拦截器链（`preHandle`）
4. 执行 Controller 方法，返回结果
5. 执行拦截器链（`postHandle`）
6. `HttpMessageConverter` 将返回值序列化为 JSON 写入响应
7. 执行拦截器链（`afterCompletion`）

---

## 推荐资源

### 书籍

| 书名 | 阶段 | 推荐理由 |
|------|------|---------|
| 《Java 核心技术》卷一（卡尔） | 入门 | 内容权威详细，覆盖 Java 基础到泛型/集合/并发 |
| 《Effective Java》（布洛克） | 进阶 | 90 条最佳实践，面试必读，每条都是经验精华 |
| 《深入理解 Java 虚拟机》周志明 | 进阶 | JVM 领域最权威的中文书，面试 JVM 题的标准答案 |
| 《Java 并发编程实战》 | 进阶 | 并发编程圣经，Doug Lea 参与编写 |
| 《Spring Boot 实战》 | Spring | Spring Boot 官方推荐入门书 |

### 在线资源

| 网站 | 内容 | 推荐理由 |
|------|------|---------|
| [Baeldung.com](https://www.baeldung.com) | Spring/Java 教程 | 质量最高的英文 Java 博客，每篇文章深入且实用 |
| [spring.io/guides](https://spring.io/guides) | Spring 官方指南 | 每个 Guide 15 分钟，覆盖常见集成场景 |
| [LeetCode](https://leetcode.cn) | 算法练习 | 用 Java 刷题，语法熟练后做 Hot 100 |
| [CS Notes](https://cyc2018.xyz) | 面试综合 | 中文质量最高的 Java 面试复习资料 |

### 开源项目（读源码）

| 项目 | 学习重点 |
|------|---------|
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | Spring Boot 官方示例，最标准的项目结构 |
| [mall