# Spring Boot 全栈开发

> 对标 Express/NestJS 的 Java 后端框架，企业级后端的事实标准

## 目录

1. [快速上手](#快速上手)
2. [构建 RESTful API](#构建-restful-api)
3. [Spring Data JPA](#spring-data-jpa)
4. [参数校验](#参数校验)
5. [Spring Security + JWT](#spring-security--jwt)
6. [配置管理](#配置管理)
7. [Redis 缓存集成](#redis-缓存集成)
8. [单元测试](#单元测试)
9. [打包与部署](#打包与部署)

---

## 快速上手

### 创建项目

访问 [https://start.spring.io](https://start.spring.io) 按以下配置：

| 选项 | 值 |
|------|----|
| Project | Maven |
| Language | Java |
| Spring Boot | 3.x（最新稳定版） |
| Java | 21 |
| Dependencies | Spring Web, Spring Data JPA, MySQL Driver, Lombok, Validation |

点击 **Generate** 下载 zip，解压后用 IntelliJ IDEA 打开。

### 项目结构对比

```
Express 项目                Spring Boot 项目
├── src/
│   ├── routes/             ├── controller/     ← HTTP 路由层
│   ├── services/           ├── service/        ← 业务逻辑层
│   ├── models/             ├── entity/         ← 数据库实体
│   ├── dto/                ├── dto/            ← 请求/响应数据结构
│   ├── middleware/         ├── config/         ← 配置/拦截器
│   └── app.js              └── Application.java ← 启动入口
├── package.json            ├── pom.xml         ← 依赖管理
└── .env                    └── application.yml ← 配置文件
```

💡 **对比 NestJS**：Spring Boot 的分层思想与 NestJS（Controller/Service/Module）几乎完全一样，只是注解写法不同。

### 启动入口

```java
@SpringBootApplication  // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 核心注解速查表

| 注解 | 作用 | 对应 Express/NestJS |
|------|------|-------------------|
| `@RestController` | 标记为 REST 控制器（返回 JSON） | `@Controller()` + `res.json()` |
| `@RequestMapping` | 设置路由前缀 | `router = express.Router()` |
| `@GetMapping` / `@PostMapping` | HTTP 方法路由 | `router.get()` / `router.post()` |
| `@Service` | 标记为服务类（业务逻辑） | `@Injectable()` |
| `@Repository` | 标记为数据访问类 | — |
| `@Component` | 通用 Spring 组件 | `@Injectable()` |
| `@Autowired` | 依赖注入（不推荐，用构造器注入）| `constructor(private svc: Svc)` |
| `@Value("${key}")` | 注入配置值 | `process.env.KEY` |
| `@Configuration` | 配置类 | — |
| `@Bean` | 在配置类中声明 Bean | — |
| `@Transactional` | 事务管理 | — |
| `@Slf4j` (Lombok) | 注入日志 | `console.log` |

---

## 构建 RESTful API

### 完整 Controller 示例

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor  // Lombok：自动生成构造器注入
@Slf4j
public class UserController {

    private final UserService userService;  // ✅ 构造器注入（推荐）

    // GET /api/users?page=0&size=10&keyword=alice
    @GetMapping
    public ApiResponse<Page<UserDTO>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        log.info("查询用户列表, page={}, size={}, keyword={}", page, size, keyword);
        Page<UserDTO> result = userService.list(page, size, keyword);
        return ApiResponse.success(result);
    }

    // GET /api/users/1
    @GetMapping("/{id}")
    public ApiResponse<UserDTO> getById(@PathVariable Long id) {
        return ApiResponse.success(userService.getById(id));
    }

    // POST /api/users
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)  // 返回 201
    public ApiResponse<UserDTO> create(@Valid @RequestBody CreateUserRequest req) {
        return ApiResponse.success(userService.create(req));
    }

    // PUT /api/users/1
    @PutMapping("/{id}")
    public ApiResponse<UserDTO> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest req) {
        return ApiResponse.success(userService.update(id, req));
    }

    // DELETE /api/users/1
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)  // 返回 204
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
```

### 统一响应格式

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static <T> ApiResponse<T> created(T data) {
        return new ApiResponse<>(201, "created", data);
    }

    public static ApiResponse<Void> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}
```

### 全局异常处理

```java
@RestControllerAdvice  // 全局异常拦截
@Slf4j
public class GlobalExceptionHandler {

    // 业务异常
    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBusiness(BusinessException e) {
        log.warn("业务异常: {}", e.getMessage());
        return ApiResponse.error(e.getCode(), e.getMessage());
    }

    // 资源不存在
    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNotFound(ResourceNotFoundException e) {
        return ApiResponse.error(404, e.getMessage());
    }

    // 参数校验失败
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .collect(Collectors.joining("; "));
        return ApiResponse.error(400, message);
    }

    // 未知异常
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleUnknown(Exception e) {
        log.error("未知异常", e);
        return ApiResponse.error(500, "服务器内部错误");
    }
}

// 自定义业务异常
@Getter
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
}

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) { super(message); }
}
```

---

## Spring Data JPA

### Entity 实体类

```java
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_email", columnList = "email", unique = true)
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)  // 开启审计
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;  // 存储加密后的密码

    @Enumerated(EnumType.STRING)  // ✅ 存字符串而非数字
    @Column(nullable = false)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    @CreatedDate                  // 自动填充创建时间
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate             // 自动填充更新时间
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "author", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Article> articles = new ArrayList<>();
}
```

在启动类上加 `@EnableJpaAuditing` 开启时间自动填充。

### Repository 接口

```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // 方法名即查询！Spring 自动生成 SQL
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByStatus(UserStatus status);

    List<User> findByStatusOrderByCreatedAtDesc(UserStatus status);

    // 分页查询
    Page<User> findByNameContaining(String keyword, Pageable pageable);

    // 自定义 JPQL
    @Query("SELECT u FROM User u WHERE u.name LIKE %:keyword% OR u.email LIKE %:keyword%")
    Page<User> search(@Param("keyword") String keyword, Pageable pageable);

    // 原生 SQL
    @Query(value = "SELECT * FROM users WHERE created_at >= :date", nativeQuery = true)
    List<User> findRecentUsers(@Param("date") LocalDateTime date);

    // 更新操作（需要 @Modifying + @Transactional）
    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.status = :status WHERE u.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") UserStatus status);
}
```

### Service 层

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)  // ✅ 只读事务，性能更好
    public Page<UserDTO> list(int page, int size, String keyword) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<User> users = keyword != null && !keyword.isBlank()
            ? userRepository.search(keyword, pageable)
            : userRepository.findAll(pageable);
        return users.map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public UserDTO getById(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("用户 " + id + " 不存在"));
        return toDTO(user);
    }

    @Transactional  // ✅ 写操作必须加事务
    public UserDTO create(CreateUserRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new BusinessException(409, "邮箱已被注册");
        }
        User user = User.builder()
            .name(req.getName())
            .email(req.getEmail())
            .password(passwordEncoder.encode(req.getPassword()))
            .build();
        user = userRepository.save(user);
        log.info("用户注册成功: {}", user.getEmail());
        return toDTO(user);
    }

    @Transactional
    public void delete(Long id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("用户 " + id + " 不存在");
        }
        userRepository.deleteById(id);
    }

    private UserDTO toDTO(User user) {
        return UserDTO.builder()
            .id(user.getId())
            .name(user.getName())
            .email(user.getEmail())
            .status(user.getStatus())
            .createdAt(user.getCreatedAt())
            .build();
    }
}
```

### 解决 N+1 查询问题

```java
// ❌ N+1 问题：查询 100 个 User，每个 User 再查 articles，共 101 次 SQL
List<User> users = userRepository.findAll();
users.forEach(u -> System.out.println(u.getArticles().size())); // 每次访问触发查询

// ✅ 解决方案1：@EntityGraph（一次查询加载关联）
@EntityGraph(attributePaths = {"articles"})
@Query("SELECT u FROM User u")
List<User> findAllWithArticles();

// ✅ 解决方案2：JOIN FETCH
@Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.articles")
List<User> findAllWithArticles();
```

---

## 参数校验

```java
// 引入依赖（已在 starter 中包含）
// spring-boot-starter-validation

@Data
public class CreateUserRequest {

    @NotBlank(message = "姓名不能为空")
    @Size(min = 2, max = 50, message = "姓名长度须在 2-50 之间")
    private String name;

    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 100, message = "密码长度至少 8 位")
    private String password;

    @Min(value = 18, message = "年龄不能小于 18")
    @Max(value = 120, message = "年龄不能大于 120")
    private Integer age;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;
}
```

Controller 中用 `@Valid` 触发校验，校验失败由 `GlobalExceptionHandler` 统一处理。

---

## Spring Security + JWT

### pom.xml 依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.3</version>
</dependency>
```

### JWT 工具类

```java
@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration:86400000}")  // 默认 24 小时
    private long expiration;

    public String generateToken(String email) {
        return Jwts.builder()
            .subject(email)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes()))
            .compact();
    }

    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    public boolean isValid(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
```

### JWT 过滤器

```java
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isValid(token)) {
                String email = jwtUtil.extractEmail(token);
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        chain.doFilter(req, res);
    }
}
```

### Security 配置

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()  // 放行登录注册
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()                 // 其他需要认证
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

## 配置管理

```yaml
# application.yml
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}  # 默认 dev，可用环境变量覆盖
  jpa:
    open-in-view: false  # 关闭 OSIV，避免懒加载在视图层触发查询
    show-sql: false

jwt:
  secret: ${JWT_SECRET:change-this-in-production-must-be-long-enough}
  expiration: 86400000

---
# application-dev.yml
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:mysql://localhost:3306/mydb_dev?serverTimezone=Asia/Shanghai
    username: root
    password: root
  jpa:
    hibernate:
      ddl-auto: update  # 开发环境自动建表
    show-sql: true

---
# application-prod.yml
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate  # 生产环境只验证，不修改表结构
```

### @ConfigurationProperties（强类型配置）

```java
@ConfigurationProperties(prefix = "app")
@Data
@Component
public class AppProperties {
    private String name = "MyApp";
    private Upload upload = new Upload();

    @Data
    public static class Upload {
        private String path = "/tmp/uploads";
        private long maxSize = 10 * 1024 * 1024L;  // 10MB
    }
}
```

```yaml
app:
  name: 博客系统
  upload:
    path: /data/uploads
    max-size: 52428800  # 50MB
```

---

## Redis 缓存集成

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
  cache:
    type: redis
    redis:
      time-to-live: 300000  # 5分钟
```

```java
@SpringBootApplication
@EnableCaching  // 开启缓存
public class Application { ... }

@Service
@RequiredArgsConstructor
public class UserService {

    @Cacheable(value = "users", key = "#id")  // 查询时缓存
    public UserDTO getById(Long id) {
        // 第一次执行，之后从缓存取
        return toDTO(userRepository.findById(id).orElseThrow());
    }

    @CacheEvict(value = "users", key = "#id")  // 删除时清除缓存
    public void delete(Long id) {
        userRepository.deleteById(id);
    }

    @CachePut(value = "users", key = "#result.id")  // 更新时刷新缓存
    public UserDTO update(Long id, UpdateUserRequest req) {
        User user = userRepository.findById(id).orElseThrow();
        user.setName(req.getName());
        return toDTO(userRepository.save(user));
    }
}
```

---

## 单元测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean  // Mock 掉 Service，只测 Controller 层
    private UserService userService;

    @Test
    void getUser_shouldReturn200() throws Exception {
        UserDTO dto = UserDTO.builder().id(1L).name("Alice").email("alice@example.com").build();
        given(userService.getById(1L)).willReturn(dto);

        mockMvc.perform(get("/api/users/1")
                .header("Authorization", "Bearer " + getTestToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Alice"))
            .andExpect(jsonPath("$.data.email").value("alice@example.com"));
    }

    @Test
    void createUser_withInvalidEmail_shouldReturn400() throws Exception {
        CreateUserRequest req = new CreateUserRequest();
        req.setName("Bob");
        req.setEmail("not-an-email");
        req.setPassword("password123");

        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest());
    }
}

// Service 层单元测试
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void getById_whenUserExists_shouldReturnDTO() {
        User user = User.builder().id(1L).name("Alice").email("alice@example.com").build();
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        UserDTO dto = userService.getById(1L);

        assertThat(dto.getName()).isEqualTo("Alice");
        verify(userRepository, times(1)).findById(1L);
    }

    @Test
    void getById_whenUserNotExists_shouldThrow() {
        given(userRepository.findById(anyLong())).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getById(99L))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("99");
    }
}
```

---

## 打包与部署

### 打包为可执行 Jar

```bash
# 打包（跳过测试）
mvn clean package -DskipTests

# 运行
java -jar target/myapp-0.0.1-SNAPSHOT.jar

# 指定环境
java -jar target/myapp.jar --spring.profiles.active=prod

# 指定端口
java -jar target/myapp.jar --server.port=9090

# JVM 调优参数
java -Xms256m -Xmx512m -jar target/myapp.jar
```

### Dockerfile

```dockerfile
# 多阶段构建，减小镜像体积
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline  # 缓存依赖层
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

```bash
# 构建镜像
docker build -t myapp:latest .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -e DB_URL=jdbc:mysql://db:3306/mydb \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=secret \
  -e JWT_SECRET=your-secret-key \
  --name myapp \
  myapp:latest
```

---

*← [上一章：并发编程](./04-concurrency.md) | [下一章：实战项目](./06-practice.md) →*
