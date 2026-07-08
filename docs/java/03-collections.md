# 集合框架与 Stream API

> Java 集合是日常开发最高频使用的工具，Stream API 是 Java 版的"数组方法链"

## 目录

1. [集合体系概览](#集合体系概览)
2. [List 详解](#list-详解)
3. [Map 详解](#map-详解)
4. [Set 详解](#set-详解)
5. [Queue & Deque](#queue--deque)
6. [Stream API](#stream-api)
7. [Optional](#optional)
8. [不可变集合](#不可变集合)

---

## 集合体系概览

```
java.util.Collection
├── List（有序、可重复）
│   ├── ArrayList       ← 动态数组，最常用
│   ├── LinkedList      ← 链表，实现了 Deque
│   └── Vector          ← 线程安全但已过时，用 CopyOnWriteArrayList 替代
│
├── Set（无序、不重复）
│   ├── HashSet         ← 哈希表，最快，无序
│   ├── LinkedHashSet   ← 哈希表+链表，保持插入顺序
│   └── TreeSet         ← 红黑树，按自然顺序排序
│
└── Queue（队列）
    ├── ArrayDeque      ← 双端队列，可作栈和队列（推荐）
    ├── PriorityQueue   ← 优先级队列（堆）
    └── LinkedList      ← 也实现了 Queue

java.util.Map（键值对，key 唯一）
├── HashMap             ← 哈希表，最常用，无序
├── LinkedHashMap       ← 保持插入顺序
├── TreeMap             ← 按 key 排序
├── ConcurrentHashMap   ← 线程安全版 HashMap
└── Hashtable           ← 线程安全但已过时，用 ConcurrentHashMap 替代
```

💡 **对比 JS**：
| Java 集合 | JS 对应 |
|-----------|---------|
| `ArrayList` | `Array` |
| `HashMap` | `Map` / `{}` |
| `HashSet` | `Set` |
| `ArrayDeque` | 无直接对应（用 Array 模拟） |

---

## List 详解

### ArrayList 常用操作

```java
import java.util.*;

List<String> list = new ArrayList<>();

// 增
list.add("apple");           // 末尾追加
list.add(0, "banana");       // 插入指定位置
list.addAll(List.of("c", "d")); // 批量追加

// 删
list.remove(0);              // ⚠️ 按索引删除（返回被删元素）
list.remove("apple");        // 按对象删除（返回 boolean）
list.removeIf(s -> s.startsWith("b")); // 条件删除

// 改
list.set(0, "cherry");       // 替换指定位置

// 查
String first = list.get(0);
int idx = list.indexOf("cherry");
boolean has = list.contains("cherry");
int size = list.size();
boolean empty = list.isEmpty();

// 子列表（视图！修改影响原列表）
List<String> sub = list.subList(1, 3);

// 排序
Collections.sort(list);
list.sort(Comparator.reverseOrder());
list.sort(Comparator.comparing(String::length));

// 其他工具
Collections.shuffle(list);
Collections.reverse(list);
String max = Collections.max(list);
```

⚠️ **常见坑：按索引 vs 按对象删除**
```java
List<Integer> nums = new ArrayList<>(Arrays.asList(1, 2, 3));
nums.remove(1);          // 按索引！删除第 2 个元素，结果 [1, 3]
nums.remove(Integer.valueOf(1));  // 按对象！删除值为 1 的元素，结果 [2, 3]
```

### 初始化技巧

```java
// ✅ 不可变列表（Java 9+）
List<String> fixed = List.of("a", "b", "c");

// ✅ 可变列表（从不可变转）
List<String> mutable = new ArrayList<>(List.of("a", "b", "c"));

// ✅ Arrays.asList（固定大小，可修改元素但不能增删）
List<String> semi = Arrays.asList("a", "b", "c");
```

### ArrayList vs LinkedList

| 操作 | ArrayList | LinkedList | 说明 |
|------|-----------|------------|------|
| 随机访问 `get(i)` | O(1) ✅ | O(n) ❌ | ArrayList 数组结构直接寻址 |
| 末尾追加 `add(e)` | O(1) 均摊 ✅ | O(1) ✅ | 差不多 |
| 头部插入 `add(0,e)` | O(n) ❌ | O(1) ✅ | 链表直接改指针 |
| 中间插入 | O(n) ❌ | O(n) ❌ | 链表需先遍历到位置 |
| 内存占用 | 低 ✅ | 高（每个节点存前后指针）❌ | — |

✅ **推荐**：**90% 的场景用 ArrayList**，只有频繁在头部插入/删除时才考虑 LinkedList。

---

## Map 详解

### HashMap 常用操作

```java
Map<String, Integer> map = new HashMap<>();

// 增/改
map.put("apple", 3);
map.putIfAbsent("apple", 5);       // key 不存在时才放入
map.putAll(otherMap);              // 合并另一个 Map

// 查
int val = map.get("apple");        // key 不存在时返回 null（⚠️ 可能 NPE）
int val2 = map.getOrDefault("missing", 0);  // ✅ 安全查询

// 删
map.remove("apple");
map.remove("apple", 3);  // 仅当 key=apple 且 value=3 时才删

// 检查
map.containsKey("apple");
map.containsValue(3);
map.size();
map.isEmpty();

// 高级操作
map.computeIfAbsent("key", k -> new ArrayList<>());  // key 不存在时计算并放入
map.computeIfPresent("key", (k, v) -> v + 1);        // key 存在时更新
map.merge("apple", 1, Integer::sum);                  // ✅ 计数神器：不存在则放1，存在则累加
map.replaceAll((k, v) -> v * 2);                      // 批量更新所有值

// 遍历（三种方式）
// 方式1：entrySet（推荐，性能最好）
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    System.out.println(entry.getKey() + " -> " + entry.getValue());
}

// 方式2：forEach Lambda
map.forEach((k, v) -> System.out.println(k + " -> " + v));

// 方式3：keySet（不推荐，需二次查找）
for (String key : map.keySet()) {
    System.out.println(key + " -> " + map.get(key));
}
```

### 计数模式（高频用法）

```java
String[] words = {"apple", "banana", "apple", "cherry", "banana", "apple"};
Map<String, Integer> freq = new HashMap<>();

// 方式1：getOrDefault
for (String w : words) {
    freq.put(w, freq.getOrDefault(w, 0) + 1);
}

// 方式2：merge（更简洁）✅
for (String w : words) {
    freq.merge(w, 1, Integer::sum);
}

// 方式3：Stream（最简洁）✅
Map<String, Long> freq2 = Arrays.stream(words)
    .collect(Collectors.groupingBy(w -> w, Collectors.counting()));
```

### HashMap 原理简介

- **哈希桶**：HashMap 内部是数组，每个槽位是一个桶（bucket）
- **哈希冲突**：key 的 hashCode 相同时，Java 8+ 用链表+红黑树存储（链表长度 > 8 时转为红黑树）
- **默认容量**：16，负载因子 0.75，超过 `容量 × 0.75` 时自动扩容（容量翻倍）
- **key 的要求**：key 必须正确实现 `equals()` 和 `hashCode()`

⚠️ **注意**：HashMap 不是线程安全的，多线程场景用 `ConcurrentHashMap`。

### LinkedHashMap vs TreeMap

```java
// LinkedHashMap：保持插入顺序（类似 JS 的 Map）
Map<String, Integer> linked = new LinkedHashMap<>();
linked.put("banana", 2);
linked.put("apple", 1);
linked.put("cherry", 3);
linked.forEach((k, v) -> System.out.print(k + " "));
// 输出：banana apple cherry（插入顺序）

// TreeMap：按 key 字典序排序
Map<String, Integer> tree = new TreeMap<>();
tree.put("banana", 2);
tree.put("apple", 1);
tree.put("cherry", 3);
tree.forEach((k, v) -> System.out.print(k + " "));
// 输出：apple banana cherry（排序）

// TreeMap 还支持范围查询
TreeMap<Integer, String> scores = new TreeMap<>();
scores.subMap(60, 90);   // 60~89 分的区间
scores.headMap(60);      // 小于 60 分的
scores.tailMap(90);      // 大于等于 90 分的
```

---

## Set 详解

```java
// HashSet：最快，无序
Set<String> set = new HashSet<>();
set.add("apple");
set.add("apple");        // 重复元素自动忽略
System.out.println(set.size());  // 1

// 去重神器
List<String> withDups = Arrays.asList("a", "b", "a", "c", "b");
Set<String> unique = new HashSet<>(withDups);  // {a, b, c}
List<String> deduped = new ArrayList<>(unique);

// LinkedHashSet：去重 + 保持插入顺序
Set<String> ordered = new LinkedHashSet<>(withDups);
// 遍历：a b c（保持首次出现顺序）

// TreeSet：去重 + 排序
Set<Integer> sorted = new TreeSet<>(Arrays.asList(3, 1, 4, 1, 5, 9, 2, 6));
System.out.println(sorted);  // [1, 2, 3, 4, 5, 6, 9]

// 集合运算
Set<String> a = new HashSet<>(Arrays.asList("x", "y", "z"));
Set<String> b = new HashSet<>(Arrays.asList("y", "z", "w"));

Set<String> union = new HashSet<>(a);      // 并集
union.addAll(b);                           // {x, y, z, w}

Set<String> intersection = new HashSet<>(a);  // 交集
intersection.retainAll(b);                    // {y, z}

Set<String> diff = new HashSet<>(a);       // 差集
diff.removeAll(b);                         // {x}
```

---

## Queue & Deque

```java
// ArrayDeque 作为队列（FIFO）
Queue<String> queue = new ArrayDeque<>();
queue.offer("first");     // 入队（推荐用 offer，失败返回 false 而不是抛异常）
queue.offer("second");
queue.peek();             // 查看队头，不移除
queue.poll();             // 出队，队空返回 null
queue.isEmpty();

// ArrayDeque 作为栈（LIFO）
Deque<String> stack = new ArrayDeque<>();
stack.push("a");    // 压栈（= addFirst）
stack.push("b");
stack.peek();       // 栈顶，不弹出
stack.pop();        // 弹栈（= removeFirst）

// PriorityQueue（最小堆，默认自然顺序）
PriorityQueue<Integer> minHeap = new PriorityQueue<>();
minHeap.offer(3);
minHeap.offer(1);
minHeap.offer(2);
System.out.println(minHeap.poll());  // 1（最小值先出）

// 最大堆
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.reverseOrder());

// 自定义比较器（按任务优先级）
PriorityQueue<Task> taskQueue = new PriorityQueue<>(
    Comparator.comparingInt(Task::getPriority).reversed()
);
```

⚠️ **注意**：`Stack` 类已过时，用 `ArrayDeque` 替代；`LinkedList` 虽然也实现了 `Deque`，但 `ArrayDeque` 性能更好。

---

## Stream API

> 💡 **对比 JS**：Java Stream 就是 Java 版的链式数组方法（`.filter().map().reduce()`），但有三大区别：
> 1. 惰性求值（只有遇到终止操作才真正执行）
> 2. 只能使用一次（消费后不可复用）
> 3. 可以并行处理（`.parallelStream()`）

### JS vs Java Stream 完整对比

| JS 数组方法 | Java Stream | 说明 |
|------------|-------------|------|
| `.filter(fn)` | `.filter(fn)` | 过滤 |
| `.map(fn)` | `.map(fn)` | 转换 |
| `.flatMap(fn)` | `.flatMap(fn)` | 展平 |
| `.reduce(fn, init)` | `.reduce(init, fn)` | 归约 |
| `.forEach(fn)` | `.forEach(fn)` | 遍历（终止操作） |
| `.find(fn)` | `.filter(fn).findFirst()` | 查找第一个符合的 |
| `.some(fn)` | `.anyMatch(fn)` | 任意一个匹配 |
| `.every(fn)` | `.allMatch(fn)` | 全部匹配 |
| `.includes(x)` | `.anyMatch(x::equals)` | 是否包含 |
| `.slice(s, e)` | `.skip(s).limit(e-s)` | 截取 |
| `[...new Set(arr)]` | `.distinct()` | 去重 |
| `.sort(fn)` | `.sorted(comparator)` | 排序 |
| `.length` | `.count()` | 计数 |
| `arr[0]` | `.findFirst().orElse(null)` | 第一个元素 |
| `Math.max(...)` | `.mapToInt(fn).max()` | 最大值 |

### 基础用法

```java
List<Integer> nums = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

// filter + map + collect（最常用链式操作）
List<Integer> result = nums.stream()
    .filter(n -> n % 2 == 0)    // [2, 4, 6, 8, 10]
    .map(n -> n * n)             // [4, 16, 36, 64, 100]
    .filter(n -> n > 20)         // [36, 64, 100]
    .collect(Collectors.toList());  // 转回 List

// Java 16+ 简写
List<Integer> result2 = nums.stream()
    .filter(n -> n % 2 == 0)
    .map(n -> n * n)
    .toList();  // 不可变 List
```

### 聚合操作

```java
// 求和/平均/最大最小
int sum = nums.stream().mapToInt(Integer::intValue).sum();
OptionalDouble avg = nums.stream().mapToInt(Integer::intValue).average();
OptionalInt max = nums.stream().mapToInt(Integer::intValue).max();

// reduce 自定义归约
int product = nums.stream().reduce(1, (a, b) -> a * b);

// 统计
long count = nums.stream().filter(n -> n > 5).count();
boolean anyPositive = nums.stream().anyMatch(n -> n > 0);
boolean allPositive = nums.stream().allMatch(n -> n > 0);
```

### 字符串操作

```java
List<String> words = Arrays.asList("hello", "world", "java", "stream");

// 拼接（类似 JS 的 join）
String joined = words.stream().collect(Collectors.joining(", "));  // "hello, world, java, stream"
String withBrackets = words.stream().collect(Collectors.joining(", ", "[", "]"));  // "[hello, world, java, stream]"

// 过滤 + 大写 + 排序
List<String> processed = words.stream()
    .filter(w -> w.length() > 4)
    .map(String::toUpperCase)     // 方法引用
    .sorted()
    .toList();
// ["HELLO", "STREAM", "WORLD"]
```

### flatMap（展平嵌套集合）

```java
// JS: [[1,2], [3,4], [5,6]].flatMap(x => x)  => [1,2,3,4,5,6]
List<List<Integer>> nested = Arrays.asList(
    Arrays.asList(1, 2, 3),
    Arrays.asList(4, 5, 6),
    Arrays.asList(7, 8, 9)
);

List<Integer> flat = nested.stream()
    .flatMap(List::stream)
    .toList();  // [1,2,3,4,5,6,7,8,9]

// 实际场景：提取每个订单中的所有商品
List<String> allProducts = orders.stream()
    .flatMap(order -> order.getItems().stream())
    .map(Item::getProductName)
    .distinct()
    .sorted()
    .toList();
```

### Collectors 收集器（重点！）

```java
// 准备数据
record Employee(String name, String dept, double salary) {}
List<Employee> employees = List.of(
    new Employee("Alice", "Engineering", 15000),
    new Employee("Bob", "Engineering", 12000),
    new Employee("Carol", "Marketing", 10000),
    new Employee("Dave", "Marketing", 11000),
    new Employee("Eve", "Engineering", 18000)
);

// 按部门分组
Map<String, List<Employee>> byDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::dept));

// 统计各部门人数
Map<String, Long> countByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::dept, Collectors.counting()));
// {Engineering=3, Marketing=2}

// 各部门平均薪资
Map<String, Double> avgSalaryByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::dept,
             Collectors.averagingDouble(Employee::salary)));

// 各部门最高薪员工
Map<String, Optional<Employee>> topByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::dept,
             Collectors.maxBy(Comparator.comparingDouble(Employee::salary))));

// 转换为 Map（key=name, value=salary）
Map<String, Double> salaryMap = employees.stream()
    .collect(Collectors.toMap(Employee::name, Employee::salary));

// 按条件分区（是否超过 12000）
Map<Boolean, List<Employee>> partitioned = employees.stream()
    .collect(Collectors.partitioningBy(e -> e.salary() > 12000));
// {true=[Alice, Eve], false=[Bob, Carol, Dave]}

// 汇总统计
DoubleSummaryStatistics stats = employees.stream()
    .collect(Collectors.summarizingDouble(Employee::salary));
System.out.println("最高：" + stats.getMax());
System.out.println("平均：" + stats.getAverage());
System.out.println("总计：" + stats.getSum());
```

### 并行流

```java
// 大数据量时用并行流加速（⚠️ 无状态操作才安全）
long count = LongStream.rangeClosed(1, 100_000_000L)
    .parallel()
    .filter(n -> n % 2 == 0)
    .count();
```

⚠️ **注意**：并行流不保证顺序，且对有状态的操作（如统计）需要线程安全的收集器。小数据量用并行流反而更慢（线程开销）。

---

## Optional

`Optional` 是一个容器，可能包含值也可能为空，用于替代返回 `null`。

```java
// 创建
Optional<String> opt1 = Optional.of("hello");           // 非空值
Optional<String> opt2 = Optional.empty();               // 空
Optional<String> opt3 = Optional.ofNullable(maybeNull); // 可能为 null

// ❌ 错误用法（等同于 null 判断，意义不大）
if (opt1.isPresent()) {
    String val = opt1.get();
}

// ✅ 正确用法：链式操作
String result = Optional.ofNullable(getUserById(id))
    .map(User::getName)
    .map(String::toUpperCase)
    .orElse("UNKNOWN");

// orElse vs orElseGet
String s1 = opt2.orElse("default");              // 直接返回默认值
String s2 = opt2.orElseGet(() -> computeDefault()); // 惰性计算（推荐，避免不必要的计算）

// orElseThrow（找不到时抛异常）
User user = Optional.ofNullable(getUserById(id))
    .orElseThrow(() -> new RuntimeException("User " + id + " not found"));

// ifPresent（有值才执行）
Optional.ofNullable(getUser()).ifPresent(u -> sendEmail(u.getEmail()));

// filter（条件过滤）
Optional<User> activeUser = Optional.ofNullable(getUser())
    .filter(u -> u.isActive());
```

💡 **对比 JS**：`Optional` 类似 JS 的可选链 `user?.name?.toUpperCase() ?? 'UNKNOWN'`，但更显式、更安全。

---

## 不可变集合

Java 9+ 提供工厂方法创建不可变集合：

```java
// 不可变 List（元素有序，允许重复）
List<String> list = List.of("a", "b", "c");

// 不可变 Set（元素无序，不允许重复，也不允许 null）
Set<String> set = Set.of("x", "y", "z");

// 不可变 Map
Map<String, Integer> map = Map.of(
    "one", 1,
    "two", 2,
    "three", 3
);

// 超过 10 个键值对用 Map.ofEntries
Map<String, Integer> bigMap = Map.ofEntries(
    Map.entry("a", 1),
    Map.entry("b", 2),
    // ...更多条目
);
```

⚠️ **注意**：调用不可变集合的 `add()`/`put()`/`remove()` 会抛出 `UnsupportedOperationException`。

✅ **推荐**：方法返回集合时，如果不需要修改，返回不可变集合（更安全，且 JVM 可以优化）。

```java
// 将可变集合转为不可变视图
List<String> mutable = new ArrayList<>();
List<String> readOnly = Collections.unmodifiableList(mutable);
// 或 Java 10+
List<String> copy = List.copyOf(mutable);  // 不可变且独立拷贝
```

---

*← [上一章：面向对象](./02-oop.md) | [下一章：并发编程](./04-concurrency.md) →*
