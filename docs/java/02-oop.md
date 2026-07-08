# 面向对象编程（OOP）

> 面向有 TypeScript / C++ 基础的前端工程师

## 目录

1. [类的完整定义](#类的完整定义)
2. [Lombok — 告别样板代码](#lombok)
3. [继承](#继承)
4. [抽象类 vs 接口](#抽象类-vs-接口)
5. [枚举 enum](#枚举-enum)
6. [泛型](#泛型)
7. [Record 类（Java 16+）](#record-类)
8. [常用设计模式](#常用设计模式)

---

## 类的完整定义

```java
import java.time.LocalDateTime;
import java.util.Objects;

public class User {

    // ① 实例字段（private 封装）
    private Long id;
    private String name;
    private String email;
    private LocalDateTime createdAt;

    // ② 静态字段（属于类本身，不属于实例）
    private static int totalCount = 0;

    // ③ 无参构造器
    public User() {
        totalCount++;
    }

    // ④ 有参构造器
    public User(String name, String email) {
        this.name = name;
        this.email = email;
        this.createdAt = LocalDateTime.now();
        totalCount++;
    }

    // ⑤ 静态工厂方法（推荐替代 new）
    public static User of(String name, String email) {
        return new User(name, email);
    }

    // ⑥ 静态方法
    public static int getTotalCount() {
        return totalCount;
    }

    // ⑦ 实例方法
    public String getDisplayName() {
        return name + " <" + email + ">";
    }

    // ⑧ Getter / Setter
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    // ⑨ toString（调试必备）
    @Override
    public String toString() {
        return "User{id=" + id + ", name='" + name + "', email='" + email + "'}";
    }

    // ⑩ equals & hashCode（放进集合时必须重写）
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof User)) return false;
        User user = (User) o;
        return Objects.equals(email, user.email);  // 以 email 作为唯一标识
    }

    @Override
    public int hashCode() {
        return Objects.hash(email);
    }
}
```

💡 **对比 JS/TS**

| 概念 | TypeScript | Java |
|------|-----------|------|
| 字段声明 | 类体或构造器参数 | 类体顶部 |
| 构造器 | `constructor()` | 与类同名的方法 |
| 静态成员 | `static` | `static` |
| `this` | 隐式推断，有时需要绑定 | 明确指向当前实例 |
| 访问修饰符 | `public/private/protected` | 同，但 `private` 更严格 |

⚠️ **注意**：Java 没有 `undefined`，未初始化的引用类型字段默认是 `null`，基本类型字段默认为 `0`/`false`。

---

## Lombok

手写 getter/setter/equals/hashCode 非常繁琐。Lombok 通过注解在编译期自动生成这些代码。

**pom.xml 添加依赖：**
```xml
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
```

### 常用注解速查

| 注解 | 作用 |
|------|------|
| `@Data` | 生成所有 getter/setter + toString + equals/hashCode |
| `@Getter` / `@Setter` | 单独生成 getter 或 setter |
| `@NoArgsConstructor` | 生成无参构造器 |
| `@AllArgsConstructor` | 生成全参构造器 |
| `@RequiredArgsConstructor` | 生成 `final` 字段的构造器（Spring 注入常用） |
| `@Builder` | 生成建造者模式 |
| `@Value` | 生成不可变类（所有字段 `final` + getter） |
| `@Slf4j` | 注入 `log` 日志对象 |
| `@ToString` | 单独控制 toString |

### 用 Lombok 重写 User 类

```java
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;

@Data                        // getter/setter/toString/equals/hashCode
@Builder                     // User.builder().name("Alice").email("a@b.com").build()
@NoArgsConstructor           // 无参构造（JPA 需要）
@AllArgsConstructor          // 全参构造
@Slf4j                       // 注入 log 变量
public class User {
    private Long id;
    private String name;
    private String email;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public void printInfo() {
        log.info("User: {}", this);  // 直接用 log，无需手动声明
    }
}
```

💡 **对比 JS**：`@Builder` 生成的链式 API 类似 JS 对象字面量 `{ name: "Alice", email: "a@b.com" }`，但有类型安全保障。

```java
// 建造者用法
User user = User.builder()
    .name("Alice")
    .email("alice@example.com")
    .build();
```

✅ **推荐**：生产代码中几乎总是使用 Lombok，大幅减少样板代码。

---

## 继承

```java
// 父类
public class Animal {
    protected String name;
    protected int age;

    public Animal(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String speak() {
        return name + " makes a sound";
    }

    public String describe() {
        return name + ", age " + age;
    }
}

// 子类
public class Dog extends Animal {

    private String breed;

    // 调用父类构造器（必须是第一行）
    public Dog(String name, int age, String breed) {
        super(name, age);       // 类比 C++ 的初始化列表
        this.breed = breed;
    }

    // 方法重写
    @Override
    public String speak() {
        return name + " says: Woof!";
    }

    // 新增方法
    public String getBreed() {
        return breed;
    }
}
```

💡 **对比 C++**：
- Java 只支持**单继承**（一个类只能 `extends` 一个父类），不像 C++ 支持多继承
- 不需要指定继承方式（C++ 的 `public/protected/private` 继承），Java 默认等价于 `public` 继承
- 没有虚函数表的概念，Java 所有非 `static`/`final` 方法默认都是虚方法（多态）

```java
Animal a = new Dog("Rex", 3, "Labrador");
System.out.println(a.speak());    // Rex says: Woof!（多态调用子类方法）
System.out.println(a.describe()); // Rex, age 3（继承父类方法）
```

⚠️ **注意**：`final` 类不能被继承，`final` 方法不能被重写。

```java
public final class String { ... }  // String 是 final 类，不可继承
```

---

## 抽象类 vs 接口

### 对比表

| 特性 | 抽象类 (`abstract class`) | 接口 (`interface`) |
|------|--------------------------|-------------------|
| 实例化 | ❌ 不能直接实例化 | ❌ 不能直接实例化 |
| 继承/实现 | `extends`（单继承） | `implements`（可多实现） |
| 字段 | 可以有实例字段 | 只能有 `public static final` 常量 |
| 构造器 | ✅ 有 | ❌ 无 |
| 方法实现 | 可以有具体方法 | 可以有 `default` 方法（Java 8+） |
| 访问修饰符 | 任意 | 方法默认 `public` |

💡 **何时用抽象类**：有共享状态（字段）或共享实现逻辑，且是"is-a"关系（Dog is-a Animal）

💡 **何时用接口**：定义行为契约，且无需共享状态（Flyable、Serializable、Comparable）

```java
// 抽象类：有共享字段和模板方法
public abstract class Shape {
    protected String color;  // 共享字段

    public Shape(String color) {
        this.color = color;
    }

    // 模板方法（子类必须实现）
    public abstract double area();

    // 共享实现
    public void printInfo() {
        System.out.printf("%s 颜色的图形，面积=%.2f%n", color, area());
    }
}

// 接口：行为契约
public interface Drawable {
    void draw();  // 抽象方法

    default String getDescription() {  // 默认实现（Java 8+）
        return "A drawable object";
    }
}

// 继承抽象类 + 实现接口
public class Circle extends Shape implements Drawable {
    private double radius;

    public Circle(String color, double radius) {
        super(color);
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }

    @Override
    public void draw() {
        System.out.println("Drawing a circle with radius " + radius);
    }
}
```

💡 **对比 TypeScript**：TS 的 `abstract class` 和 `interface` 行为类似，但 Java 接口可以有 `default` 方法实现，更接近 TS 中带实现的 `interface`（JS mixin 风格）。

---

## 枚举 enum

Java 的 `enum` 远比 TypeScript 的 `enum` 强大——它是真正的类，可以有字段、方法、甚至实现接口。

### 基础用法

```java
public enum Day {
    MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
}

Day today = Day.MONDAY;
System.out.println(today.name());      // "MONDAY"
System.out.println(today.ordinal());   // 0（索引）
Day[] days = Day.values();             // 所有枚举值数组
Day d = Day.valueOf("FRIDAY");         // 字符串转枚举
```

### 带字段和方法的枚举

```java
public enum OrderStatus {
    PENDING("待支付", false),
    PAID("已支付", true),
    SHIPPED("已发货", true),
    DELIVERED("已收货", true),
    CANCELLED("已取消", false);

    private final String label;
    private final boolean isPaid;

    // 枚举构造器（private）
    OrderStatus(String label, boolean isPaid) {
        this.label = label;
        this.isPaid = isPaid;
    }

    public String getLabel() { return label; }
    public boolean isPaid() { return isPaid; }

    // 枚举方法
    public boolean canCancel() {
        return this == PENDING;
    }
}
```

```java
OrderStatus status = OrderStatus.PAID;
System.out.println(status.getLabel());    // 已支付
System.out.println(status.isPaid());      // true
System.out.println(status.canCancel());   // false
```

### 枚举 + switch（Java 14+ 模式匹配）

```java
String message = switch (status) {
    case PENDING -> "请尽快完成支付";
    case PAID, SHIPPED -> "订单处理中，请耐心等待";
    case DELIVERED -> "感谢您的购买！";
    case CANCELLED -> "订单已取消";
};
```

⚠️ **注意**：枚举比较用 `==`，不需要 `.equals()`（枚举是单例，`==` 就是值比较）。

💡 **对比 TS**：TS 的 `enum` 本质是数字或字符串的别名，Java `enum` 是真正的类，功能强大得多。

---

## 泛型

### 基础语法

```java
// 泛型类
public class Box<T> {
    private T value;

    public Box(T value) { this.value = value; }
    public T getValue() { return value; }
}

Box<String> strBox = new Box<>("Hello");
Box<Integer> intBox = new Box<>(42);
String s = strBox.getValue();  // 无需强转
```

💡 **对比 TS**：
```typescript
// TypeScript
class Box<T> {
    constructor(private value: T) {}
    getValue(): T { return this.value; }
}
```
语法几乎相同，Java 只是把 `: T` 换成了 `T` 在前面声明。

### 泛型方法

```java
// 泛型方法（T 在返回值前声明）
public static <T> List<T> repeat(T item, int times) {
    List<T> result = new ArrayList<>();
    for (int i = 0; i < times; i++) result.add(item);
    return result;
}

List<String> words = repeat("hello", 3);  // ["hello", "hello", "hello"]
```

### 通配符

```java
// ? extends T —— 上界通配符（读取用）
// 可以传入 List<Integer>、List<Double>（都是 Number 的子类）
public double sum(List<? extends Number> list) {
    return list.stream().mapToDouble(Number::doubleValue).sum();
}

// ? super T —— 下界通配符（写入用）
// 可以传入 List<Number>、List<Object>
public void addNumbers(List<? super Integer> list) {
    list.add(1);
    list.add(2);
}
```

✅ **记忆口诀**：**PECS**（Producer Extends, Consumer Super）
- 生产者（只读取）用 `? extends T`
- 消费者（只写入）用 `? super T`

### 类型擦除

⚠️ **注意**：Java 泛型在运行时会被擦除，`List<String>` 和 `List<Integer>` 在运行时都是 `List`。这与 TS 不同（TS 泛型在编译期静态检查，运行时无影响因为被编译为 JS）。

```java
List<String> strings = new ArrayList<>();
List<Integer> ints = new ArrayList<>();
System.out.println(strings.getClass() == ints.getClass());  // true！运行时同一个类
```

---

## Record 类

Java 16+ 引入的 `record`，专为不可变数据载体设计，自动生成构造器、getter、equals、hashCode、toString。

```java
// 一行定义，等价于一个完整的不可变类
public record Point(int x, int y) {}

// 使用
Point p = new Point(3, 4);
System.out.println(p.x());       // 3（getter 方法名就是字段名）
System.out.println(p.y());       // 4
System.out.println(p);           // Point[x=3, y=4]

// 可以添加自定义方法
public record Point(int x, int y) {
    // 紧凑构造器（校验）
    public Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException("坐标不能为负");
    }

    public double distance() {
        return Math.sqrt(x * x + y * y);
    }
}
```

💡 **对比 TS**：
```typescript
// TypeScript
interface Point { readonly x: number; readonly y: number; }
// 或
type Point = { readonly x: number; readonly y: number; };
```

Java `record` 更强大，自动实现了 equals/hashCode（TS interface 不含逻辑）。

### DTO 场景对比

| 方案 | 代码量 | 可变性 | equals | 推荐场景 |
|------|--------|--------|--------|---------|
| 普通类 | 最多 | 可变 | 需手写 | 有业务逻辑的实体 |
| Lombok `@Value` | 少 | 不可变 | 自动 | JDK 16 以下 |
| `record` | 最少 | 不可变 | 自动 | JDK 16+ DTO/值对象 |

✅ **推荐**：JDK 17+ 项目的 DTO、值对象优先用 `record`。

---

## 常用设计模式

### 单例模式

```java
// 方式1：双重检验锁（线程安全，懒加载）
public class DatabaseConnection {
    private static volatile DatabaseConnection instance;

    private DatabaseConnection() {}  // 私有构造器

    public static DatabaseConnection getInstance() {
        if (instance == null) {
            synchronized (DatabaseConnection.class) {
                if (instance == null) {
                    instance = new DatabaseConnection();
                }
            }
        }
        return instance;
    }
}

// 方式2：枚举单例（✅ 最推荐，天然线程安全，防反序列化破坏）
public enum AppConfig {
    INSTANCE;

    private String dbUrl = "jdbc:mysql://localhost/mydb";
    public String getDbUrl() { return dbUrl; }
}

// 使用
AppConfig.INSTANCE.getDbUrl();
```

### 建造者模式（Lombok 版）

```java
@Builder
@Data
public class HttpRequest {
    private String url;
    private String method;
    private Map<String, String> headers;
    private String body;
    private int timeout;
}

// 使用（类似 JS 的对象字面量，但有类型安全）
HttpRequest request = HttpRequest.builder()
    .url("https://api.example.com/users")
    .method("POST")
    .body("{\"name\":\"Alice\"}")
    .timeout(5000)
    .build();
```

### 策略模式

```java
// 策略接口
public interface SortStrategy {
    void sort(int[] data);
}

// 具体策略
public class BubbleSort implements SortStrategy {
    @Override
    public void sort(int[] data) {
        // 冒泡排序实现...
    }
}

public class QuickSort implements SortStrategy {
    @Override
    public void sort(int[] data) {
        // 快速排序实现...
    }
}

// 上下文
public class Sorter {
    private SortStrategy strategy;

    public Sorter(SortStrategy strategy) {
        this.strategy = strategy;
    }

    public void setStrategy(SortStrategy strategy) {
        this.strategy = strategy;
    }

    public void sort(int[] data) {
        strategy.sort(data);
    }
}

// 使用（Lambda 简化！接口只有一个方法时可用 Lambda）
Sorter sorter = new Sorter(data -> Arrays.sort(data));  // Lambda 作为策略
sorter.sort(new int[]{3, 1, 4, 1, 5});
```

### 观察者模式

```java
import java.util.ArrayList;
import java.util.List;

// 观察者接口
public interface OrderObserver {
    void onOrderCreated(Order order);
}

// 被观察者
public class OrderService {
    private List<OrderObserver> observers = new ArrayList<>();

    public void addObserver(OrderObserver observer) {
        observers.add(observer);
    }

    public Order createOrder(String product, int quantity) {
        Order order = new Order(product, quantity);
        // 通知所有观察者
        observers.forEach(o -> o.onOrderCreated(order));
        return order;
    }
}

// 具体观察者
public class EmailNotifier implements OrderObserver {
    @Override
    public void onOrderCreated(Order order) {
        System.out.println("发送邮件：您的订单 " + order.getId() + " 已创建");
    }
}

// 使用
OrderService service = new OrderService();
service.addObserver(new EmailNotifier());
service.addObserver(order -> System.out.println("短信通知：订单 " + order.getId()));  // Lambda
service.createOrder("MacBook", 1);
```

---

*← [上一章：基础语法](./01-basics.md) | [下一章：集合框架](./03-collections.md) →*
