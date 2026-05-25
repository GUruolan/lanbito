# Java 基础语法完整篇

> 面向有 TypeScript / Node.js 经验的前端工程师

## 目录 {#toc}

- [1. 类型系统](#type-system)
- [2. 变量与常量](#variables)
- [3. 运算符](#operators)
- [4. 控制流程](#control-flow)
- [5. 数组](#arrays)
- [6. 字符串操作](#strings)
- [7. Lambda 表达式](#lambda)
- [8. 异常处理](#exceptions)

---

## 1. 类型系统 {#type-system}

Java 是**强静态类型**语言，所有变量在声明时必须指定类型，且编译期就会检查类型错误。

💡 **对比 JS**：TypeScript 也是静态类型，但 TS 只是编译器层面，最终还是 JS。Java 的类型系统是真正的运行时保障。

### 1.1 8种基本类型（Primitive Types）

| 类型 | 大小 | 范围 | 默认值 | 对比 TS |
|------|------|------|--------|---------|
| `byte` | 1字节 | -128 ~ 127 | 0 | — |
| `short` | 2字节 | -32768 ~ 32767 | 0 | — |
| `int` | 4字节 | -2^31 ~ 2^31-1 | 0 | `number` |
| `long` | 8字节 | -2^63 ~ 2^63-1 | 0L | `bigint` |
| `float` | 4字节 | 单精度浮点 | 0.0f | — |
| `double` | 8字节 | 双精度浮点 | 0.0 | `number` |
| `boolean` | 1bit | true / false | false | `boolean` |
| `char` | 2字节 | Unicode 字符 | '\u0000' | `string`(单字符) |

```java
// 基本类型声明示例
byte age = 25;
short year = 2024;
int count = 1_000_000;      // Java 7+ 支持数字分隔符，提高可读性
long population = 8_000_000_000L;  // long 字面量必须加 L
float price = 9.99f;        // float 字面量必须加 f
double pi = 3.14159265358979;
boolean isActive = true;
char grade = 'A';           // 注意：单引号，不是双引号
```

> ⚠️ **注意**：Java 的 `int` 是 32 位，不像 JS 的 `number` 是 64 位浮点数。处理大数时用 `long`，或者 `BigInteger`/`BigDecimal`。

> ⚠️ **注意**：`float` 精度低，金融计算**绝对不能**用 `float` 或 `double`，要用 `BigDecimal`。

```java
// 金融计算的坑
double a = 0.1 + 0.2;
System.out.println(a);  // 0.30000000000000004 ← 经典浮点精度问题

// ✅ 推荐：金融场景用 BigDecimal
import java.math.BigDecimal;
BigDecimal x = new BigDecimal("0.1");
BigDecimal y = new BigDecimal("0.2");
System.out.println(x.add(y));  // 0.3 ✓
```

### 1.2 包装类（Wrapper Classes）

每个基本类型都有对应的**引用类型（包装类）**：

| 基本类型 | 包装类 |
|---------|-------|
| `int` | `Integer` |
| `long` | `Long` |
| `double` | `Double` |
| `boolean` | `Boolean` |
| `char` | `Character` |
| `byte` | `Byte` |
| `short` | `Short` |
| `float` | `Float` |

```java
// 包装类的常用场景
Integer num = Integer.valueOf(42);
int parsed = Integer.parseInt("123");     // String → int
String str = Integer.toString(42);        // int → String
int max = Integer.MAX_VALUE;              // 2147483647
int min = Integer.MIN_VALUE;              // -2147483648

// 进制转换
String binary = Integer.toBinaryString(10);  // "1010"
String hex = Integer.toHexString(255);       // "ff"
int fromHex = Integer.parseInt("ff", 16);    // 255
```

### 1.3 自动装箱与拆箱（Autoboxing / Unboxing）

Java 会自动在基本类型和包装类之间转换：

```java
// 自动装箱：int → Integer
Integer a = 5;          // 等价于 Integer a = Integer.valueOf(5);

// 自动拆箱：Integer → int
int b = a;              // 等价于 int b = a.intValue();

// 集合中必须用包装类（集合不能存基本类型）
List<Integer> list = new ArrayList<>();
list.add(1);   // 自动装箱
list.add(2);
int sum = list.get(0) + list.get(1);  // 自动拆箱
```

> ⚠️ **常见坑：== 比较包装类**

```java
Integer x = 127;
Integer y = 127;
System.out.println(x == y);   // true  ← 因为 [-128, 127] 有缓存

Integer p = 200;
Integer q = 200;
System.out.println(p == q);   // false ← 超出缓存范围，是两个不同对象！

// ✅ 推荐：比较包装类用 equals()
System.out.println(p.equals(q));  // true ✓
```

### 1.4 String 类型

`String` 在 Java 中是**引用类型**，但行为很特殊：

```java
String name = "Alice";          // 字符串字面量（存储在常量池）
String name2 = new String("Alice");  // 堆上的新对象（不推荐）

// String 是不可变的（immutable）
String s = "hello";
s.toUpperCase();          // 返回新字符串，原 s 不变！
System.out.println(s);   // "hello"

String upper = s.toUpperCase();
System.out.println(upper);  // "HELLO"
```

---

## 2. 变量与常量 {#variables}

### 2.1 变量声明

💡 **对比 JS**：Java 每个变量都必须声明类型（除非用 `var`），没有 `undefined`。

```java
// Java 变量声明
int age = 25;
String name = "Alice";
boolean isStudent = true;

// Java 10+ 局部变量类型推断（类似 TS 的类型推断）
var message = "Hello";      // 推断为 String
var count = 42;             // 推断为 int
var list = new ArrayList<String>();  // 推断为 ArrayList<String>
```

> ⚠️ **注意**：`var` 只能用于**局部变量**，不能用于字段（类成员变量）。

```javascript
// JS/TS 对比
let age: number = 25;
const name: string = "Alice";
let isStudent: boolean = true;
```

### 2.2 常量

```java
// Java 常量用 final 关键字
final int MAX_SIZE = 100;
final String APP_NAME = "MyApp";

// 类常量（static final）
public class Config {
    public static final int TIMEOUT_MS = 5000;
    public static final String BASE_URL = "https://api.example.com";
}

// 使用
System.out.println(Config.TIMEOUT_MS);   // 5000
```

```typescript
// TS 对比
const MAX_SIZE = 100;           // TS const
const APP_NAME: string = "MyApp";
```

💡 **对比 JS**：Java 的 `final` 类似 TS 的 `const`，但 `final` 对对象只是引用不可变，对象内部属性仍可修改（和 `const` 完全一样）。

### 2.3 作用域

```java
public class ScopeExample {
    // 类字段（实例变量）
    private String name = "Alice";
    
    // 静态字段（类变量）
    private static int count = 0;
    
    public void method() {
        // 局部变量
        int x = 10;
        
        if (x > 5) {
            int y = 20;  // if 块内的局部变量
            System.out.println(x + y);
        }
        // System.out.println(y);  // 编译错误！y 超出作用域
    }
}
```

---

## 3. 运算符 {#operators}

### 3.1 算术运算符

```java
int a = 10, b = 3;

System.out.println(a + b);   // 13
System.out.println(a - b);   // 7
System.out.println(a * b);   // 30
System.out.println(a / b);   // 3  ← 整数除法，截断小数！
System.out.println(a % b);   // 1

// 浮点除法
System.out.println(10.0 / 3);    // 3.3333...
System.out.println((double) a / b);  // 3.3333... （强制转换）
```

> ⚠️ **常见坑：整数除法**

```java
int result = 5 / 2;
System.out.println(result);  // 2，不是 2.5！

// ✅ 推荐：确保至少一个操作数是浮点数
double result2 = 5.0 / 2;      // 2.5
double result3 = (double) 5 / 2; // 2.5
```

### 3.2 == vs equals() — 最重要的区别！

💡 **对比 JS**：JS 的 `===` 对字符串做值比较，Java 的 `==` 对引用类型是**引用比较**。

```java
// 基本类型：== 比较值
int x = 5, y = 5;
System.out.println(x == y);   // true ✓

// 引用类型：== 比较引用（内存地址）
String s1 = new String("hello");
String s2 = new String("hello");
System.out.println(s1 == s2);       // false！两个不同对象
System.out.println(s1.equals(s2));  // true ✓ 比较内容

// 字符串字面量的特殊情况（常量池）
String s3 = "hello";
String s4 = "hello";
System.out.println(s3 == s4);       // true（共享常量池中的同一对象）
```

> ⚠️ **常见坑：字符串比较永远用 equals()**

```java
// 场景：用户输入的字符串
String input = getUserInput();  // 来自外部，不在常量池

// ❌ 错误写法
if (input == "admin") { ... }   // 可能 false！

// ✅ 正确写法
if ("admin".equals(input)) { ... }  // 注意：常量放前面，防止 NPE
if (input.equals("admin")) { ... }  // 也可以，但 input 为 null 时会 NPE
```

### 3.3 逻辑运算符

```java
boolean a = true, b = false;

// 短路运算符（和 JS 完全一样）
System.out.println(a && b);   // false
System.out.println(a || b);   // true
System.out.println(!a);       // false

// 短路特性
int x = 0;
if (x != 0 && 10 / x > 1) {  // x != 0 为 false，后面不执行，不会除以零
    System.out.println("never");
}
```

### 3.4 位运算符

```java
int a = 0b1010;  // 10
int b = 0b1100;  // 12

System.out.println(a & b);   // 0b1000 = 8  (按位与)
System.out.println(a | b);   // 0b1110 = 14 (按位或)
System.out.println(a ^ b);   // 0b0110 = 6  (按位异或)
System.out.println(~a);      // -11          (按位取反)
System.out.println(a << 1);  // 20           (左移)
System.out.println(a >> 1);  // 5            (右移，保留符号)
System.out.println(a >>> 1); // 5            (无符号右移)
```

### 3.5 三元运算符

```java
int x = 5;
String result = x > 3 ? "big" : "small";  // 和 JS 完全一样
System.out.println(result);  // "big"
```

---

## 4. 控制流程 {#control-flow}

### 4.1 if / else if / else

```java
int score = 85;

if (score >= 90) {
    System.out.println("A");
} else if (score >= 80) {
    System.out.println("B");
} else if (score >= 70) {
    System.out.println("C");
} else {
    System.out.println("D");
}
// 输出：B
```

💡 **对比 JS**：语法完全一样，但 Java 的条件**必须是 boolean**，不能像 JS 那样用 truthy/falsy。

```java
int x = 0;
// ❌ Java 不允许：if (x) { }  — 编译错误！
// ✅ Java 必须：if (x != 0) { }
```

### 4.2 switch 表达式（Java 14+）

传统 switch 语句（老写法，有 fall-through 坑）：

```java
// 老式 switch（容易写漏 break）
int day = 3;
switch (day) {
    case 1:
        System.out.println("Monday");
        break;  // ⚠️ 忘写 break 会 fall-through！
    case 2:
        System.out.println("Tuesday");
        break;
    default:
        System.out.println("Other");
}
```

> ⚠️ **常见坑：忘写 break**

```java
// ✅ 推荐：Java 14+ 的 switch 表达式（箭头语法，无 fall-through）
String dayName = switch (day) {
    case 1 -> "Monday";
    case 2 -> "Tuesday";
    case 3 -> "Wednesday";
    case 4 -> "Thursday";
    case 5 -> "Friday";
    case 6, 7 -> "Weekend";   // 多个 case 合并
    default -> "Invalid";
};
System.out.println(dayName);  // "Wednesday"
```

```java
// switch 也可以用于多行逻辑（用 yield 返回值）
int result = switch (day) {
    case 1, 2, 3, 4, 5 -> {
        System.out.println("Weekday");
        yield day * 10;  // yield 替代 return，在 switch 块内使用
    }
    default -> 0;
};
```

### 4.3 for 循环

```java
// 传统 for 循环
for (int i = 0; i < 5; i++) {
    System.out.println(i);  // 0 1 2 3 4
}

// 增强 for 循环（for-each）— 类似 JS 的 for...of
int[] numbers = {1, 2, 3, 4, 5};
for (int n : numbers) {
    System.out.println(n);
}

// 遍历集合
List<String> names = List.of("Alice", "Bob", "Charlie");
for (String name : names) {
    System.out.println(name);
}
```

💡 **对比 JS**：Java 的增强 for 对应 JS 的 `for...of`，不过 Java 没有 `for...in`（对象属性遍历用 Map）。

### 4.4 while / do-while

```java
// while
int i = 0;
while (i < 5) {
    System.out.println(i);
    i++;
}

// do-while（至少执行一次）
int j = 0;
do {
    System.out.println("j = " + j);
    j++;
} while (j < 3);
```

### 4.5 break / continue / 带标签的跳转

```java
// break：跳出最近的循环
for (int i = 0; i < 10; i++) {
    if (i == 5) break;
    System.out.print(i + " ");  // 0 1 2 3 4
}

// continue：跳过本次迭代
for (int i = 0; i < 10; i++) {
    if (i % 2 == 0) continue;
    System.out.print(i + " ");  // 1 3 5 7 9
}

// 带标签的 break（跳出嵌套循环）— JS 也支持但很少用
outer:
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (i == 1 && j == 1) break outer;
        System.out.println(i + "," + j);
    }
}
// 输出：0,0  0,1  0,2  1,0
```

---

## 5. 数组 {#arrays}

### 5.1 一维数组

```java
// 声明并初始化
int[] nums = {1, 2, 3, 4, 5};
String[] names = {"Alice", "Bob", "Charlie"};

// 声明并分配空间（默认值为 0/false/null）
int[] arr = new int[5];  // [0, 0, 0, 0, 0]

// 访问和修改
arr[0] = 10;
arr[4] = 50;
System.out.println(arr.length);  // 5（不是 .length()，是属性）

// 遍历
for (int i = 0; i < nums.length; i++) {
    System.out.println(nums[i]);
}

// 增强 for
for (int n : nums) {
    System.out.println(n);
}
```

> ⚠️ **注意**：Java 数组长度固定！创建后无法 push/pop。需要动态大小用 `ArrayList`。

> ⚠️ **注意**：访问越界会抛出 `ArrayIndexOutOfBoundsException`。

### 5.2 二维数组

```java
// 声明二维数组（矩阵）
int[][] matrix = {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};

System.out.println(matrix[1][2]);  // 6（第2行第3列）
System.out.println(matrix.length);     // 3（行数）
System.out.println(matrix[0].length);  // 3（列数）

// 遍历二维数组
for (int[] row : matrix) {
    for (int val : row) {
        System.out.printf("%3d", val);
    }
    System.out.println();
}

// 不规则数组（每行长度可以不同）
int[][] jagged = new int[3][];
jagged[0] = new int[]{1};
jagged[1] = new int[]{2, 3};
jagged[2] = new int[]{4, 5, 6};
```

### 5.3 Arrays 工具类

```java
import java.util.Arrays;

int[] arr = {5, 3, 1, 4, 2};

// 排序
Arrays.sort(arr);
System.out.println(Arrays.toString(arr));  // [1, 2, 3, 4, 5]

// 二分查找（数组必须已排序）
int idx = Arrays.binarySearch(arr, 3);
System.out.println(idx);  // 2

// 复制数组
int[] copy = Arrays.copyOf(arr, arr.length);
int[] partial = Arrays.copyOfRange(arr, 1, 4);  // [2, 3, 4]

// 填充
int[] filled = new int[5];
Arrays.fill(filled, 7);  // [7, 7, 7, 7, 7]

// 比较
System.out.println(Arrays.equals(arr, copy));  // true
```

💡 **对比 JS**：`Arrays.sort()` 对应 JS 的 `Array.prototype.sort()`，但 JS sort 默认转字符串排序（坑！），Java sort 对数字是正确的数值排序。

---

## 6. 字符串操作 {#strings}

### 6.1 String 不可变性

```java
String s = "hello";
s.toUpperCase();        // 返回新字符串，s 本身不变
s.replace("l", "r");   // 返回新字符串，s 本身不变

System.out.println(s);  // 还是 "hello"

// ✅ 正确使用
String upper = s.toUpperCase();
String replaced = s.replace("l", "r");
```

💡 **对比 JS**：JS 的字符串也是不可变的，这一点完全一样。

### 6.2 常用字符串方法

```java
String str = "  Hello, World!  ";

// 长度
str.length()                    // 17

// 去空格
str.trim()                      // "Hello, World!"
str.strip()                     // Java 11+，处理 Unicode 空白

// 大小写
str.toUpperCase()               // "  HELLO, WORLD!  "
str.toLowerCase()               // "  hello, world!  "

// 包含/查找
str.contains("World")          // true
str.indexOf("o")               // 5（第一个 'o' 的位置）
str.lastIndexOf("o")           // 9（最后一个 'o'）
str.startsWith("  H")          // true
str.endsWith("  ")             // true

// 截取
str.trim().substring(7)        // "World!"
str.trim().substring(7, 12)    // "World"

// 分割（类似 JS 的 split）
String csv = "a,b,c,d";
String[] parts = csv.split(",");  // ["a", "b", "c", "d"]

// 替换
str.replace("World", "Java")   // "  Hello, Java!  "
str.replaceAll("\\s+", " ")    // 正则替换，多个空格变一个

// 连接
String.join(", ", "a", "b", "c")   // "a, b, c"
String.join("-", List.of("x", "y")); // "x-y"

// 判断空
str.isEmpty()                  // false（只有长度为0时为true）
str.isBlank()                  // false（Java 11+，全是空白字符才为true）
"  ".isBlank()                 // true

// 转换
"42".equals("42")              // true（字符串比较）
Integer.parseInt("42")         // 42（转 int）
String.valueOf(42)             // "42"（转 String）
42 + ""                        // "42"（利用字符串连接，不推荐）

// 字符操作
str.charAt(2)                  // ' '（索引2的字符）
str.toCharArray()              // char 数组
```

### 6.3 StringBuilder — 可变字符串

当需要频繁拼接字符串时，用 `StringBuilder`：

```java
// ❌ 低效写法（每次 + 都创建新对象）
String result = "";
for (int i = 0; i < 1000; i++) {
    result += i;  // 1000次对象创建！
}

// ✅ 高效写法
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 1000; i++) {
    sb.append(i);
}
String result2 = sb.toString();

// StringBuilder 的常用方法
StringBuilder sb2 = new StringBuilder("Hello");
sb2.append(", World");          // Hello, World
sb2.insert(5, "!");             // Hello!, World
sb2.delete(5, 6);               // Hello, World
sb2.reverse();                  // dlroW ,olleH
sb2.replace(0, 5, "Java");      // 替换子串
System.out.println(sb2.length()); // 长度
```

💡 **对比 JS**：JS 的字符串拼接有 v8 优化（字符串在内部是 rope 结构），但 Java 没有这种优化，所以必须显式用 StringBuilder。

### 6.4 字符串格式化

```java
String name = "Alice";
int age = 25;
double score = 98.5;

// 方式1：String.format（类似 C 的 printf）
String msg1 = String.format("姓名: %s, 年龄: %d, 分数: %.1f", name, age, score);
// "姓名: Alice, 年龄: 25, 分数: 98.5"

// 方式2：printf（直接打印，不返回字符串）
System.out.printf("Name: %s, Age: %d%n", name, age);

// 方式3：文本块（Java 15+）
String json = """
        {
            "name": "%s",
            "age": %d
        }
        """.formatted(name, age);

// 方式4：字符串连接（简单场景）
String msg2 = "姓名: " + name + ", 年龄: " + age;
```

💡 **对比 JS**：Java 15+ 的文本块和 JS 的模板字符串非常类似！

```javascript
// JS 模板字符串
const msg = `姓名: ${name}, 年龄: ${age}`;
```

```java
// Java 文本块（Java 15+）
String msg = """
    姓名: %s, 年龄: %d
    """.formatted(name, age);
```

---

## 7. Lambda 表达式 {#lambda}

### 7.1 基本语法

💡 **对比 JS**：Java Lambda 和 JS 箭头函数非常相似！

```javascript
// JS 箭头函数
const add = (a, b) => a + b;
const double = x => x * 2;
const greet = () => console.log("Hello");
```

```java
// Java Lambda（需要配合函数式接口使用）
// 形式：(参数) -> 表达式  或  (参数) -> { 代码块; }

// 等价形式
BinaryOperator<Integer> add = (a, b) -> a + b;
Function<Integer, Integer> double_ = x -> x * 2;
Runnable greet = () -> System.out.println("Hello");
```

### 7.2 常用函数式接口

```java
import java.util.function.*;

// Function<T, R>：接收 T，返回 R（类比 JS: x => result）
Function<String, Integer> strLen = s -> s.length();
System.out.println(strLen.apply("hello"));  // 5

// Predicate<T>：接收 T，返回 boolean（类比 JS: x => boolean）
Predicate<Integer> isEven = n -> n % 2 == 0;
System.out.println(isEven.test(4));   // true
System.out.println(isEven.test(3));   // false

// Consumer<T>：接收 T，无返回（类比 JS: x => void）
Consumer<String> printer = s -> System.out.println(s);
printer.accept("Hello!");

// Supplier<T>：无参数，返回 T（类比 JS: () => value）
Supplier<Double> random = () -> Math.random();
System.out.println(random.get());

// BiFunction<T, U, R>：接收两个参数
BiFunction<Integer, Integer, Integer> multiply = (a, b) -> a * b;
System.out.println(multiply.apply(3, 4));<!-- 这是 01-basics.md 的续写内容，待合并 -->

### 7.3 方法引用

```java
import java.util.Arrays;
import java.util.List;

// 方法引用是 Lambda 的简写形式
List<String> names = Arrays.asList("Charlie", "Alice", "Bob");

// Lambda 写法
names.forEach(name -> System.out.println(name));

// 方法引用写法（::）
names.forEach(System.out::println);

// 静态方法引用
Function<String, Integer> parse = Integer::parseInt;
System.out.println(parse.apply("42"));  // 42

// 实例方法引用
String prefix = "Hello, ";
Function<String, String> greet = prefix::concat;
System.out.println(greet.apply("Alice"));  // "Hello, Alice"

// 构造器引用
Supplier<ArrayList> newList = ArrayList::new;
```

---

## 8. 异常处理 {#exceptions}

### 8.1 异常层级结构

```
Throwable
├── Error（系统级错误，不需要也不应该捕获）
│   ├── OutOfMemoryError
│   └── StackOverflowError
└── Exception
    ├── RuntimeException（非受检异常，不强制处理）
    │   ├── NullPointerException
    │   ├── ArrayIndexOutOfBoundsException
    │   ├── ClassCastException
    │   ├── NumberFormatException
    │   └── IllegalArgumentException
    └── 受检异常（必须处理，否则编译报错）
        ├── IOException
        ├── SQLException
        └── ParseException
```

### 8.2 try-catch-finally

```java
// 基本用法
try {
    int result = 10 / 0;           // 抛出 ArithmeticException
    System.out.println(result);
} catch (ArithmeticException e) {
    System.out.println("除以零错误: " + e.getMessage());
} finally {
    System.out.println("finally 总会执行");  // 总是执行
}

// 多异常捕获
try {
    String s = null;
    s.length();  // NullPointerException
} catch (NullPointerException | IllegalArgumentException e) {
    System.out.println("捕获到: " + e.getClass().getSimpleName());
} catch (Exception e) {
    System.out.println("通用异常: " + e.getMessage());
} finally {
    System.out.println("清理资源");
}
```

💡 **对比 JS**：`try-catch-finally` 语法和 JS 完全一样！

```javascript
// JS
try {
    throw new Error("something went wrong");
} catch (e) {
    console.error(e.message);
} finally {
    console.log("always runs");
}
```

### 8.3 受检异常 vs 非受检异常

这是 Java 独有的概念，JS/TS 没有！

```java
import java.io.*;

// 受检异常（Checked Exception）：必须处理，否则编译不通过
public void readFile(String path) throws IOException {  // 声明可能抛出
    FileReader reader = new FileReader(path);  // 编译器强制你处理
    // ...
}

// 调用时必须处理
try {
    readFile("/path/to/file.txt");
} catch (IOException e) {
    System.err.println("文件读取失败: " + e.getMessage());
}

// 或者继续往上抛
public void doSomething() throws IOException {
    readFile("/path/to/file.txt");
}
```

```java
// 非受检异常（RuntimeException）：不需要显式捕获
public int divide(int a, int b) {
    if (b == 0) {
        throw new IllegalArgumentException("除数不能为零");
    }
    return a / b;
}

// 调用时不强制 try-catch
int result = divide(10, 0);  // 运行时抛出，不捕获程序就崩溃
```

### 8.4 自定义异常

```java
// 自定义异常（继承 RuntimeException）
public class UserNotFoundException extends RuntimeException {
    private final Long userId;
    
    public UserNotFoundException(Long userId) {
        super("User not found: " + userId);
        this.userId = userId;
    }
    
    public Long getUserId() {
        return userId;
    }
}

// 使用
public User findUser(Long id) {
    User user = userRepository.findById(id);
    if (user == null) {
        throw new UserNotFoundException(id);
    }
    return user;
}

// 捕获
try {
    User user = findUser(999L);
} catch (UserNotFoundException e) {
    System.out.println("用户 " + e.getUserId() + " 不存在");
}
```

### 8.5 try-with-resources（自动关闭资源）

```java
// ❌ 老写法：手动关闭，容易忘
FileReader fr = null;
try {
    fr = new FileReader("file.txt");
    // 读取...
} catch (IOException e) {
    e.printStackTrace();
} finally {
    if (fr != null) {
        try {
            fr.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}

// ✅ 推荐：try-with-resources，自动关闭
try (FileReader fr = new FileReader("file.txt");
     BufferedReader br = new BufferedReader(fr)) {
    String line;
    while ((line = br.readLine()) != null) {
        System.out.println(line);
    }
} catch (IOException e) {
    System.err.println("读取失败: " + e.getMessage());
}
// 无论是否异常，fr 和 br 都会被自动关闭
```

💡 **对比 JS**：JS 中没有这个概念（JS 的 GC 处理内存，但流/连接仍需手动关闭）。Java 的 `try-with-resources` 是优雅处理资源的最佳实践。

---

## 总结对比表

| 概念 | JavaScript/TypeScript | Java |
|------|----------------------|------|
| 类型检查 | 编译期（TS）/ 运行时（JS） | 编译期 |
| 数字类型 | `number`（64位浮点） | `int`/`long`/`double` 等 |
| 字符串 | `string`，可变内容（实际不可变） | `String`，不可变 |
| 字符串比较 | `===` | `.equals()` |
| 空值 | `null` / `undefined` | `null` |
| 常量 | `const` | `final` |
| 类型推断 | TS 自动推断 | `var`（Java 10+） |
| 错误处理 | `try-catch-finally` | `try-catch-finally`（+受检异常） |
| 函数作为值 | 箭头函数 | Lambda 表达式 |
| 数组 | 动态大小 `Array` | 固定大小，动态用 `ArrayList` |

---

*← [返回首页](./index.md) | [下一章：面向对象编程 →](./02-oop.md)*
